<?php
/*
    Copyright (C) 2004-2010 Kestas J. Kuliukas

	This file is part of webDiplomacy.

    webDiplomacy is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    webDiplomacy is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with webDiplomacy.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * @package Base
 * @subpackage Forms
 */

// Staging test commit

require_once('header.php');

require_once(l_r('objects/mailer.php'));

if(!$User->type['User'])
{
	libHTML::error(l_t("You can't use the user notifications panel, you're using a guest account."));
}

libHTML::starthtml();

print libHTML::pageTitle(l_t('Notifications setup'),l_t('Configure whether and how you want notifications to be sent to you.'));

/**
 * - Notifications
  * => Game related:
 * - They are about to NMR
 * - They have NMR'd and have a grace period
 * - They have NMR'd and have no grace period, and have left the game, affecting your reliability
 * - You have new messages/press
 * - A turn has progressed and you have orders to enter
 * - A game has completed
 * - You have been defeated in a game
 * - A vote has passed in a game
 * - A vote has been called in a game
 * - A moderator/gamemaster has changed a game: turn extension, pause/unpause, delay, etc
 * - A civil disorder position just opened up
 * - A player went into civil disorder
 * - A player has taken over a civil disorder position
 * 
 * => Moderator related:
 * - A moderator has replied to your support request
 * - A moderator sent you a message
 * - A moderator changed your account: reliability reset/points change/ban lift/ban/etc
 * - You have been asked to provide more user verification information: Social media link, SMS message, paypal/patreon
 * 
 * => Relationship related:
 * - A player has added you to a relationship
 * - A relationship has been updated
 * - A moderator is requesting input on a relationship
 * 
 * => Bot game related:
 * - Your full-press slot has opened up
 * - Your full-press slot has been taken by another player
 * - You are going to lose your full-press game due to inactivity
 * 
 */
print 'Coming soon!';

print '</div>';

libHTML::footer();

die();

require_once('objects/notifications.php');
//userIdentity::panel($PanelUser);


libHTML::footer();
