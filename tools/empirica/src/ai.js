// AI provider abstraction: local Ollama or hosted OpenAI-compatible API.
const SYSTEM = "You are a Diplomacy AI player. Given the board state and recent messages, " +
  "reply ONLY with JSON: { \"orders\": [...], \"messages\": [{\"to\": <countryID>, \"text\": \"...\"}] }.";

async function ollama(prompt) {
  const res = await fetch(`${process.env.OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OLLAMA_MODEL,
      stream: false,
      format: "json",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
      ],
    }),
  });
  return JSON.parse((await res.json()).message.content);
}

async function hostedApi(prompt) {
  const res = await fetch(`${process.env.LLM_API_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
      ],
    }),
  });
  return JSON.parse((await res.json()).choices[0].message.content);
}

export function decide(prompt) {
  return process.env.AI_PROVIDER === "api" ? hostedApi(prompt) : ollama(prompt);
}
