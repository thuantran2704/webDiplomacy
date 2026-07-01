import mysql from "mysql2/promise";
import { v4 as uuidv4 } from "uuid";
import { IRepository } from "../IRepository.js";
import { ConflictError, NotFoundError, ValidationError } from "../../errors.js";

export class MySQLAdapter extends IRepository {
  constructor() {
    super();
    this.pool = mysql.createPool({
      host:     process.env.DB_HOST     ?? "127.0.0.1",
      port:     Number(process.env.DB_PORT) || 3306,
      user:     process.env.DB_USER     ?? "webdiplomacy",
      password: process.env.DB_PASS     ?? "",
      database: process.env.DB_NAME     ?? "webdiplomacy",
      waitForConnections: true,
      connectionLimit: 10,
    });
  }

  // ── Participants ────────────────────────────────────────────────────────────

  async createParticipant(empiricaId) {
    const id = uuidv4();
    try {
      await this.pool.execute(
        "INSERT INTO rs_participants (id, empirica_id) VALUES (?, ?)",
        [id, empiricaId]
      );
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") {
        const [rows] = await this.pool.execute(
          "SELECT id FROM rs_participants WHERE empirica_id = ?", [empiricaId]
        );
        if (rows.length) throw Object.assign(
          new ConflictError("Participant already exists", "DUPLICATE_PARTICIPANT"),
          { existingId: rows[0].id }
        );
      }
      throw err;
    }
    return { id };
  }

  async getParticipant(id) {
    const [rows] = await this.pool.execute(
      "SELECT id, empirica_id, webdip_user_id, created_at FROM rs_participants WHERE id = ?",
      [id]
    );
    if (!rows.length) return null;
    const r = rows[0];
    return { id: r.id, empiricaPlayerId: r.empirica_id, webdipUserId: r.webdip_user_id, createdAt: r.created_at };
  }

  // ── Consents ────────────────────────────────────────────────────────────────

  async recordConsent({ participantId, formVersion, checkboxes, ipHash }) {
    const required = ["dataCollection", "publications", "withdrawal", "ageVerified"];
    for (const k of required) {
      if (!checkboxes[k]) throw new ValidationError(`Checkbox '${k}' must be true`);
    }
    const [result] = await this.pool.execute(
      `INSERT INTO rs_consents (participant_id, form_version, consented_at, ip_hash, checkboxes)
       VALUES (?, ?, NOW(), ?, ?)`,
      [participantId, formVersion, ipHash ?? null, JSON.stringify(checkboxes)]
    );
    return { id: result.insertId };
  }

  // ── Games ───────────────────────────────────────────────────────────────────

  async createGame({ empiricaGameId, webdipGameId, variantId = 1, config = {} }) {
    const [result] = await this.pool.execute(
      `INSERT INTO rs_games (empirica_game_id, webdip_game_id, variant_id, config)
       VALUES (?, ?, ?, ?)`,
      [empiricaGameId, webdipGameId, variantId, JSON.stringify(config)]
    );
    return { id: result.insertId };
  }

  // ── Teams ───────────────────────────────────────────────────────────────────

  async createTeam({ gameId, countryId, countryName, maxHumans = 2, intraChatEnabled = true }) {
    const [result] = await this.pool.execute(
      `INSERT INTO rs_teams (game_id, country_id, country_name, max_humans, intra_chat_enabled)
       VALUES (?, ?, ?, ?, ?)`,
      [gameId, countryId, countryName, maxHumans, intraChatEnabled ? 1 : 0]
    );
    return { id: result.insertId };
  }

  async getTeam(teamId) {
    const [teams] = await this.pool.execute(
      `SELECT id, game_id, country_id, country_name, max_humans, intra_chat_enabled
       FROM rs_teams WHERE id = ?`,
      [teamId]
    );
    if (!teams.length) return null;
    const t = teams[0];
    const members = await this._getMembers(teamId);
    return {
      id: t.id, gameId: t.game_id, countryId: t.country_id,
      countryName: t.country_name, maxHumans: t.max_humans,
      intraChatEnabled: !!t.intra_chat_enabled, members,
    };
  }

  async getTeamsByGame(gameId) {
    const [teams] = await this.pool.execute(
      `SELECT id, game_id, country_id, country_name, max_humans, intra_chat_enabled
       FROM rs_teams WHERE game_id = ?`,
      [gameId]
    );
    return Promise.all(teams.map(async t => ({
      id: t.id, gameId: t.game_id, countryId: t.country_id,
      countryName: t.country_name, maxHumans: t.max_humans,
      intraChatEnabled: !!t.intra_chat_enabled,
      members: await this._getMembers(t.id),
    })));
  }

  async _getMembers(teamId) {
    const [rows] = await this.pool.execute(
      `SELECT id, participant_id, role, joined_at, left_at
       FROM rs_team_members WHERE team_id = ?`,
      [teamId]
    );
    return rows.map(r => ({
      id: r.id, participantId: r.participant_id,
      role: r.role, joinedAt: r.joined_at, leftAt: r.left_at,
    }));
  }

  async addTeamMember({ teamId, participantId, role = "spectator" }) {
    // Enforce maxHumans for human roles
    if (role !== "bot") {
      const [team] = await this.pool.execute(
        "SELECT max_humans FROM rs_teams WHERE id = ?", [teamId]
      );
      if (!team.length) throw new NotFoundError("Team not found", "TEAM_NOT_FOUND");
      const [count] = await this.pool.execute(
        "SELECT COUNT(*) AS n FROM rs_team_members WHERE team_id = ? AND left_at IS NULL AND role != 'bot'",
        [teamId]
      );
      if (count[0].n >= team[0].max_humans) {
        throw new ConflictError("Team is full", "TEAM_FULL");
      }
    }
    try {
      const [result] = await this.pool.execute(
        "INSERT INTO rs_team_members (team_id, participant_id, role) VALUES (?, ?, ?)",
        [teamId, participantId, role]
      );
      return { id: result.insertId };
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") throw new ConflictError("Participant already assigned", "ALREADY_ASSIGNED");
      throw err;
    }
  }

  async setController(teamId, participantId) {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();

      // Verify target is a member of this team
      const [member] = await conn.execute(
        "SELECT id FROM rs_team_members WHERE team_id = ? AND participant_id = ? AND left_at IS NULL",
        [teamId, participantId]
      );
      if (!member.length) throw new NotFoundError("Participant is not an active member of this team", "NOT_A_MEMBER");

      // Get current controller
      const [current] = await conn.execute(
        "SELECT participant_id FROM rs_team_members WHERE team_id = ? AND role = 'controller' AND left_at IS NULL",
        [teamId]
      );
      const previousControllerId = current[0]?.participant_id ?? null;

      // Demote old controller → spectator
      if (previousControllerId) {
        await conn.execute(
          "UPDATE rs_team_members SET role = 'spectator' WHERE team_id = ? AND role = 'controller'",
          [teamId]
        );
      }

      // Promote new controller
      await conn.execute(
        "UPDATE rs_team_members SET role = 'controller' WHERE team_id = ? AND participant_id = ?",
        [teamId, participantId]
      );

      await conn.commit();
      return { previousControllerId, newControllerId: participantId };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async setIntraChat(teamId, enabled) {
    const [result] = await this.pool.execute(
      "UPDATE rs_teams SET intra_chat_enabled = ? WHERE id = ?",
      [enabled ? 1 : 0, teamId]
    );
    if (result.affectedRows === 0) throw new NotFoundError("Team not found", "TEAM_NOT_FOUND");
  }

  // ── Events ──────────────────────────────────────────────────────────────────

  async logEvent({ type, gameId, participantId, teamId, countryId, sessionId, payload = {} }) {
    const [result] = await this.pool.execute(
      `INSERT INTO rs_events (type, game_id, participant_id, team_id, country_id, session_id, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [type, gameId ?? null, participantId ?? null, teamId ?? null,
       countryId ?? null, sessionId ?? null, JSON.stringify(payload)]
    );
    return { id: result.insertId };
  }

  async queryEvents({ gameId, participantId, type, since, until, limit = 100, offset = 0 } = {}) {
    const where = [];
    const params = [];
    if (gameId       != null) { where.push("game_id = ?");        params.push(gameId); }
    if (participantId)        { where.push("participant_id = ?"); params.push(participantId); }
    if (type)                 { where.push("type = ?");           params.push(type); }
    if (since)                { where.push("ts >= ?");            params.push(since); }
    if (until)                { where.push("ts <= ?");            params.push(until); }

    const safeLimit  = Math.min(Number(limit)  || 100, 1000);
    const safeOffset = Number(offset) || 0;
    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [[{ total }]] = await this.pool.execute(
      `SELECT COUNT(*) AS total FROM rs_events ${whereClause}`, params
    );
    const [events] = await this.pool.execute(
      `SELECT id, ts, type, game_id, participant_id, team_id, country_id, session_id, payload
       FROM rs_events ${whereClause} ORDER BY ts DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, safeLimit, safeOffset]
    );
    return {
      events: events.map(e => ({ ...e, payload: e.payload })),
      total: Number(total),
    };
  }

  // ── Messages ────────────────────────────────────────────────────────────────

  async saveMessage({ gameId, scope, fromParticipantId, fromCountryId, toTeamId, toCountryId, text, webdipMessageId, turn }) {
    if (!text || text.trim().length === 0) throw new ValidationError("Message text cannot be empty");
    if (text.length > 2000) throw new ValidationError("Message too long (max 2000 chars)");
    const [result] = await this.pool.execute(
      `INSERT INTO rs_messages
         (game_id, scope, from_participant_id, from_country_id, to_team_id, to_country_id, text, webdip_message_id, turn)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [gameId, scope, fromParticipantId ?? null, fromCountryId ?? null,
       toTeamId ?? null, toCountryId ?? null, text,
       webdipMessageId ?? null, turn ?? null]
    );
    return { id: result.insertId };
  }

  async queryMessages({ gameId, scope, teamId, since, limit = 100, offset = 0 } = {}) {
    const where = ["game_id = ?"];
    const params = [gameId];
    if (scope)  { where.push("scope = ?");       params.push(scope); }
    if (teamId) { where.push("to_team_id = ?");  params.push(teamId); }
    if (since)  { where.push("ts >= ?");          params.push(since); }

    const safeLimit  = Math.min(Number(limit)  || 100, 1000);
    const safeOffset = Number(offset) || 0;
    const whereClause = `WHERE ${where.join(" AND ")}`;

    const [[{ total }]] = await this.pool.execute(
      `SELECT COUNT(*) AS total FROM rs_messages ${whereClause}`, params
    );
    const [messages] = await this.pool.execute(
      `SELECT id, ts, game_id, scope, from_participant_id, from_country_id,
              to_team_id, to_country_id, text, webdip_message_id, turn
       FROM rs_messages ${whereClause} ORDER BY ts ASC, id ASC LIMIT ? OFFSET ?`,
      [...params, safeLimit, safeOffset]
    );
    return { messages, total: Number(total) };
  }
}

export default new MySQLAdapter();
