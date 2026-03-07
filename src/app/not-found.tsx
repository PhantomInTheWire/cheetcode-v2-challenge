import Link from "next/link";
import { StatusPageShell } from "@/app/_components/StatusPageShell";

export default function NotFound() {
  return (
    <StatusPageShell
      title="This route does not exist"
      description="The URL is invalid or the resource has moved."
      imageSrc="/images/errors/not-found.svg"
      imageAlt="Not Found Illustration"
      includeFlame
      maxWidth={560}
      action={
        <Link
          href="/"
          className="btn-heat"
          style={{
            display: "inline-flex",
            marginTop: 18,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 10,
            height: 42,
            padding: "0 14px",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 450,
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          }}
        >
          Back To CTF Home
        </Link>
      }
    />
  );
}
