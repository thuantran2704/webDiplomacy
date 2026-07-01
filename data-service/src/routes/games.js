import { Router } from "express";
import db from "../data/index.js";

export const router = Router();

// POST /api/v1/games
router.post("/", async (req, res, next) => {
  try {
    const { empiricaGameId, webdipGameId, variantId, config } = req.body;
    if (!empiricaGameId || !webdipGameId)
      return res.status(400).json({ error: "empiricaGameId and webdipGameId are required", code: "VALIDATION_ERROR" });
    const result = await db.createGame({ empiricaGameId, webdipGameId: Number(webdipGameId), variantId: Number(variantId) || 1, config: config ?? {} });
    res.status(201).json(result);
  } catch (err) { next(err); }
});
