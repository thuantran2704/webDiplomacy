// Thin client for webDiplomacy api.php (Bearer auth). Routes verified against api.php.
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
export const getData = (gameID, countryID) =>
  call("GET", "game/data", { gameID, countryID });
export const getMessages = (gameID, countryID, sinceTime = 0) =>
  call("GET", "game/getmessages", { gameID, countryID, sinceTime });
export const sendMessage = (gameID, countryID, toCountryID, message) =>
  call("POST", "game/sendmessage", {}, { gameID, countryID, toCountryID, message });
export const setOrders = (gameID, turn, phase, countryID, orders, ready = "Yes") =>
  call("POST", "game/orders", {}, { gameID, turn, phase, countryID, orders, ready });
