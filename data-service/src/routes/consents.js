import { Router } from "express";
import db from "../data/index.js";

export const router = Router();

// POST /api/v1/consents
router.post("/", async (req, res, next) => {
  try {
    const { participantId, formVersion, checkboxes, ipHash } = req.body;
    if (!participantId || !formVersion || !checkboxes)
      return res.status(400).json({ error: "participantId, formVersion and checkboxes are required", code: "VALIDATION_ERROR" });
    const result = await db.recordConsent({ participantId, formVersion, checkboxes, ipHash });
    res.status(201).json(result);
  } catch (err) { next(err); }
});
