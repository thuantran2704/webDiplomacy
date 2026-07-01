import { Router } from "express";
import db from "../data/index.js";
import { publish } from "../redis.js";

export const router = Router();

// POST /api/v1/teams
router.post("/", async (req, res, next) => {
  try {
    const { gameId, countryId, countryName, maxHumans, intraChatEnabled } = req.body;
    if (!gameId || !countryId || !countryName)
      return res.status(400).json({ error: "gameId, countryId and countryName are required", code: "VALIDATION_ERROR" });
    const result = await db.createTeam({
      gameId: Number(gameId), countryId: Number(countryId), countryName,
      maxHumans: Number(maxHumans) || 2,
      intraChatEnabled: intraChatEnabled !== false,
    });
    res.status(201).json(result);
  } catch (err) { next(err); }
});

// GET /api/v1/teams?gameId=
router.get("/", async (req, res, next) => {
  try {
    const { gameId } = req.query;
    if (!gameId) return res.status(400).json({ error: "gameId query param is required", code: "VALIDATION_ERROR" });
    const teams = await db.getTeamsByGame(Number(gameId));
    res.json({ gameId: Number(gameId), teams });
  } catch (err) { next(err); }
});

// GET /api/v1/teams/:teamId
router.get("/:teamId", async (req, res, next) => {
  try {
    const team = await db.getTeam(Number(req.params.teamId));
    if (!team) return res.status(404).json({ error: "Team not found", code: "NOT_FOUND" });
    res.json(team);
  } catch (err) { next(err); }
});

// POST /api/v1/teams/:teamId/members
router.post("/:teamId/members", async (req, res, next) => {
  try {
    const { participantId, role } = req.body;
    if (!participantId) return res.status(400).json({ error: "participantId is required", code: "VALIDATION_ERROR" });
    const result = await db.addTeamMember({ teamId: Number(req.params.teamId), participantId, role: role ?? "spectator" });

    // Notify via SSE
    const team = await db.getTeam(Number(req.params.teamId));
    if (team) await publish(team.gameId, "participant-joined", { teamId: team.id, participantId, role: role ?? "spectator" });

    res.status(201).json(result);
  } catch (err) { next(err); }
});

// PATCH /api/v1/teams/:teamId/controller
router.patch("/:teamId/controller", async (req, res, next) => {
  try {
    const { participantId } = req.body;
    if (!participantId) return res.status(400).json({ error: "participantId is required", code: "VALIDATION_ERROR" });
    const result = await db.setController(Number(req.params.teamId), participantId);

    // Notify via SSE
    const team = await db.getTeam(Number(req.params.teamId));
    if (team) await publish(team.gameId, "role-changed", { teamId: team.id, ...result });

    res.json(result);
  } catch (err) { next(err); }
});

// PATCH /api/v1/teams/:teamId/intra-chat
router.patch("/:teamId/intra-chat", async (req, res, next) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== "boolean")
      return res.status(400).json({ error: "enabled (boolean) is required", code: "VALIDATION_ERROR" });
    await db.setIntraChat(Number(req.params.teamId), enabled);

    // Notify via SSE
    const team = await db.getTeam(Number(req.params.teamId));
    if (team) await publish(team.gameId, "intra-chat-toggled", { teamId: team.id, enabled });

    res.json({ teamId: Number(req.params.teamId), intraChatEnabled: enabled });
  } catch (err) { next(err); }
});
