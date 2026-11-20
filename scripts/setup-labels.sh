#!/usr/bin/env bash
# The label taxonomy the triage brief reasons with. Idempotent: `--force` updates
# the colour and description of an existing label instead of failing.
set -euo pipefail

gh label create needs-info    --color FBCA04 --description "Waiting on the reporter for information" --force
gh label create confirmed     --color 0E8A16 --description "Reproduced, or the code path is proven" --force
gh label create fixed-in-dev  --color 1D76DB --description "Fixed on develop, not yet released" --force
gh label create area/provider --color C5DEF5 --description "Jellyfin, Emby, Plex or TMDB adapter" --force
gh label create area/ui       --color C5DEF5 --description "Deck, card, sheet, settings" --force
gh label create area/deploy   --color C5DEF5 --description "Docker, compose, base path, hosts" --force

echo "labels ready"
