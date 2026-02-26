#!/bin/sh
# Conway Automagotchi Installer — thin wrapper
# curl -fsSL https://conway.tech/automagotchi.sh | sh
set -e
git clone https://github.com/Conway-Research/automagotchi.git /opt/automagotchi
cd /opt/automagotchi
npm install && npm run build
exec node dist/index.js --run
