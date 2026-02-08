const express = require("express");
const Match = require("../models/Match");
const { auth, adminOnly } = require("../middleware/auth");

const router = express.Router();

router.post("/", auth, adminOnly, async (req, res) => {
  try {
    const match = await Match.create(req.body);
    res.status(201).json(match);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const matches = await Match.find()
      .sort({ date: -1 });
    res.json(matches);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ message: "Match not found" });
    res.json(match);
  } catch {
    res.status(400).json({ message: "Invalid id" });
  }
});

router.put("/:id", auth, adminOnly, async (req, res) => {
  try {
    const updated = await Match.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ message: "Match not found" });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.delete("/:id", auth, adminOnly, async (req, res) => {
  try {
    const deleted = await Match.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Match not found" });
    res.json({ message: "Match deleted" });
  } catch {
    res.status(400).json({ message: "Invalid id" });
  }
});

router.post("/:id/events", auth, adminOnly, async (req, res) => {
  try {
    const { type, minute, teamId, playerName, assistName, note } = req.body;

    if (!type || minute === undefined || !teamId) {
      return res.status(400).json({ message: "type, minute, teamId are required" });
    }

    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ message: "Match not found" });

    const isHome = String(match.homeTeamId) === String(teamId);
    const isAway = String(match.awayTeamId) === String(teamId);
    if (!isHome && !isAway) {
      return res.status(400).json({ message: "teamId does not belong to this match" });
    }

    match.events.push({
      type,
      minute,
      teamId,
      playerName: playerName || "",
      assistName: assistName || "",
      note: note || ""
    });

    if (type === "goal") {
      if (isHome) match.scoreHome += 1;
      else match.scoreAway += 1;
    }

    await match.save();
    res.json(match);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.delete("/:id/events/:eventId", auth, adminOnly, async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ message: "Match not found" });

    const ev = (match.events || []).find(x => String(x._id) === String(req.params.eventId));
    if (!ev) return res.status(404).json({ message: "Event not found" });

    if (ev.type === "goal") {
      const isHome = String(match.homeTeamId) === String(ev.teamId);
      if (isHome) match.scoreHome = Math.max(0, (match.scoreHome || 0) - 1);
      else match.scoreAway = Math.max(0, (match.scoreAway || 0) - 1);
    }

    match.events = (match.events || []).filter(x => String(x._id) !== String(req.params.eventId));
    await match.save();

    res.json(match);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

module.exports = router;