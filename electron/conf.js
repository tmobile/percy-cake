const fs = require('fs');
const path = require('path');

// Electron app does not need cors-proxy, delete it
const confFile = path.join(__dirname, 'dist/percy.conf.json');
const json = JSON.parse(fs.readFileSync(confFile, { encoding: 'utf8' }));
delete json.corsProxy;
fs.writeFileSync(confFile, JSON.stringify(json, null, 2));
