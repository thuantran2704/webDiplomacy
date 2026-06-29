// AI provider abstraction: local Ollama or hosted OpenAI-compatible API.
// Prompt is already fully structured by orders.js buildPrompt(); system role stays minimal.
const SYSTEM = "You are a Diplomacy AI. Follow the instructions in the user message exactly. " +
  "Reply ONLY with valid JSON — no markdown, no prose.";

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
        { role: "user",   content: prompt },
      ],
    }),
  });
  const body = await res.json();
  if (body.error) throw new Error(`Ollama: ${body.error}`);
  return JSON.parse(body.message.content);
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
        { role: "user",   content: prompt },
      ],
    }),
  });
  const body = await res.json();
  if (body.error) throw new Error(`LLM API: ${JSON.stringify(body.error)}`);
  return JSON.parse(body.choices[0].message.content);
}

export function decide(prompt) {
  return process.env.AI_PROVIDER === "api" ? hostedApi(prompt) : ollama(prompt);
}
