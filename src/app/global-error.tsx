"use client";

import { useEffect } from "react";
import { StatusPageShell } from "@/app/_components/StatusPageShell";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <StatusPageShell
          title="Global app error"
          description="A root-level failure occurred. Retry to reinitialize app state."
          imageSrc="/images/errors/global-error.svg"
          imageAlt="Global Error Illustration"
          includeFlame
          maxWidth={640}
          action={
            <button
              onClick={() => reset()}
              className="btn-heat"
              style={{
                marginTop: 20,
                borderRadius: 10,
                height: 44,
                padding: "0 16px",
                fontSize: 14,
                fontWeight: 450,
                fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                cursor: "pointer",
              }}
            >
              Reinitialize App
            </button>
          }
        />
      </body>
    </html>
  );
}
