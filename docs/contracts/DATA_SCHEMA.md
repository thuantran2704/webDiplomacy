# Data Schema

> All database table definitions for the platform.
> `wD_*` = existing webDiplomacy tables (read-only by research services).
> `rs_*` = new research schema (written only by the Data API service).
> Last updated: 2026-07-01.

---

## Existing tables (wD_* — do not modify)

These are the webDiplomacy core tables relevant to research. The Data API reads from them only via the `game/*` API routes — never with direct DB connections from research services.

| Table | Key columns | Research use |
|---|---|---|
| `wD_Orders` | `id, gameID, countryID, unitID, type, toTerrID, fromTerrID, viaConvoy, turn` | All orders (human + AI) |
| `wD_GameMessages` | `id, gameID, fromCountryID, toCountryID, message, timeSent, turn` | All inter-team press messages |
| `wD_Members` | `gameID, userID, countryID, status, orderStatus` | Country seat assignments |
| `wD_ApiKeys` | `apiKey VARCHAR(80), userID` | Bearer token → user mapping |
| `wD_ApiPermissions` | `userID, getStateOfAllGames, submitOrdersForUserInCD` | Per-key permission flags |
| `wD_Games` | `id, variantID, turn, phase, processTime` | Game state and phase |

---

## Research tables (rs_* — owned by Data API)

Migration file: `install/research/rs_schema.sql` (to be created in TASK_1).
Applied once at first boot; never dropped by `npm run setup`.

---

### `rs_participants`

One row per unique participant across all games.

