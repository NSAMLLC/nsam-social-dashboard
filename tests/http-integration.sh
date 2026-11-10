#!/usr/bin/env bash
# curl tests against an ISOLATED local n8n with the fictional workflows from build-fixtures.js. Usage: http-integration.sh <good-secret> <old-secret>
GOOD="$1"; OLD="$2"; B=http://127.0.0.1:5678/webhook; O=https://nsamllc.github.io; f=0
chk(){ if [ "$2" = "$3" ]; then echo "PASS $1"; else echo "FAIL $1 (got $2 want $3)"; f=$((f+1)); fi; }
code(){ curl -s -o /dev/null -w '%{http_code}' "$@"; }
J='Content-Type: application/json'
for w in test-sm-admin-action test-sm-admin-list; do
  chk "$w preflight 204 without credential" "$(code -X OPTIONS $B/$w -H "Origin: $O" -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: content-type,x-nsam-admin-token')" 204
  h=$(curl -s -i -X OPTIONS $B/$w -H "Origin: $O" -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: content-type,x-nsam-admin-token' | tr -d '\r')
  echo "$h" | grep -qi '^access-control-allow-headers:.*x-nsam-admin-token' && echo "PASS $w preflight allows custom header" || { echo "FAIL $w preflight header"; f=$((f+1)); }
  echo "$h" | grep -qi "^access-control-allow-origin: $O" && echo "PASS $w preflight echoes allowed origin" || { echo "FAIL $w preflight origin"; f=$((f+1)); }
  chk "$w no header -> 403" "$(code -X POST $B/$w -H "$J" -d '{}')" 403
  chk "$w wrong secret -> 403" "$(code -X POST $B/$w -H "$J" -H 'X-NSAM-Admin-Token: WRONG' -d '{}')" 403
  chk "$w OLD secret -> 403" "$(code -X POST $B/$w -H "$J" -H "X-NSAM-Admin-Token: $OLD" -d '{}')" 403
  chk "$w old body-token style -> 403" "$(code -X POST $B/$w -H "$J" -d "{\"token\":\"$GOOD\"}")" 403
  chk "$w secret in query string only -> 403" "$(code -X POST "$B/$w?X-NSAM-Admin-Token=$GOOD" -H "$J" -d '{}')" 403
done
A=$B/test-sm-admin-action
chk "action: new secret accepted" "$(code -X POST $A -H "$J" -H "X-NSAM-Admin-Token: $GOOD" -d '{"action":"save_notes","submissionId":"F1","payload":{}}')" 200
chk "list: new secret accepted" "$(code -X POST $B/test-sm-admin-list -H "$J" -H "X-NSAM-Admin-Token: $GOOD" -d '{}')" 200
for a in approve mark_ready_schedule mark_scheduled mark_posted send_release_form; do
  chk "lock $a -> 403 with valid secret" "$(code -X POST $A -H "$J" -H "X-NSAM-Admin-Token: $GOOD" -d "{\"action\":\"$a\",\"submissionId\":\"F1\",\"payload\":{}}")" 403; done
echo; [ $f -eq 0 ] && echo "ALL PASSED" || echo "$f FAILED"; exit $f
