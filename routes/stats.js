const express = require("express");
const mongoose = require("mongoose");
const Match = require("../models/Match");
const Team = require("../models/Team");

const router = express.Router();

router.get("/leaderboard", async (req, res) => {
  try {
    const pipeline = [
      { $match: { status: "finished" } },
      {
        $project: {
          rows: [
            { teamId: "$homeTeamId", gf: "$scoreHome", ga: "$scoreAway" },
            { teamId: "$awayTeamId", gf: "$scoreAway", ga: "$scoreHome" }
          ]
        }
      },
      { $unwind: "$rows" },
      {
        $addFields: {
          teamId: "$rows.teamId",
          gf: "$rows.gf",
          ga: "$rows.ga",
          win: { $cond: [{ $gt: ["$rows.gf", "$rows.ga"] }, 1, 0] },
          draw: { $cond: [{ $eq: ["$rows.gf", "$rows.ga"] }, 1, 0] },
          loss: { $cond: [{ $lt: ["$rows.gf", "$rows.ga"] }, 1, 0] }
        }
      },
      {
        $group: {
          _id: "$teamId",
          played: { $sum: 1 },
          wins: { $sum: "$win" },
          draws: { $sum: "$draw" },
          losses: { $sum: "$loss" },
          goalsFor: { $sum: "$gf" },
          goalsAgainst: { $sum: "$ga" }
        }
      },
      {
        $addFields: {
          points: { $add: [{ $multiply: ["$wins", 3] }, "$draws"] },
          goalDiff: { $subtract: ["$goalsFor", "$goalsAgainst"] }
        }
      },
      { $sort: { points: -1, goalDiff: -1, goalsFor: -1 } },
      {
        $lookup: {
          from: "teams",
          localField: "_id",
          foreignField: "_id",
          as: "team"
        }
      },
      { $unwind: "$team" },
      {
        $project: {
          _id: 0,
          teamId: "$team._id",
          teamName: "$team.name",
          played: 1,
          wins: 1,
          draws: 1,
          losses: 1,
          goalsFor: 1,
          goalsAgainst: 1,
          goalDiff: 1,
          points: 1
        }
      }
    ];

    const table = await Match.aggregate(pipeline);
    res.json(table);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/top-teams", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "10", 10), 50);
    const order = (req.query.order || "desc").toLowerCase() === "asc" ? 1 : -1;

    const teams = await Team.find({}, { name: 1, rating: 1, country: 1, league: 1, logoUrl: 1 })
      .sort({ rating: order, name: 1 })
      .limit(limit);

    res.json(teams);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/players", async (req, res) => {
  try {
    const sortFieldRaw = String(req.query.sort || "rating");
    const orderRaw = String(req.query.order || "desc").toLowerCase();

    const allowed = new Set(["rating", "goals", "assists", "matches", "name"]);
    const sortField = allowed.has(sortFieldRaw) ? sortFieldRaw : "rating";
    const order = orderRaw === "asc" ? 1 : -1;

    const pipeline = [
      { $unwind: "$players" },
      {
        $project: {
          teamId: "$_id",
          teamName: "$name",
          playerId: "$players._id",
          name: "$players.name",
          position: "$players.position",
          matches: { $ifNull: ["$players.matches", 0] },
          goals: { $ifNull: ["$players.goals", 0] },
          assists: { $ifNull: ["$players.assists", 0] },
          rating: { $ifNull: ["$players.rating", 0] }
        }
      },
      { $sort: { [sortField]: order, name: 1 } },
      { $limit: 500 }
    ];

    const players = await Team.aggregate(pipeline);
    res.json(players);
  } catch (e) {
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/transfer", async (req, res) => {
  res.status(404).json({ message: "Use /api/teams/transfer" });
});

module.exports = router;