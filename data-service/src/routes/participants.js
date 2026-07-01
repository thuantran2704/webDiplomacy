import { Router } from "express";
import db from "../data/index.js";
import { ConflictError } from "../errors.js";

export const router = Router();

// POST /api/v1/participants
router.post("/", async (req, res, next) => {
  try {
    const { empiricaPlayerId } = req.body;
    if (!empiricaPlayerId) return res.status(400).json({ error: "empiricaPlayerId is required", code: "VALIDATION_ERROR" });
    const result = await db.createParticipant(empiricaPlayerId);
    res.status(201).json(result);
  } catch (err) {
    if (err.code === "DUPLICATE_PARTICIPANT") return res.status(409).json({ error: err.message, code: err.code });
    next(err);
  }
});

// GET /api/v1/participants/:id
router.get("/:id", async (req, res, next) => {
  try {
    const p = await db.getParticipant(req.params.id);
    if (!p) return res.status(404).json({ error: "Participant not found", code: "NOT_FOUND" });
    res.json(p);
  } catch (err) { next(err); }
});
