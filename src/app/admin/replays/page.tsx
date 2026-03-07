import { AdminReplayDashboard } from "@/components/admin/AdminReplayDashboard";
import { requireAdminPageGithub } from "@/lib/auth/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminReplaysPage() {
  const github = await requireAdminPageGithub();
  return <AdminReplayDashboard adminGithub={github} />;
}
