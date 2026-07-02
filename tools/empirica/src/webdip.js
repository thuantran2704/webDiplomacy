// Thin client for webDiplomacy api.php (Bearer auth). Routes verified against api.php.
// NOTE: routes that use JSONResponse() return { msg, success, referenceCode, data: {...} }.
//       getData and getMessages unwrap .data so callers see flat objects/arrays.
const base = () => process.env.WEBDIP_BASE_URL.replace(/\/$/, "");
const key = () => process.env.WEBDIP_API_KEY;

async function call(method, route, params = {}, body) {
  const url = new URL(`${base()}/api.php`);
  url.searchParams.set("route", route);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${key()}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${route} ${res.status}: ${await res.text()}`);
  return res.json();
}

export const getStatus = (gameID, countryID) =>
  call("GET", "game/status", { gameID, countryID });

// game/data wraps payload in { data: { units, territoryStatuses, ... } } via JSONResponse()
export const getData = async (gameID, countryID) => {
  const res = await call("GET", "game/data", { gameID, countryID });
  return res.data ?? res; // unwrap JSONResponse envelope
};

// game/getmessages wraps payload in { data: { messages: [], time, newMessagesFrom } }
export const getMessages = async (gameID, countryID, sinceTime = 0) => {
  const res = await call("GET", "game/getmessages", { gameID, countryID, sinceTime });
  return res.data?.messages ?? res; // return the messages array directly
};

export const sendMessage = (gameID, countryID, toCountryID, message) =>
  call("POST", "game/sendmessage", {}, { gameID, countryID, toCountryID, message });

export const setOrders = (gameID, turn, phase, countryID, orders, ready = "Yes") =>
  call("POST", "game/orders", {}, { gameID, turn, phase, countryID, orders, ready });

// Used by SSE auth flow (Empirica board iframe connects to SSE server)
export const sseAuthenticate = (gameID, channelName) =>
  call("POST", "sse/authentication", {}, { gameID, channel_name: channelName });

// Used by TASK 2: assign a webdip user to a game seat
export const joinGame = (gameID) =>
  call("POST", "game/join", {}, { gameID });
