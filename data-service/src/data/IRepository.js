/**
 * IRepository — JSDoc interface for all Data API database operations.
 * Every adapter (MySQL, Postgres, Supabase) must implement all methods below.
 * Method signatures are the contract; adapters throw NotImplementedError for unimplemented methods.
 */

export class IRepository {
  // ── Participants ────────────────────────────────────────────────────────────

  /** @returns {Promise<{ id: string }>} */
  async createParticipant(empiricaId) { throw new Error("not implemented"); }

  /** @returns {Promise<object|null>} */
  async getParticipant(id) { throw new Error("not implemented"); }

  // ── Consents ────────────────────────────────────────────────────────────────

  /**
   * @param {{ participantId: string, formVersion: string, checkboxes: object, ipHash?: string }} opts
   * @returns {Promise<{ id: number }>}
   */
  async recordConsent(opts) { throw new Error("not implemented"); }

  // ── Games ───────────────────────────────────────────────────────────────────

  /**
   * @param {{ empiricaGameId: string, webdipGameId: number, variantId: number, config: object }} opts
   * @returns {Promise<{ id: number }>}
   */
  async createGame(opts) { throw new Error("not implemented"); }

  // ── Teams ───────────────────────────────────────────────────────────────────

  /**
   * @param {{ gameId: number, countryId: number, countryName: string, maxHumans: number, intraChatEnabled: boolean }} opts
   * @returns {Promise<{ id: number }>}
   */
  async createTeam(opts) { throw new Error("not implemented"); }

  /**
   * @param {number} teamId
   * @returns {Promise<object|null>} Team with members[]
   */
  async getTeam(teamId) { throw new Error("not implemented"); }

  /**
   * @param {{ gameId: number }} opts
   * @returns {Promise<object[]>} All teams with members[] for a game
   */
  async getTeamsByGame(gameId) { throw new Error("not implemented"); }

  /**
   * @param {{ teamId: number, participantId: string, role: string }} opts
   * @returns {Promise<{ id: number }>}
   */
  async addTeamMember(opts) { throw new Error("not implemented"); }

  /**
   * Atomically demote current controller → spectator, promote target → controller.
   * @param {number} teamId
   * @param {string} participantId  new controller's UUID
   * @returns {Promise<{ previousControllerId: string, newControllerId: string }>}
   */
  async setController(teamId, participantId) { throw new Error("not implemented"); }

  /**
   * @param {number} teamId
   * @param {boolean} enabled
   * @returns {Promise<void>}
   */
  async setIntraChat(teamId, enabled) { throw new Error("not implemented"); }

  // ── Events ──────────────────────────────────────────────────────────────────

  /**
   * @param {{ type: string, gameId?: number, participantId?: string, teamId?: number, countryId?: number, sessionId?: string, payload?: object }} opts
   * @returns {Promise<{ id: bigint }>}
   */
  async logEvent(opts) { throw new Error("not implemented"); }

  /**
   * @param {{ gameId?: number, participantId?: string, type?: string, since?: string, until?: string, limit?: number, offset?: number }} opts
   * @returns {Promise<{ events: object[], total: number }>}
   */
  async queryEvents(opts) { throw new Error("not implemented"); }

  // ── Messages ────────────────────────────────────────────────────────────────

  /**
   * @param {{ gameId: number, scope: string, fromParticipantId?: string, fromCountryId?: number, toTeamId?: number, toCountryId?: number, text: string, webdipMessageId?: number, turn?: number }} opts
   * @returns {Promise<{ id: bigint }>}
   */
  async saveMessage(opts) { throw new Error("not implemented"); }

  /**
   * @param {{ gameId: number, scope?: string, teamId?: number, since?: string, limit?: number, offset?: number }} opts
   * @returns {Promise<{ messages: object[], total: number }>}
   */
  async queryMessages(opts) { throw new Error("not implemented"); }
}
