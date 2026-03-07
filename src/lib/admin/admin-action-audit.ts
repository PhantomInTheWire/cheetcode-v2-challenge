type AdminActionAuditEntry = {
  action: string;
  actorGithub: string;
  outcome: "succeeded" | "failed";
  request: Record<string, unknown>;
  error?: string;
};

export function recordAdminActionAudit(entry: AdminActionAuditEntry) {
  console.info(
    "[admin-action-audit]",
    JSON.stringify({
      ...entry,
      recordedAt: new Date().toISOString(),
    }),
  );
}
