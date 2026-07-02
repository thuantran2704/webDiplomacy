<?php
defined('IN_CODE') or die('This script can not be run by itself.');

/**
 * API entry team/roster
 * Returns all teams and their members for a given game.
 * Requires getStateOfAllGames permission (admin/bot key).
 */
class GetTeamRoster extends ApiEntry {
    public function __construct() {
        parent::__construct('team/roster', 'GET', 'getStateOfAllGames', ['gameID']);
    }

    public function run($userID, $permissionIsExplicit) {
        $args   = $this->getArgs();
        $gameID = (int) ($args['gameID'] ?? 0);
        if (!$gameID) throw new RequestException('gameID is required.');

        $resp = dataApiCall('GET', '/api/v1/teams?gameId=' . $gameID);
        if ($resp['status'] !== 200)
            throw new ServerInternalException('Data API error fetching teams (HTTP ' . $resp['status'] . ').');

        $teams = array_map(function ($team) {
            $activeMembers = array_filter(
                $team['members'] ?? [],
                fn($m) => !isset($m['leftAt']) || $m['leftAt'] === null
            );
            return [
                'countryID'        => $team['countryId'],
                'countryName'      => $team['countryName'],
                'intraChatEnabled' => $team['intraChatEnabled'] ?? false,
                'members'          => array_values(array_map(fn($m) => [
                    'participantId' => $m['participantId'],
                    'role'          => $m['role'],
                    'joinedAt'      => $m['joinedAt'],
                ], $activeMembers)),
            ];
        }, $resp['body']['teams'] ?? []);

        return json_encode(['gameID' => $gameID, 'teams' => array_values($teams)]);
    }
}
