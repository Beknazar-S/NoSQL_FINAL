const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["goal", "yellow", "red", "sub"], required: true },
    minute: { type: Number, required: true, min: 0, max: 130 },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
    playerName: { type: String, default: "" },
    assistName: { type: String, default: "" },
    note: { type: String, default: "" }
  },
  { _id: true }
);

const matchSchema = new mongoose.Schema(
  {
    homeTeamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
    awayTeamId: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ["scheduled", "live", "finished"], default: "scheduled" },
    scoreHome: { type: Number, default: 0 },
    scoreAway: { type: Number, default: 0 },
    events: { type: [eventSchema], default: [] }
  },
  { timestamps: true }
);

matchSchema.index({ status: 1, date: -1 });
matchSchema.index({ homeTeamId: 1, awayTeamId: 1, date: -1 });

module.exports = mongoose.models.Match || mongoose.model("Match", matchSchema);