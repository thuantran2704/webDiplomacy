import { Router } from "express";
import db from "../data/index.js";
import { publish } from "../redis.js";

export const router = Router();

// POST /api/v1/messages
router.post("/", async (req, res, next) => {
  try {
    const { gameId, scope, fromParticipantId, fromCountryId, toTeamId, toCountryId, text, webdipMessageId, turn } = req.body;
    if (!gameId || !scope || !text)
      return res.status(400).json({ error: "gameId, scope and text are required", code: "VALIDATION_ERROR" });
    if (!["intra", "inter"].includes(scope))
      return res.status(400).json({ error: "scope must be 'intra' or 'inter'", code: "VALIDATION_ERROR" });
    if (scope === "intra" && !toTeamId)
      return res.status(400).json({ error: "toTeamId is required for intra-team messages", code: "VALIDATION_ERROR" });

    const result = await db.saveMessage({
      gameId: Number(gameId), scope,
      fromParticipantId: fromParticipantId ?? null,
      fromCountryId:     fromCountryId     ? Number(fromCountryId) : null,
      toTeamId:          toTeamId          ? Number(toTeamId)      : null,
      toCountryId:       toCountryId       ? Number(toCountryId)   : null,
      text,
      webdipMessageId:   webdipMessageId   ? Number(webdipMessageId) : null,
      turn:              turn              ? Number(turn)            : null,
    });

    // Real-time push for intra-team messages
    if (scope === "intra") {
      await publish(Number(gameId), "intra-message", {
        teamId:            Number(toTeamId),
        messageId:         result.id,
        fromParticipantId: fromParticipantId ?? null,
        text,
        ts:                new Date().toISOString(),
      });
    }

    res.status(201).json(result);
  } catch (err) { next(err); }
});

// GET /api/v1/messages
router.get("/", async (req, res, next) => {
  try {
    const { gameId, scope, teamId, since, limit, offset } = req.query;
    if (!gameId) return res.status(400).json({ error: "gameId is required", code: "VALIDATION_ERROR" });
    const result = await db.queryMessages({
      gameId: Number(gameId),
      scope:  scope  ?? undefined,
      teamId: teamId ? Number(teamId) : undefined,
      since:  since  ?? undefined,
      limit:  limit  ? Number(limit)  : 100,
      offset: offset ? Number(offset) : 0,
    });
    res.json(result);
  } catch (err) { next(err); }
});
