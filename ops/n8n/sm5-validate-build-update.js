// NSAM SM 5 — Validate + Build Update — HEADER-AUTH VERSION (no embedded secret)
// Authentication is done by the Webhook node (n8n Header Auth credential, header X-NSAM-Admin-Token).
// This node adds (a) a fail-closed sanity check that the header is present, and (b) the sensitive-action locks.
// The five locked actions stay disabled until trusted consent verification exists.

const item = $input.first().json;
const body = item.body || item;
const headers = item.headers || {};

const action = body.action;
const submissionId = body.submissionId;
const p = body.payload || {};
const now = new Date().toISOString();
const deny = (message, status = 401) => [{ json: { _authOk: false, _status: status, _msg: message } }];

// Defense in depth only: if someone ever sets the Webhook authentication to "None", a request with no
// credential header is still refused here. The real check is the n8n Header Auth credential.
if (typeof headers['x-nsam-admin-token'] !== 'string' || headers['x-nsam-admin-token'].length < 1) {
  return deny('Admin authentication not configured or missing.', 401);
}
// A secret must never be accepted in the body any more.
if (body.token !== undefined) {
  return deny('Credentials in the request body are not accepted.', 400);
}
if (typeof submissionId !== 'string' || !submissionId.trim()) {
  return deny('Missing submission ID.', 400);
}
if (!p || typeof p !== 'object' || Array.isArray(p)) {
  return deny('Invalid payload.', 400);
}

const allowedActions = new Set([
  'request_revision', 'mark_needs_consent', 'redraft_caption', 'save_caption',
  'add_analytics', 'save_notes', 'reject'
]);
const lockedActions = new Set([
  'approve', 'mark_ready_schedule', 'mark_scheduled', 'mark_posted', 'send_release_form'
]);
if (lockedActions.has(action)) {
  return deny('Action temporarily disabled pending independent consent and approval verification.', 403);
}
if (!allowedActions.has(action)) {
  return deny('Unsupported admin action.', 400);
}

const out = {
  'Submission ID': submissionId,
  'Updated At': now,
  _authOk: true,
  _action: action,
  _parentEmail: '',
  _studentFirst: '',
  _msg: 'Saved.'
};

switch (action) {
  case 'request_revision':
    out['Current Status'] = 'Needs revision';
    out['Admin Notes'] = p.adminNotes || '';
    out._msg = 'Revision requested.';
    break;
  case 'mark_needs_consent':
    out['Current Status'] = 'Needs consent';
    out._msg = 'Marked needs consent.';
    break;
  case 'redraft_caption':
    out['Current Status'] = 'Caption needed';
    out._msg = 'Caption redraft requested.';
    break;
  case 'save_caption':
    out['Final Caption'] = p.finalCaption || '';
    out['Final Hashtags'] = p.finalHashtags || '';
    out['Current Status'] = 'Ready for review';
    out._msg = 'Caption saved.';
    break;
  case 'add_analytics': {
    const a = p.analytics || {};
    for (const k of ['Likes', 'Comments', 'Views', 'Shares', 'Saves']) {
      out[k] = a[k] ?? '';
    }
    out['Analytics Last Updated At'] = now;
    out._msg = 'Analytics saved.';
    break;
  }
  case 'save_notes':
    out['Admin Notes'] = p.adminNotes || '';
    out._msg = 'Notes saved.';
    break;
  case 'reject':
    out['Current Status'] = 'Rejected';
    out['Approval Status'] = 'Rejected';
    out['Admin Notes'] = p.adminNotes || '';
    out._msg = 'Rejected.';
    break;
  default:
    return deny('Unsupported admin action.', 400);
}
return [{ json: out }];
