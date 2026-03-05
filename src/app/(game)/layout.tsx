import { AuthProvider } from "@/components/AuthProvider";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ConvexClientProvider>{children}</ConvexClientProvider>
    </AuthProvider>
  );
}
