<?php
defined('IN_CODE') or die('This script can not be run by itself.');

/**
 * API entry team/message
 * Saves an intra-team message to the Data API.
 * Requires getStateOfAllGames permission.
 */
class SendIntraTeamMessage extends ApiEntry {
    const MAX_TEXT_LENGTH = 2000;

    public function __construct() {
        parent::__construct('team/message', 'JSON', 'getStateOfAllGames', ['gameID', 'fromCountryID', 'text']);
    }

    public function run($userID, $permissionIsExplicit) {
        $args          = $this->getArgs();
        $gameID        = (int) ($args['gameID'] ?? 0);
        $fromCountryID = (int) ($args['fromCountryID'] ?? 0);
        $text          = trim($args['text'] ?? '');

        if (!$gameID)        throw new RequestException('gameID is required.');
        if (!$fromCountryID) throw new RequestException('fromCountryID is required.');
        if ($text === '')    throw new RequestException('text must not be empty.');
        if (strlen($text) > self::MAX_TEXT_LENGTH)
            throw new RequestException('text exceeds ' . self::MAX_TEXT_LENGTH . ' characters.');

        // Resolve the team for this country via Data API
        $teamsResp = dataApiCall('GET', '/api/v1/teams?gameId=' . $gameID);
        if ($teamsResp['status'] !== 200)
            throw new ServerInternalException('Data API error fetching teams.');
        $team = null;
        foreach ($teamsResp['body']['teams'] ?? [] as $t) {
            if ((int) $t['countryId'] === $fromCountryID) { $team = $t; break; }
        }
        if (!$team)
            throw new RequestException('No team for countryID ' . $fromCountryID . ' in game ' . $gameID . '.');

        // Save message
        $msgResp = dataApiCall('POST', '/api/v1/messages', [
            'gameId'            => $gameID,
            'scope'             => 'intra',
            'fromParticipantId' => null,
            'fromCountryId'     => $fromCountryID,
            'toTeamId'          => $team['id'],
            'text'              => $text,
        ]);
        if ($msgResp['status'] !== 201)
            throw new ServerInternalException('Data API error saving message (HTTP ' . $msgResp['status'] . ').');

        $messageId = $msgResp['body']['id'];

        // Log event (best-effort — don't fail the request on event write errors)
        dataApiCall('POST', '/api/v1/events', [
            'type'      => 'message.sent',
            'gameId'    => $gameID,
            'teamId'    => $team['id'],
            'countryId' => $fromCountryID,
            'payload'   => [
                'scope'           => 'intra',
                'toTeamId'        => $team['id'],
                'toCountryId'     => null,
                'text'            => $text,
                'turn'            => null,
                'webdipMessageId' => null,
            ],
        ]);

        return json_encode(['id' => $messageId]);
    }
}
