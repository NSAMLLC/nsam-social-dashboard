/* =====================================================================
   NSAM Social Media Intake & Approval Dashboard — CONFIG
   ---------------------------------------------------------------------
   Edit this ONE file after you set up n8n. Both index.html (teacher)
   and admin.html (admin) read from it.

   SECURITY NOTES (read before publishing to GitHub):
   - It is OK for these webhook URLs to be public. They are just endpoints.
   - DO NOT put any Google credentials, n8n API keys, or the admin
     password in this file. The admin password is NEVER stored here; it
     is typed by the admin at login and verified by n8n Header Auth (sent as a request header).
   - All privileged actions (approve, schedule, post) are validated
     server-side in n8n using a shared secret the admin types in.
   ===================================================================== */
window.NSAM_CONFIG = {
  // 1) Your n8n base URL (no trailing slash). Pre-filled with your instance.
  N8N_BASE_URL: "https://nsam.app.n8n.cloud",

  // 2) Webhook paths — these match the n8n workflows that were built.
  //    Only change these if you rename the webhook nodes in n8n.
  WEBHOOKS: {
    intake:      "/webhook/nsam-sm-intake",       // Workflow 1: Teacher Submission Intake
    status:      "/webhook/nsam-sm-status",        // Teacher status lookup
    adminList:   "/webhook/nsam-sm-admin-list",    // Admin: load submissions
    adminAction: "/webhook/nsam-sm-admin-action"   // Workflow 5: Admin Dashboard Actions
  },

  // Name of the request header that carries the admin secret (n8n Header Auth).
  // The header NAME is not secret; the VALUE is typed at login and never stored.
  ADMIN_AUTH_HEADER: "X-NSAM-Admin-Token",

  // 3) Dropdown values (kept in sync with the Settings tab of the Sheet)
  CONTENT_TYPES: [
    "Photo", "Video", "Audio", "Recital clip", "Lesson clip",
    "Student achievement text", "Other"
  ],
  PUBLIC_DISPLAY: [
    "First name only", "Initials only", "No name", "Other / needs review"
  ],
  CONSENT_SITUATIONS: [
    "Parent needs release form",
    "Parent already signed / likely on file",
    "Adult student / no parent needed",
    "No identifiable student",
    "Unsure"
  ],
  PLATFORMS: ["Instagram", "Facebook Page", "Facebook Group", "YouTube"],
  APPROVERS: ["Michael", "Danny"],

  // 4) Status vocabulary (must match the Sheet + n8n)
  STATUSES: [
    "Submitted", "Needs consent", "Caption needed", "Ready for review",
    "Approved", "Needs revision", "Scheduled", "Posted", "Rejected"
  ]
};
