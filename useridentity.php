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
	libHTML::error(l_t("You can't use the user identity panel, you're using a guest account."));
}

libHTML::starthtml();

print libHTML::pageTitle(l_t('Identity setup'),l_t('Help prevent cheating and get access to advanced features by verifying your identity.'));

print 'Coming soon!';

print '</div>';

libHTML::footer();

die();

if( isset($_REQUEST['userID']) )
{
	$PanelUser = new User((int)$_REQUEST['userID']);
}
else
{
	$PanelUser = $User;
}

require_once('objects/identity.php');
//userIdentity::panel($PanelUser);

libHTML::footer();
