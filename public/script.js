let currentUser = null;

function isAdmin() {
  return currentUser && currentUser.role === 'admin';
}

function setAuthUI() {
  const authStatus = document.getElementById('authStatus');
  const loginBox = document.getElementById('loginBox');
  const logoutBox = document.getElementById('logoutBox');
  const createCard = document.getElementById('createCard');
  const adminHint = document.getElementById('adminHint');

  if (!authStatus) return;

  if (currentUser) {
    authStatus.innerText = `Logged in as: ${currentUser.username} (${currentUser.role || 'user'})`;
    if (loginBox) loginBox.style.display = 'none';
    if (logoutBox) logoutBox.style.display = 'block';

    if (isAdmin()) {
      if (createCard) createCard.style.display = 'block';
      if (adminHint) adminHint.style.display = 'none';
    } else {
      if (createCard) createCard.style.display = 'none';
      if (adminHint) adminHint.style.display = 'block';
    }
  } else {
    authStatus.innerText = 'Not logged in (read-only mode)';
    if (loginBox) loginBox.style.display = 'block';
    if (logoutBox) logoutBox.style.display = 'none';
    if (createCard) createCard.style.display = 'none';
    if (adminHint) adminHint.style.display = 'none';
  }
}

async function checkSession() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    const data = await res.json().catch(() => ({}));
    currentUser = data.user || null;
  } catch (e) {
    currentUser = null;
  }
  setAuthUI();
}
async function login() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  if (!username || !password) return alert('Fill username and password');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ username, password })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.message || 'Invalid credentials');
      return;
    }
    document.getElementById('password').value = '';
    if (data.role) {
      currentUser = { username, role: data.role };
      setAuthUI();
    }

    await checkSession();
    await loadTeams();
  } catch (err) {
    console.error(err);
    alert('Login error');
  }
}

async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } catch {}

  currentUser = null;
  setAuthUI();
  await loadTeams();
}

async function loadTeams() {
  try {
    const res = await fetch('/api/teams', { credentials: 'same-origin' });
    if (!res.ok) throw new Error('Failed to fetch teams');

    const teams = await res.json();
    const list = document.getElementById('teams');
    if (!list) return;

    list.innerHTML = '';

    teams.forEach(team => {
      const li = document.createElement('li');
      li.className = 'card';

      const logo = team.logoUrl
        ? `<img src="${team.logoUrl}" style="width:70px;height:70px;object-fit:contain;background:#fff;border-radius:10px;padding:6px;margin-bottom:10px;">`
        : '';

      const info = `
        ${logo}
        <strong>${team.name}</strong>
        <p>
          Country: ${team.country}<br>
          Coach: ${team.coach}<br>
          Founded: ${team.foundedYear}<br>
          Stadium: ${team.stadium}<br>
          League: ${team.league}<br>
          Rating: ${team.rating}<br>
          <a href="/team?id=${team._id}" style="color:#00ff88;">Open team page</a>
        </p>
      `;

      let buttons = '';
      if (isAdmin()) {
        const safe = (s) => String(s).replaceAll('"', '&quot;').replaceAll("'", '&#39;');
        buttons = `
          <button onclick="editTeam('${team._id}', '${safe(team.name)}', '${safe(team.country)}', '${safe(team.coach)}', '${team.foundedYear}', '${safe(team.stadium)}', '${safe(team.league)}', '${team.rating}', '${safe(team.logoUrl || '')}')">Edit</button>
          <button onclick="deleteTeam('${team._id}')" style="background: #ff4d4d; color: white;">Delete</button>
        `;
      } else {
        buttons = `<small>Only admin can edit/delete. Users can view only.</small>`;
      }

      li.innerHTML = info + buttons;
      list.appendChild(li);
    });
  } catch (err) {
    console.error('Load Error:', err);
  }
}

async function addTeam() {
  if (!isAdmin()) return alert('Admin only');

  const name = document.getElementById('name').value.trim();
  const country = document.getElementById('country').value.trim();
  const coach = document.getElementById('coach').value.trim();
  const foundedYear = Number(document.getElementById('foundedYear').value);
  const stadium = document.getElementById('stadium').value.trim();
  const league = document.getElementById('league').value.trim();
  const rating = Number(document.getElementById('rating').value);
  const logoUrl = document.getElementById('logoUrl').value.trim();

  if (!name || !country || !coach || !foundedYear || !stadium || !league || Number.isNaN(rating)) {
    return alert('Please fill all fields');
  }

  try {
    const res = await fetch('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ name, country, coach, foundedYear, stadium, league, rating, logoUrl })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data.message || 'Server error when adding team');

    ['name','country','coach','foundedYear','stadium','league','rating','logoUrl'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    loadTeams();
  } catch (err) {
    console.error('Add Error:', err);
  }
}

async function deleteTeam(id) {
  if (!isAdmin()) return alert('Admin only');
  if (!confirm('Are you sure?')) return;

  try {
    const res = await fetch(`/api/teams/${id}`, { method: 'DELETE', credentials: 'same-origin' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data.message || 'Delete failed');
    loadTeams();
  } catch (err) {
    console.error('Delete Error:', err);
  }
}

async function editTeam(id, name, country, coach, foundedYear, stadium, league, rating, logoUrl) {
  if (!isAdmin()) return alert('Admin only');

  const newName = prompt('Team name:', name); if (!newName) return;
  const newCountry = prompt('Country:', country); if (!newCountry) return;
  const newCoach = prompt('Coach:', coach); if (!newCoach) return;
  const newFoundedYear = Number(prompt('Founded year:', foundedYear)); if (!newFoundedYear) return;
  const newStadium = prompt('Stadium:', stadium); if (!newStadium) return;
  const newLeague = prompt('League:', league); if (!newLeague) return;
  const newRating = Number(prompt('Rating (0-100):', rating)); if (Number.isNaN(newRating)) return;
  const newLogoUrl = prompt('Logo URL:', logoUrl || '') ?? '';

  try {
    const res = await fetch(`/api/teams/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        name: newName,
        country: newCountry,
        coach: newCoach,
        foundedYear: newFoundedYear,
        stadium: newStadium,
        league: newLeague,
        rating: newRating,
        logoUrl: newLogoUrl.trim(),
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data.message || 'Update failed');
    loadTeams();
  } catch (err) {
    console.error('Edit Error:', err);
  }
}

async function editPlayers(teamId) {
  if (!isAdmin()) return alert('Admin only');

  try {
    const teamRes = await fetch(`/api/teams/${teamId}`, { credentials: 'same-origin' });
    const team = await teamRes.json();

    const example = JSON.stringify(team.players || [], null, 2);
    const json = prompt(
      'Edit players JSON (array). Example:\n' +
      '[{"name":"Player","position":"FW","matches":10,"goals":5,"assists":2,"rating":80}]',
      example
    );
    if (json === null) return;

    let players = [];
    try { players = JSON.parse(json); } catch { return alert('Invalid JSON'); }
    if (!Array.isArray(players)) return alert('Players must be an array');

    const res = await fetch(`/api/teams/${teamId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ players })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data.message || 'Update failed');

    alert('Players updated!');
    loadTeams();
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

(async () => {
  await checkSession();
  await loadTeams();
})();