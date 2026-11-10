// Builds ISOLATED local-test workflows for a throwaway n8n instance (fictional credential, stubbed sheet/email nodes).
// The Webhook node settings and the Code node source are the exact artifacts proposed for production.
const fs = require('fs'), path = require('path');
const out = process.argv[2];
const root = path.join(__dirname, '..', '..');
const code = fs.readFileSync(path.join(root, 'ops/n8n/sm5-validate-build-update.js'), 'utf8');
const ifNode = JSON.parse(fs.readFileSync(path.join(root, 'ops/n8n/admin-list-header-check.json'), 'utf8')).parameters;
const cred = { httpHeaderAuth: { id: 'TESTCRED00000001', name: 'TEST NSAM Admin Header' } };
const origins = process.env.TEST_ALLOWED_ORIGINS || 'https://nsamllc.github.io';
const hook = (name, p) => ({ id: name + '-id', name, type: 'n8n-nodes-base.webhook', typeVersion: 2.1, position: [0, 0],
  webhookId: 'aaaaaaaa-0000-4000-8000-' + p.padEnd(12, '0').slice(0, 12),
  parameters: { httpMethod: 'POST', path: p, authentication: 'headerAuth', responseMode: 'responseNode', options: { allowedOrigins: origins } },
  credentials: cred });
const respond = (name, status, body) => ({ id: name + '-id', name, type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.5, position: [900, 0],
  parameters: { respondWith: 'json', responseBody: body, options: { responseCode: status } } });
const isAuth = { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 1 },
  conditions: [{ id: 'c1', leftValue: '={{ $json._authOk }}', operator: { type: 'boolean', operation: 'true' }, rightValue: '' }], combinator: 'and' }, options: {} };
const wf1 = { id: 'TESTSM5ACTION0001', name: 'TEST SM5 admin action (isolated)', active: false, settings: { executionOrder: 'v1' },
  nodes: [hook('Admin Action Webhook', 'test-sm-admin-action'),
    { id: 'c', name: 'Validate + Build Update', type: 'n8n-nodes-base.code', typeVersion: 2, position: [224, 0], parameters: { jsCode: code } },
    { id: 'a', name: 'Authorized?', type: 'n8n-nodes-base.if', typeVersion: 2.3, position: [448, 0], parameters: isAuth },
    { id: 's', name: 'STUB Upsert Submission Row', type: 'n8n-nodes-base.noOp', typeVersion: 1, position: [672, -96], parameters: {} },
    respond('Respond OK', 200, '={ "ok": true, "message": "{{ $("Validate + Build Update").item.json._msg }}" }'),
    respond('Respond Denied', '={{ $json._status || 401 }}', '={ "ok": false, "message": "{{ $json._msg }}" }')],
  connections: { 'Admin Action Webhook': { main: [[{ node: 'Validate + Build Update', type: 'main', index: 0 }]] },
    'Validate + Build Update': { main: [[{ node: 'Authorized?', type: 'main', index: 0 }]] },
    'Authorized?': { main: [[{ node: 'STUB Upsert Submission Row', type: 'main', index: 0 }], [{ node: 'Respond Denied', type: 'main', index: 0 }]] },
    'STUB Upsert Submission Row': { main: [[{ node: 'Respond OK', type: 'main', index: 0 }]] } } };
const wf2 = { id: 'TESTSMLIST000001', name: 'TEST SM admin list (isolated)', active: false, settings: { executionOrder: 'v1' },
  nodes: [hook('Admin List Webhook', 'test-sm-admin-list'),
    { id: 'v', name: 'Valid Token?', type: 'n8n-nodes-base.if', typeVersion: 2.3, position: [224, 0], parameters: ifNode },
    { id: 'r', name: 'STUB Read Submissions', type: 'n8n-nodes-base.code', typeVersion: 2, position: [448, -96], parameters: { jsCode: "return [{json:{submissions:[{'Submission ID':'FICTIONAL-1'}]}}];" } },
    respond('Respond Rows', 200, '={{ JSON.stringify($json) }}'),
    respond('Respond Denied', 401, '{ "ok": false, "message": "Invalid admin token." }')],
  connections: { 'Admin List Webhook': { main: [[{ node: 'Valid Token?', type: 'main', index: 0 }]] },
    'Valid Token?': { main: [[{ node: 'STUB Read Submissions', type: 'main', index: 0 }], [{ node: 'Respond Denied', type: 'main', index: 0 }]] },
    'STUB Read Submissions': { main: [[{ node: 'Respond Rows', type: 'main', index: 0 }]] } } };
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'wf1.json'), JSON.stringify([wf1]));
fs.writeFileSync(path.join(out, 'wf2.json'), JSON.stringify([wf2]));
const mk = (v) => JSON.stringify([{ id: 'TESTCRED00000001', name: 'TEST NSAM Admin Header', type: 'httpHeaderAuth', data: { name: 'X-NSAM-Admin-Token', value: v } }]);
fs.writeFileSync(path.join(out, 'credA.json'), mk('FICTIONAL-TEST-SECRET-ALPHA'));
fs.writeFileSync(path.join(out, 'credB.json'), mk('FICTIONAL-TEST-SECRET-BRAVO'));
