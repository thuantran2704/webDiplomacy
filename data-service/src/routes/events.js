import { Router } from "express";
import db from "../data/index.js";

export const router = Router();

// POST /api/v1/events
router.post("/", async (req, res, next) => {
  try {
    const { type, gameId, participantId, teamId, countryId, sessionId, payload } = req.body;
    if (!type) return res.status(400).json({ error: "type is required", code: "VALIDATION_ERROR" });
    const result = await db.logEvent({
      type,
      gameId:        gameId        != null ? Number(gameId)        : undefined,
      participantId: participantId ?? undefined,
      teamId:        teamId        != null ? Number(teamId)        : undefined,
      countryId:     countryId     != null ? Number(countryId)     : undefined,
      sessionId:     sessionId     ?? undefined,
      payload:       payload       ?? {},
    });
    res.status(201).json(result);
  } catch (err) { next(err); }
});

// GET /api/v1/events
router.get("/", async (req, res, next) => {
  try {
    const { gameId, participantId, type, since, until, limit, offset } = req.query;
    const result = await db.queryEvents({
      gameId:        gameId        ? Number(gameId)  : undefined,
      participantId: participantId ?? undefined,
      type:          type          ?? undefined,
      since:         since         ?? undefined,
      until:         until         ?? undefined,
      limit:         limit         ? Number(limit)   : 100,
      offset:        offset        ? Number(offset)  : 0,
    });
    res.json(result);
  } catch (err) { next(err); }
});
