-- Research schema (rs_*) — applied once at first boot by npm run setup
-- Never drop these tables in production.
-- All writes go through the Data API service only.

CREATE TABLE IF NOT EXISTS rs_participants (
  id               VARCHAR(36)  NOT NULL,
  empirica_id      VARCHAR(80)  NOT NULL,
  webdip_user_id   INT          NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_empirica_id (empirica_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rs_consents (
  id               INT          NOT NULL AUTO_INCREMENT,
  participant_id   VARCHAR(36)  NOT NULL,
  form_version     VARCHAR(20)  NOT NULL,
  consented_at     DATETIME     NOT NULL,
  ip_hash          VARCHAR(64)  NULL,
  checkboxes       JSON         NOT NULL,
  withdrawn_at     DATETIME     NULL,

  PRIMARY KEY (id),
  KEY idx_participant (participant_id),
  CONSTRAINT fk_consents_participant FOREIGN KEY (participant_id)
    REFERENCES rs_participants (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rs_games (
  id                INT          NOT NULL AUTO_INCREMENT,
  empirica_game_id  VARCHAR(36)  NOT NULL,
  webdip_game_id    INT          NOT NULL,
  variant_id        INT          NOT NULL DEFAULT 1,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at          DATETIME     NULL,
  config            JSON         NOT NULL DEFAULT (JSON_OBJECT()),

  PRIMARY KEY (id),
  UNIQUE KEY uq_empirica_game (empirica_game_id),
  KEY idx_webdip_game (webdip_game_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rs_teams (
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

CREATE TABLE IF NOT EXISTS rs_team_members (
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

CREATE TABLE IF NOT EXISTS rs_sessions (
  id               VARCHAR(36)  NOT NULL,
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

CREATE TABLE IF NOT EXISTS rs_events (
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

CREATE TABLE IF NOT EXISTS rs_messages (
  id                   BIGINT       NOT NULL AUTO_INCREMENT,
  ts                   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  game_id              INT          NOT NULL,
  scope                ENUM('intra','inter') NOT NULL,
  from_participant_id  VARCHAR(36)  NULL,
  from_country_id      INT          NULL,
  to_team_id           INT          NULL,
  to_country_id        INT          NULL,
  text                 TEXT         NOT NULL,
  webdip_message_id    INT          NULL,
  turn                 SMALLINT     NULL,

  PRIMARY KEY (id),
  KEY idx_game    (game_id),
  KEY idx_scope   (scope),
  KEY idx_team    (to_team_id),
  KEY idx_ts      (ts),
  CONSTRAINT fk_messages_game FOREIGN KEY (game_id)
    REFERENCES rs_games (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
