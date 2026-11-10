#!/usr/bin/env bash
# Runs ONE configuration on a FRESH isolated local n8n and reports whether the fictional secret was persisted in execution history.
# usage: exec-history-protection.sh <label> '<json workflow settings or {}>' ; env: N8N_BIN, NODE24_BIN, SCRATCH
set -u
LABEL="$1"; SETTINGS="$2"; S="$SCRATCH"; HOME_DIR="$S/home-$LABEL"; rm -rf "$HOME_DIR"; mkdir -p "$HOME_DIR"
export PATH="$NODE24_BIN:$PATH" N8N_USER_FOLDER="$HOME_DIR" N8N_DIAGNOSTICS_ENABLED=false N8N_PORT=5678 N8N_LISTEN_ADDRESS=127.0.0.1 N8N_SECURE_COOKIE=false N8N_RUNNERS_ENABLED=false N8N_VERSION_NOTIFICATIONS_ENABLED=false N8N_PERSONALIZATION_ENABLED=false
${EXTRA_ENV:-:}
FX="$S/fx-$LABEL"; rm -rf "$FX"; TEST_WF_SETTINGS="$SETTINGS" node "$(dirname "$0")/n8n-local/build-fixtures.js" "$FX" >/dev/null
for a in "import:credentials --input=$FX/credA.json" "import:workflow --input=$FX/errwf.json" "import:workflow --input=$FX/wf1.json" "import:workflow --input=$FX/wf2.json" "import:workflow --input=$FX/wf3.json" "publish:workflow --id=TESTSM5ACTION0001" "publish:workflow --id=TESTSMLIST000001" "publish:workflow --id=TESTSMBOOM000001"; do node "$N8N_BIN" $a >/dev/null 2>&1; done
(nohup node "$N8N_BIN" start > "$S/run-$LABEL.log" 2>&1 &)
for i in $(seq 1 40); do sleep 3; [ "$(curl -s -m 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:5678/healthz)" = 200 ] && break; done; sleep 3
SEC=FICTIONAL-TEST-SECRET-ALPHA; B=http://127.0.0.1:5678/webhook; J='Content-Type: application/json'
r(){ curl -s -o /dev/null -w '%{http_code}' -X POST "$@"; }
c1=$(r $B/test-sm-admin-action -H "$J" -H "X-NSAM-Admin-Token: $SEC" -d '{"action":"save_notes","submissionId":"F1","payload":{}}')
c2=$(r $B/test-sm-admin-action -H "$J" -H "X-NSAM-Admin-Token: $SEC" -d '{"action":"approve","submissionId":"F1","payload":{}}')
c3=$(r $B/test-sm-admin-list -H "$J" -H "X-NSAM-Admin-Token: $SEC" -d '{}')
c4=$(r $B/test-sm-boom -H "$J" -H "X-NSAM-Admin-Token: $SEC" -d '{}')
c5=$(r $B/test-sm-admin-action -H "$J" -H "X-NSAM-Admin-Token: WRONG" -d '{}')
sleep ${WAIT:-4}; pkill -f "n8n start"; sleep 2
python3 - "$HOME_DIR/.n8n/database.sqlite" "$LABEL" "$c1/$c2/$c3/$c4/$c5" <<'PY'
import sqlite3,sys
c=sqlite3.connect(sys.argv[1])
rows=c.execute("select e.workflowId,e.status,d.data from execution_entity e left join execution_data d on d.executionId=e.id").fetchall()
leak=[(w,st) for w,st,d in rows if d and 'FICTIONAL-TEST-SECRET' in d]
print(f"{sys.argv[2]:22} http(action,locked,list,boom,wrong)={sys.argv[3]}  executions_saved={len(rows)}  executions_containing_secret={len(leak)}  by={sorted(set(leak))}")
PY
