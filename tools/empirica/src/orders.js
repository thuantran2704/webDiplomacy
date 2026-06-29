/**
 * Order schema, validation, and prompt helpers — derived from api.php SetOrders + api/responses/order.php.
 * All terrIDs come from game/data response `units` and `territories` arrays.
 *
 * Order object sent to game/orders:
 *   { terrID, type, fromTerrID, toTerrID, viaConvoy, countryID, convoyPath? }
 *
 * Valid types per phase:
 *   Diplomacy : Hold | Move | Support hold | Support move | Convoy
 *   Retreats  : Retreat | Disband
 *   Builds    : Build Army | Build Fleet | Destroy | Wait
 */

export const ORDER_TYPES = {
  Diplomacy: ["Hold", "Move", "Support hold", "Support move", "Convoy"],
  Retreats:  ["Retreat", "Disband"],
  Builds:    ["Build Army", "Build Fleet", "Destroy", "Wait"],
};

const REQUIRES_TO   = new Set(["Move", "Support hold", "Support move", "Convoy", "Retreat"]);
const REQUIRES_FROM = new Set(["Support move", "Convoy"]);

/**
 * Validate and sanitize AI output orders against the current board state.
 * Returns { valid: Order[], errors: string[] }
 * @param {object[]} aiOrders - Raw orders from LLM
 * @param {string}   phase    - "Diplomacy" | "Retreats" | "Builds"
 * @param {number}   countryID
 * @param {object[]} units    - from game/data response
 */
export function validateOrders(aiOrders, phase, countryID, units) {
  const errors = [];
  const valid = [];
  const validTypes = new Set(ORDER_TYPES[phase] ?? []);
  const unitTerrIDs = new Set(units.filter(u => u.countryID === countryID).map(u => u.terrID));

  if (!Array.isArray(aiOrders)) {
    errors.push("orders must be an array");
    return { valid: [], errors };
  }

  for (const o of aiOrders) {
    const e = [];

    if (!validTypes.has(o.type))
      e.push(`invalid type "${o.type}" for phase ${phase}`);
    if (o.terrID == null)
      e.push("missing terrID");
    if (REQUIRES_TO.has(o.type) && o.toTerrID == null)
      e.push(`type "${o.type}" requires toTerrID`);
    if (REQUIRES_FROM.has(o.type) && o.fromTerrID == null)
      e.push(`type "${o.type}" requires fromTerrID`);
    if (phase !== "Builds" && o.terrID != null && !unitTerrIDs.has(Number(o.terrID)))
      e.push(`terrID ${o.terrID} is not a unit for country ${countryID}`);

    if (e.length) {
      errors.push(`order ${JSON.stringify(o)}: ${e.join("; ")}`);
    } else {
      valid.push({
        terrID:     o.terrID   != null ? Number(o.terrID)    : null,
        type:       o.type,
        fromTerrID: o.fromTerrID != null ? Number(o.fromTerrID) : null,
        toTerrID:   o.toTerrID != null ? Number(o.toTerrID)   : null,
        viaConvoy:  o.viaConvoy ?? null,
        countryID:  Number(o.countryID ?? countryID),
        ...(o.convoyPath ? { convoyPath: o.convoyPath } : {}),
      });
    }
  }
  return { valid, errors };
}

/**
 * Build the prompt describing the board to the LLM.
 * Includes full order schema so the model knows every required field.
 */
export function buildPrompt({ status, units, territoryStatuses, currentOrders, messages, countryID }) {
  const phase = status?.phase ?? "Diplomacy";
  return JSON.stringify({
    instructions: {
      format: "Reply ONLY with valid JSON matching the schema below. No markdown, no prose.",
      schema: {
        orders: ORDER_TYPES[phase],
        orderFields: {
          terrID: "int — territory where YOUR unit stands (from myUnits)",
          type:   `one of: ${ORDER_TYPES[phase].join(" | ")}`,
          toTerrID:   "int — destination (required for: Move, Support hold, Support move, Convoy, Retreat)",
          fromTerrID: "int — source unit to support/convoy (required for: Support move, Convoy)",
          viaConvoy:  "bool or null",
          countryID:  `int — always ${countryID}`,
        },
        messages: [{ to: "int — target countryID (0=global)", text: "string" }],
      },
    },
    myCountryID: countryID,
    phase,
    turn: status?.turn,
    myUnits: units.filter(u => u.countryID === countryID),
    allUnits: units,
    territoryStatuses,
    currentOrders,
    recentMessages: messages,
  });
}
