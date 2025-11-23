UPDATE `wD_Misc` SET `value` = '180' WHERE `name` = 'Version';


-- No longer worth keeping this column as an enum with so many values, convert to a varchar:
ALTER TABLE `wD_Misc` CHANGE `Name` `Name` VARCHAR(100) NOT NULL;

INSERT INTO wD_Misc (`Name`,`Value`) VALUES ('LastBotGameCleanup',0);
INSERT INTO wD_Misc (`Name`,`Value`) VALUES ('LastReliabilityRatingsUpdate',0);
INSERT INTO wD_Misc (`Name`,`Value`) VALUES ('LastTidyWatchedGamesUpdate',0);
INSERT INTO wD_Misc (`Name`,`Value`) VALUES ('LastUserConnectionsUpdate',0);
INSERT INTO wD_Misc (`Name`,`Value`) VALUES ('LastPointsCheckUpdate',0);
INSERT INTO wD_Misc (`Name`,`Value`) VALUES ('LastMemberIDChecked',0);
INSERT INTO wD_Misc (`Name`,`Value`) VALUES ('SandboxGamesActive',0);
INSERT INTO wD_Misc (`Name`,`Value`) VALUES ('BotGamesActiveNoPress_Anonymous',0);
INSERT INTO wD_Misc (`Name`,`Value`) VALUES ('BotGamesActiveNoPress',0);
INSERT INTO wD_Misc (`Name`,`Value`) VALUES ('BotGamesActiveFvA',0);
INSERT INTO wD_Misc (`Name`,`Value`) VALUES ('BotGamesActiveFullPress',0);

ALTER TABLE `webdiplomacy`.`wD_BotGameQueue` ADD UNIQUE `gameID` (`gameID`);

DROP TABLE `wD_Backup_Log`;

CREATE TABLE `wD_Backup_Log` (
  `gameID` mediumint(8) UNSIGNED NOT NULL,
  `timestamp` bigint(20) UNSIGNED NOT NULL DEFAULT 0,
  `isExported` tinyint(3) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB;

ALTER TABLE `wD_Backup_Log`
  ADD PRIMARY KEY (`gameID`),
  ADD KEY `timestamp` (`timestamp`);
