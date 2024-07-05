Samsung Frame Connect
=====================

API for interfacing with Samsung "The Frame" TV's.

Features:
 * Upload custom art
 * Programmatically switch art display
 * Change TV settings

Supported models:
 * QN32LS03CBF (2024)
 * May work with other models

_Note: This is an unofficial library and not supported or endorsed by Samsung_

Requirements
------------

 * Node 18+

Installation
------------

### As a Library

```
npm install samsung-frame-connect
```

### As a standalone tool

1. Clone repository
2. Install dependencies: `npm install`
3. Run CLI tool: `./run.js --help`

License
-------

MIT

Thanks
------

Big thanks to [xschwarze](https://github.com/xchwarze) and [Matthew Garrett](https://github.com/mjg59), who did much of the reverse engineering in their python lib [`samsung-tv-ws-api`](https://github.com/xchwarze/samsung-tv-ws-api).

Much credit also goes to [Nick Waterton](https://github.com/NickWaterton) who adapted the above library to work for more recent models in [his fork](https://github.com/NickWaterton/samsung-tv-ws-api).
