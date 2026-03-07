import { AppProviders } from "@/components/providers/AppProviders";
import { getServerSession } from "@/lib/session/server-session";

export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();

  return <AppProviders session={session}>{children}</AppProviders>;
}
