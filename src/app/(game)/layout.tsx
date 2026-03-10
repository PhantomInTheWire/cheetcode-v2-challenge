import { AuthProvider } from "@/components/AuthProvider";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { getServerSession } from "@/lib/session/server-session";

export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();

  return (
    <AuthProvider session={session}>
      <ConvexClientProvider>{children}</ConvexClientProvider>
    </AuthProvider>
  );
}