```sql
CREATE TABLE rs_participants (
  id               VARCHAR(36)  NOT NULL,          -- UUID, matches Empirica player ID
  empirica_id      VARCHAR(80)  NOT NULL,
  webdip_user_id   INT          NULL,               -- set if participant has a webDiplomacy account
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_empirica_id (empirica_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

### `rs_consents`

Legal consent record per participant per form version.
Never deleted — withdrawal is recorded by setting `withdrawn_at`.

```sql
CREATE TABLE rs_consents (
  id               INT          NOT NULL AUTO_INCREMENT,
  participant_id   VARCHAR(36)  NOT NULL,
  form_version     VARCHAR(20)  NOT NULL,           -- e.g. "1.0"; bump when form text changes
  consented_at     DATETIME     NOT NULL,
  ip_hash          VARCHAR(64)  NULL,               -- SHA-256(IP), for audit; NULL if not collected
  checkboxes       JSON         NOT NULL,           -- { dataCollection, publications, withdrawal, ageVerified }
  withdrawn_at     DATETIME     NULL,               -- NULL = active consent

  PRIMARY KEY (id),
  KEY idx_participant (participant_id),
  CONSTRAINT fk_consents_participant FOREIGN KEY (participant_id)
    REFERENCES rs_participants (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

`checkboxes` JSON shape (all fields required, all must be `true` for consent to be valid):
```jsonc
{
  "dataCollection": true,
  "publications":   true,
  "withdrawal":     true,
  "ageVerified":    true
}
```

---

### `rs_games`

Links an Empirica game instance to a webDiplomacy game.

```sql
CREATE TABLE rs_games (
  id                INT          NOT NULL AUTO_INCREMENT,
  empirica_game_id  VARCHAR(36)  NOT NULL,
  webdip_game_id    INT          NOT NULL,
  variant_id        INT          NOT NULL DEFAULT 1,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at          DATETIME     NULL,
  config            JSON         NOT NULL DEFAULT (JSON_OBJECT()),  -- snapshot of empirica.json

  PRIMARY KEY (id),
  UNIQUE KEY uq_empirica_game (empirica_game_id),
  KEY idx_webdip_game (webdip_game_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

### `rs_teams`

One row per country per game. Stores team-level config.

```sql
CREATE TABLE rs_teams (
  id                  INT          NOT NULL AUTO_INCREMENT,
  game_id             INT          NOT NULL,
  country_id          INT          NOT NULL,
  country_name        VARCHAR(40)  NOT NULL,
  max_humans          TINYINT      NOT NULL DEFAULT 2,
  intra_chat_enabled  TINYINT(1)   NOT NULL DEFAULT 1,

  PRIMARY KEY (id),
  UNIQUE KEY uq_game_country (game_id, country_id),
  CONSTRAINT fk_teams_game FOREIGN KEY (game_id)
    REFERENCES rs_games (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

### `rs_team_members`

Many-to-many between participants and teams, with role.
A participant may belong to only one team per game.

```sql
CREATE TABLE rs_team_members (
  id               INT          NOT NULL AUTO_INCREMENT,
  team_id          INT          NOT NULL,
  participant_id   VARCHAR(36)  NOT NULL,
  role             ENUM('controller','spectator','bot') NOT NULL DEFAULT 'spectator',
  joined_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  left_at          DATETIME     NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_team_participant (team_id, participant_id),
  KEY idx_participant (participant_id),
  CONSTRAINT fk_members_team FOREIGN KEY (team_id)
    REFERENCES rs_teams (id),
  CONSTRAINT fk_members_participant FOREIGN KEY (participant_id)
    REFERENCES rs_participants (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Invariant:** Exactly one `controller` per team at any time (enforced by Data API, not DB constraint).

---

### `rs_sessions`

Browser session per participant. Used to track connection time and active session count.

```sql
CREATE TABLE rs_sessions (
  id               VARCHAR(36)  NOT NULL,           -- UUID generated by Empirica app on load
  participant_id   VARCHAR(36)  NOT NULL,
  game_id          INT          NULL,
  started_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at         DATETIME     NULL,
  user_agent       VARCHAR(255) NULL,

  PRIMARY KEY (id),
  KEY idx_participant (participant_id),
  KEY idx_game (game_id),
  CONSTRAINT fk_sessions_participant FOREIGN KEY (participant_id)
    REFERENCES rs_participants (id),
  CONSTRAINT fk_sessions_game FOREIGN KEY (game_id)
    REFERENCES rs_games (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

### `rs_events`

Unified event log. Every discrete action from any service is a row here.
See [`EVENT_SCHEMA.md`](./EVENT_SCHEMA.md) for all valid `type` values and `payload` shapes.

```sql
CREATE TABLE rs_events (
  id               BIGINT       NOT NULL AUTO_INCREMENT,
  ts               DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  type             VARCHAR(40)  NOT NULL,
  game_id          INT          NULL,
  participant_id   VARCHAR(36)  NULL,
  team_id          INT          NULL,
  country_id       INT          NULL,
  session_id       VARCHAR(36)  NULL,
  payload          JSON         NOT NULL DEFAULT (JSON_OBJECT()),

  PRIMARY KEY (id),
  KEY idx_type         (type),
  KEY idx_game         (game_id),
  KEY idx_participant  (participant_id),
  KEY idx_team         (team_id),
  KEY idx_ts           (ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Note: Foreign keys are intentionally omitted on `rs_events` so that logging never fails due to referential integrity — log first, reconcile later.

---

### `rs_messages`

All messages: intra-team (Empirica chat) and inter-team (webDiplomacy press, mirrored).

```sql
CREATE TABLE rs_messages (
  id                   BIGINT       NOT NULL AUTO_INCREMENT,
  ts                   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  game_id              INT          NOT NULL,
  scope                ENUM('intra','inter') NOT NULL,
  from_participant_id  VARCHAR(36)  NULL,            -- NULL for bot-generated messages
  from_country_id      INT          NULL,
  to_team_id           INT          NULL,            -- set when scope = 'intra'
  to_country_id        INT          NULL,            -- set when scope = 'inter'
  text                 TEXT         NOT NULL,
  webdip_message_id    INT          NULL,            -- wD_GameMessages.id when scope = 'inter'
  turn                 SMALLINT     NULL,

  PRIMARY KEY (id),
  KEY idx_game    (game_id),
  KEY idx_scope   (scope),
  KEY idx_team    (to_team_id),
  KEY idx_ts      (ts),
  CONSTRAINT fk_messages_game FOREIGN KEY (game_id)
    REFERENCES rs_games (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## Indexes and query patterns

Common queries the Data API must support efficiently:

| Query | Index used |
|---|---|
| All events for a game | `idx_game` on `rs_events` |
| Events by participant | `idx_participant` on `rs_events` |
| Events in time range | `idx_ts` on `rs_events` |
| Messages for a team (intra chat) | `idx_team` + `idx_scope` on `rs_messages` |
| Active controller for a team | `uq_team_participant` + `role = 'controller'` on `rs_team_members` |
| Consent status for participant | `idx_participant` on `rs_consents` |

---

## DB provider abstraction

The Data API connects to the DB via the adapter configured in `DATA_PROVIDER`:

| Provider | Adapter file | Connection |
|---|---|---|
| `mysql` (default) | `src/data/adapters/MySQLAdapter.js` | mysql2, env: `DB_*` |
| `postgres` | `src/data/adapters/PostgresAdapter.js` | pg, env: `PG_*` |
| `supabase` | `src/data/adapters/SupabaseAdapter.js` | @supabase/supabase-js, env: `SUPABASE_*` |

All adapters implement the interface defined in `src/data/IRepository.js`.
SQL DDL above is MariaDB/MySQL syntax; Postgres and Supabase adapters manage their own migrations.
