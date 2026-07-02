// Shared client for the internal Data API (:4000).
// Never call fetch directly from components — use these exports.
// VITE_DATA_API_KEY is an internal research platform token (not internet-accessible).

const BASE_URL = import.meta.env?.VITE_DATA_API_URL ?? "http://localhost:4000";
const API_KEY  = import.meta.env?.VITE_DATA_API_KEY  ?? "";

async function post(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
    },
    body: JSON.stringify(body),
  });
  // 409 (already exists — e.g. returning participant) is allowed through
  if (!res.ok && res.status !== 409) {
    throw new Error(`Data API ${path} → ${res.status}`);
  }
  return { status: res.status, data: await res.json() };
}

export const createParticipant = (empiricaPlayerId) =>
  post("/api/v1/participants", { empiricaPlayerId });

export const saveConsent = ({ participantId, formVersion, checkboxes, ipHash = null }) =>
  post("/api/v1/consents", {
    participantId,
    formVersion,
    checkboxes,
    ...(ipHash ? { ipHash } : {}),
  });

export const logEvent = (payload) =>
  post("/api/v1/events", payload);
