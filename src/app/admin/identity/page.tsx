import { AdminIdentityDashboard } from "@/components/admin/AdminIdentityDashboard";
import { requireAdminPageGithub } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminIdentityPage() {
  const github = await requireAdminPageGithub();
  return <AdminIdentityDashboard adminGithub={github} />;
}
