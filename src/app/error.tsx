"use client";

import { useEffect } from "react";
import { StatusPageShell } from "@/app/_components/StatusPageShell";

export default function Error({
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
    <StatusPageShell
      title="Something broke in this route"
      description="The page hit an unexpected error. Retry to recover without losing the session."
      imageSrc="/images/errors/route-error.svg"
      imageAlt="Route Error Illustration"
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
          Retry Route
        </button>
      }
    />
  );
}
