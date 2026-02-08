const mongoose = require("mongoose");

const playerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    position: { type: String, default: "Unknown", trim: true },
    matches: { type: Number, default: 0 },
    goals: { type: Number, default: 0 },
    assists: { type: Number, default: 0 },
    rating: { type: Number, default: 0 }
  },
  { _id: true }
);

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },

    country: { type: String, default: "Unknown", trim: true },
    foundedYear: { type: Number, default: 1900 },
    coach: { type: String, default: "Unknown", trim: true },
    stadium: { type: String, default: "Unknown", trim: true },
    league: { type: String, default: "Unknown", trim: true },
    rating: { type: Number, default: 80, min: 0, max: 100 },

    logoUrl: { type: String, default: "" },
    players: { type: [playerSchema], default: [] }
  },
  { timestamps: true }
);

teamSchema.index({ name: 1, country: 1 });

module.exports = mongoose.models.Team || mongoose.model("Team", teamSchema);