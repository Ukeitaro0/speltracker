#!/bin/sh
# Sätter nytt versionsnummer före varje uppladdning: BUILD i index.html, ?v= på css/js (så att webbläsaren
# inte blandar gamla och nya filer) och version.json (som får öppna appar att ladda om sig).
B=$(date +%Y%m%d-%H%M)
sed -i "s/const BUILD = '[^']*';/const BUILD = '$B';/; s/?v=[0-9-]*\"/?v=$B\"/g" index.html
printf '{ "build": "%s" }\n' "$B" > version.json
echo "$B"
