const express = require("express");
const mongoose = require("mongoose");
const Team = require("../models/Team");
const { auth, adminOnly } = require("../middleware/auth");

const router = express.Router();

router.post("/:teamId/players", auth, adminOnly, async (req, res) => {
  try {
    const { name, position } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ message: "name is required" });

    const player = {
      _id: new mongoose.Types.ObjectId(),
      name: String(name).trim(),
      position: position ? String(position).trim() : "Unknown",
      matches: 0,
      goals: 0,
      assists: 0,
      rating: 0
    };

    const updated = await Team.findByIdAndUpdate(
      req.params.teamId,
      { $push: { players: player } },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "Team not found" });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ message: "Invalid data" });
  }
});

router.patch("/:teamId/players/:playerId", auth, adminOnly, async (req, res) => {
  try {
    const body = req.body || {};
    const allowed = new Set(["name", "position", "matches", "goals", "assists", "rating"]);
    const setObj = {};

    for (const [k, v] of Object.entries(body)) {
      if (!allowed.has(k)) continue;
      setObj[`players.$.${k}`] = v;
    }

    if (!Object.keys(setObj).length) return res.status(400).json({ message: "No valid fields" });

    const updated = await Team.findOneAndUpdate(
      { _id: req.params.teamId, "players._id": req.params.playerId },
      { $set: setObj },
      { new: true, runValidators: true }
    );

    if (!updated) return res.status(404).json({ message: "Team/player not found" });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ message: "Invalid data" });
  }
});

router.patch("/:teamId/players/:playerId/goals", auth, adminOnly, async (req, res) => {
  try {
    const updated = await Team.findOneAndUpdate(
      { _id: req.params.teamId, "players._id": req.params.playerId },
      { $inc: { "players.$.goals": 1 } },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "Team/player not found" });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ message: "Invalid id" });
  }
});

router.delete("/:teamId/players/:playerId", auth, adminOnly, async (req, res) => {
  try {
    const updated = await Team.findByIdAndUpdate(
      req.params.teamId,
      { $pull: { players: { _id: req.params.playerId } } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Team not found" });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ message: "Invalid id" });
  }
});

router.post("/transfer", auth, adminOnly, async (req, res) => {
  const { fromTeamId, toTeamId, playerId } = req.body || {};

  if (!fromTeamId || !toTeamId || !playerId) {
    return res.status(400).json({ message: "fromTeamId, toTeamId, playerId required" });
  }

  if (String(fromTeamId) === String(toTeamId)) {
    return res.status(400).json({ message: "Cannot transfer to same team" });
  }

  if (!mongoose.Types.ObjectId.isValid(fromTeamId) || !mongoose.Types.ObjectId.isValid(toTeamId) || !mongoose.Types.ObjectId.isValid(playerId)) {
    return res.status(400).json({ message: "Invalid id" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const toTeamExists = await Team.exists({ _id: toTeamId }).session(session);
    if (!toTeamExists) throw new Error("Destination team not found");

    const fromTeam = await Team.findOne(
      { _id: fromTeamId, "players._id": playerId },
      { "players.$": 1 }
    ).session(session);

    if (!fromTeam || !fromTeam.players || !fromTeam.players.length) {
      throw new Error("Player not found in source team");
    }

    const player = fromTeam.players[0].toObject ? fromTeam.players[0].toObject() : fromTeam.players[0];

    await Team.updateOne(
      { _id: fromTeamId },
      { $pull: { players: { _id: playerId } } }
    ).session(session);

    await Team.updateOne(
      { _id: toTeamId },
      { $push: { players: player } }
    ).session(session);

    await session.commitTransaction();
    session.endSession();

    res.json({ message: "Transfer completed" });
  } catch (e) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ message: e.message });
  }
});

module.exports = router;