#!/bin/bash
# pull.sh — fetch every public feed Mission Control bakes from. Usage: ./pull.sh [GW_IN_PLAY]   then: node bake.js
A="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"; E=3546875; D=279275; L=46148; T0=$(date +%s)
g(){ curl -s -m 30 --retry 3 --retry-delay 2 --retry-all-errors -A "$A" "$1" -o "$2.tmp"; if head -c 1 "$2.tmp" | grep -q '[{[]'; then mv "$2.tmp" "$2"; else rm -f "$2.tmp"; echo "  miss $2"; fi; }
g https://fantasy.premierleague.com/api/bootstrap-static/ bootstrap.json
# the gameweek in play is read from the feed itself unless one is given: the latest event whose deadline has passed
GW=${1:-$(python3 -c "import json,datetime as d;b=json.load(open('bootstrap.json'));n=d.datetime.now(d.timezone.utc).isoformat();print(max([e['id'] for e in b['events'] if e['deadline_time']<=n] or [1]))")}
echo "gameweek in play: $GW"
g https://fantasy.premierleague.com/api/fixtures/ fixtures.json
g https://fantasy.premierleague.com/api/event-status/ evstatus.json
g https://fantasy.premierleague.com/api/entry/$E/ entry.json
g https://fantasy.premierleague.com/api/entry/$E/history/ history.json
g https://fantasy.premierleague.com/api/entry/$E/transfers/ transfers.json
for k in $(seq 1 $GW); do g https://fantasy.premierleague.com/api/entry/$E/event/$k/picks/ picks$k.json; g https://fantasy.premierleague.com/api/event/$k/live/ live$k.json; g https://draft.premierleague.com/api/event/$k/live dlive$k.json; g https://draft.premierleague.com/api/entry/$D/event/$k d_picks$k.json; done
g https://draft.premierleague.com/api/bootstrap-static dbootstrap.json
g https://draft.premierleague.com/api/game d_game.json
g https://draft.premierleague.com/api/entry/$D/public dentry.json
g https://draft.premierleague.com/api/league/$L/details d_details.json
g https://draft.premierleague.com/api/league/$L/element-status d_status.json
g https://draft.premierleague.com/api/draft/league/$L/transactions d_tx.json
# every rival's saved eleven for the gameweek in play (public once the deadline passes)
for id in $(python3 -c "import json;print(' '.join(str(e['entry_id']) for e in json.load(open('d_details.json'))['league_entries']))"); do g https://draft.premierleague.com/api/entry/$id/event/$GW d_rival_${id}_$GW.json; done
# private classic mini-leagues (page 1 is enough for the leader and the pack around you)
for id in $(python3 -c "import json;print(' '.join(str(l['id']) for l in json.load(open('entry.json'))['leagues']['classic'] if l['league_type']=='x' and l.get('rank_count')))"); do g "https://fantasy.premierleague.com/api/leagues-classic/$id/standings/" lg_$id.json; done
echo "pulled $(ls *.json | wc -l) feeds at $(date -u +%H:%MZ) in $(( $(date +%s) - T0 ))s"
