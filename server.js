require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const session = require('express-session');
const bcrypt = require('bcrypt');

const connectMongo = require('connect-mongo');
const MongoStore = connectMongo.create ? connectMongo : connectMongo.default;

const app = express();

const Match = require('./models/Match');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1);

app.get('/', (req, res) => res.redirect('/home'));
app.use(express.static(path.join(__dirname, 'public')));

mongoose
  .connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 })
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch((err) => console.error('MongoDB Connection Error:', err));

app.use(
  session({
    name: 'sid',
    secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: 'sessions',
      ttl: 60 * 60 * 24,
    }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
  },
  { timestamps: true }
);
const User = mongoose.models.User || mongoose.model('User', userSchema);

const playerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    position: { type: String, required: true, trim: true },
    matches: { type: Number, default: 0 },
    goals: { type: Number, default: 0 },
    assists: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
  },
  { _id: true }
);

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    coach: { type: String, required: true, trim: true },
    foundedYear: { type: Number, required: true, min: 1800, max: 2100 },
    stadium: { type: String, required: true, trim: true },
    league: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 0, max: 100 },
    logoUrl: { type: String, default: '' },
    players: { type: [playerSchema], default: [] },
  },
  { timestamps: true }
);

teamSchema.index({ name: 1, country: 1 });

const Team = mongoose.models.Team || mongoose.model('Team', teamSchema);

const messageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);
const ContactMessage =
  mongoose.models.ContactMessage || mongoose.model('ContactMessage', messageSchema);

function requireAdmin(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ message: 'Unauthorized' });
  if (req.session.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  next();
}

app.get('/api/auth/me', async (req, res) => {
  try {
    if (!req.session?.userId) return res.json({ user: null });

    const user = await User.findById(req.session.userId).select('username role');
    if (!user) return res.json({ user: null });

    res.json({ user: { id: user._id, username: user.username, role: user.role } });
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    let { username, password } = req.body || {};
    username = (username || '').trim();

    if (!username || !password) return res.status(400).json({ message: 'Invalid data' });

    const exists = await User.findOne({ username });
    if (exists) return res.status(409).json({ message: 'User already exists' });

    const passwordHash = await bcrypt.hash(password, 10);
    await User.create({ username, passwordHash, role: 'user' });

    res.status(201).json({ message: 'Registered' });
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    let { username, password } = req.body || {};
    username = (username || '').trim();

    if (!username || !password) return res.status(400).json({ message: 'Invalid credentials' });

    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    req.session.userId = user._id.toString();
    req.session.role = user.role;
    req.session.save((err) => {
      if (err) return res.status(500).json({ message: 'Server error' });

      res.json({
        message: 'Logged in',
        user: { id: user._id, username: user.username, role: user.role },
        role: user.role,
      });
    });
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('sid', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    res.json({ message: 'Logged out' });
  });
});

app.get('/api/teams', async (req, res) => {
  try {
    const teams = await Team.find().sort({ createdAt: -1 });
    res.json(teams);
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/teams/:id', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: 'Not found' });
    res.json(team);
  } catch (e) {
    res.status(400).json({ message: 'Invalid id' });
  }
});

app.post('/api/teams', requireAdmin, async (req, res) => {
  try {
    const team = await Team.create(req.body);
    res.status(201).json(team);
  } catch (e) {
    res.status(400).json({ message: 'Invalid data' });
  }
});

app.put('/api/teams/:id', requireAdmin, async (req, res) => {
  try {
    const updated = await Team.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated) return res.status(404).json({ message: 'Not found' });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ message: 'Invalid data' });
  }
});

app.delete('/api/teams/:id', requireAdmin, async (req, res) => {
  try {
    const deleted = await Team.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Team deleted successfully' });
  } catch (e) {
    res.status(400).json({ message: 'Invalid id' });
  }
});

app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body || {};
    if (!name || !email || !message) return res.status(400).json({ message: 'Missing fields' });

    await ContactMessage.create({ name, email, message });
    res.status(201).json({ message: 'Message sent!' });
  } catch (e) {
    res.status(500).json({ message: 'Server error' });
  }
});

