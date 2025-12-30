Changelog
---------

1.72 was a rolling update without much control, this change rolls everything up into a new install.

* Memcached is no longer required, but Redis is required. Run FLUSHDB in Redis after applying this update.
* PHP 8.4 is the default version instead of 7.4. This does cause breaking changes to variants, as there have been syntax changes.

- 