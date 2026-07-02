<?php
defined('IN_CODE') or die('This script can not be run by itself.');

/**
 * API entry team/controller
 * Admin-only: reassigns the controller role within a team.
 * Requires getStateOfAllGames permission with permissionIsExplicit (admin key).
 */
class AssignTeamController extends ApiEntry {
    public function __construct() {
        parent::__construct('team/controller', 'JSON', 'getStateOfAllGames', ['gameID', 'countryID', 'participantID']);
    }

    public function run($userID, $permissionIsExplicit) {
        if (!$permissionIsExplicit)
            throw new ClientForbiddenException('Admin permission (getStateOfAllGames) required to reassign controller.');

        $args          = $this->getArgs();
        $gameID        = (int) ($args['gameID'] ?? 0);
        $countryID     = (int) ($args['countryID'] ?? 0);
        $participantID = $args['participantID'] ?? '';

        if (!$gameID)              throw new RequestException('gameID is required.');
        if (!$countryID)           throw new RequestException('countryID is required.');
        if ($participantID === '')  throw new RequestException('participantID is required.');

        // Resolve team for this country
        $teamsResp = dataApiCall('GET', '/api/v1/teams?gameId=' . $gameID);
        if ($teamsResp['status'] !== 200)
            throw new ServerInternalException('Data API error fetching teams.');
        $team = null;
        foreach ($teamsResp['body']['teams'] ?? [] as $t) {
            if ((int) $t['countryId'] === $countryID) { $team = $t; break; }
        }
        if (!$team)
            throw new RequestException('No team for countryID ' . $countryID . ' in game ' . $gameID . '.');

        // Verify participantID is an active member of this team
        $isMember = false;
        foreach ($team['members'] ?? [] as $m) {
            if ($m['participantId'] === $participantID && (!isset($m['leftAt']) || $m['leftAt'] === null)) {
                $isMember = true;
                break;
            }
        }
        if (!$isMember)
            throw new RequestException('participantID is not an active member of this team.');

        // Reassign via Data API
        $ctrlResp = dataApiCall('PATCH', '/api/v1/teams/' . $team['id'] . '/controller', [
            'participantId' => $participantID,
        ]);
        if ($ctrlResp['status'] !== 200)
            throw new ServerInternalException('Data API error reassigning controller (HTTP ' . $ctrlResp['status'] . ').');

        $result = $ctrlResp['body'];

        // Log event (best-effort)
        dataApiCall('POST', '/api/v1/events', [
            'type'      => 'role.changed',
            'gameId'    => $gameID,
            'teamId'    => $team['id'],
            'countryId' => $countryID,
            'payload'   => array_merge($result, ['changedBy' => 'admin']),
        ]);

        return json_encode([
            'previous' => $result['previousControllerId'],
            'next'     => $result['newControllerId'],
        ]);
    }
}