async function seedAdminAndTeams() {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin12345';

  const existingAdmin = await User.findOne({ username: adminUsername });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await User.create({ username: adminUsername, passwordHash, role: 'admin' });
    console.log('Seeded admin');
  }

  const clubData = [];

  for (const c of clubData) {
    const baseTeam = {
      name: c.name,
      country: 'Unknown',
      coach: 'Unknown',
      foundedYear: 1900,
      stadium: 'Unknown',
      league: 'Unknown',
      rating: 80,
      logoUrl: c.logoUrl,
      players: c.players,
    };

    let t = await Team.findOne({ name: c.name });

    if (!t) {
      await Team.create(baseTeam);
      console.log(`Created ${c.name}`);
      continue;
    }

    const needPlayers = !Array.isArray(t.players) || t.players.length < 5;
    const needLogo = !t.logoUrl || t.logoUrl.trim() === '';

    if (needPlayers || needLogo) {
      await Team.updateOne(
        { _id: t._id },
        {
          $set: {
            logoUrl: needLogo ? c.logoUrl : t.logoUrl,
            players: needPlayers ? c.players : t.players,
          },
        }
      );
      console.log(`Updated ${c.name} (players/logo)`);
    }
  }

  const matchesCount = await Match.countDocuments();
  if (matchesCount < 3) {
    const teamsSample = await Team.aggregate([
      { $match: { "players.0": { $exists: true } } },
      { $sample: { size: 6 } }
    ]);

    if (teamsSample.length >= 2) {
      const pickPlayer = (t) => {
        const arr = t.players || [];
        if (!arr.length) return { name: "Unknown", assist: "" };
        const scorer = arr[Math.floor(Math.random() * arr.length)];
        const assister = arr.length > 1 ? arr[Math.floor(Math.random() * arr.length)] : null;
        return { name: scorer?.name || "Unknown", assist: assister?.name || "" };
      };

      const makePair = (a, b) => {
        if (String(a._id) === String(b._id)) return null;

        const g1 = pickPlayer(a);
        const g2 = pickPlayer(b);

        return {
          homeTeamId: a._id,
          awayTeamId: b._id,
          date: new Date(Date.now() - 1000 * 60 * 60 * 24 * (1 + Math.floor(Math.random() * 4))),
          status: "finished",
          scoreHome: 0,
          scoreAway: 0,
          events: [
            { type: "goal", minute: 12, teamId: a._id, playerName: g1.name, assistName: g1.assist, note: "" },
            { type: "goal", minute: 67, teamId: b._id, playerName: g2.name, assistName: g2.assist, note: "" }
          ]
        };
      };

      const a = teamsSample[0];
      const b = teamsSample[1];
      const c = teamsSample[2] || teamsSample[0];
      const d = teamsSample[3] || teamsSample[1];
      const e = teamsSample[4] || teamsSample[0];
      const f = teamsSample[5] || teamsSample[1];

      const docs = [makePair(a, b), makePair(c, d), makePair(e, f)].filter(Boolean);

      await Match.create(docs);

      const seeded = await Match.find().sort({ date: -1 }).limit(10);
      for (const m of seeded) {
        let sh = 0;
        let sa = 0;
        for (const ev of m.events || []) {
          if (ev.type !== "goal") continue;
          if (String(ev.teamId) === String(m.homeTeamId)) sh += 1;
          else if (String(ev.teamId) === String(m.awayTeamId)) sa += 1;
        }
        m.scoreHome = sh;
        m.scoreAway = sa;
        await m.save();
      }

      console.log("Seeded matches");
    }
  }
}
app.get('/home', (req, res) => res.sendFile(path.join(__dirname, 'public/home.html')));
app.get('/about', (req, res) => res.sendFile(path.join(__dirname, 'public/about.html')));
app.get('/contact', (req, res) => res.sendFile(path.join(__dirname, 'public/contact.html')));
app.get('/team', (req, res) => res.sendFile(path.join(__dirname, 'public/team.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public/register.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/all-teams', (req, res) => res.sendFile(path.join(__dirname, 'public/all-teams.html')));
app.get('/players', (req, res) => res.sendFile(path.join(__dirname, 'public/players.html')));

const matchRoutes = require('./routes/matches');
app.use('/api/matches', matchRoutes);

const teamPlayersRoutes = require('./routes/teamPlayers');
app.use('/api/teams', teamPlayersRoutes);

const statsRoutes = require('./routes/stats');
app.use('/api/stats', statsRoutes);

app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public/404.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));