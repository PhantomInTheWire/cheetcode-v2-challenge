import { NextResponse } from "next/server";
import { requireAuthenticatedGithub } from "../../../lib/request-auth";
import { pickLevel2ProjectPair, type Level2Project } from "../../../../server/level2/problems";

const LEVEL2_PROJECT_HASHES: Record<Level2Project, { label: string; commit: string }> = {
  chromium: {
    label: "Chromium",
    commit: "69c7c0a024efdc5bec0a9075e306e180b51e4278",
  },
  firefox: {
    label: "Firefox",
    commit: "22d04b52b0eb8d9fa11bf8ede5ccc0243a07c5ba",
  },
  libreoffice: {
    label: "LibreOffice",
    commit: "05aabfc2dbe",
  },
  postgres: {
    label: "PostgreSQL",
    commit: "f1baed18b",
  },
};

export async function GET(request: Request) {
  const authResult = await requireAuthenticatedGithub(request);
  if ("response" in authResult) return authResult.response;

  const [projectA, projectB] = pickLevel2ProjectPair();
  const projects = [projectA, projectB].map((project) => ({
    key: project,
    label: LEVEL2_PROJECT_HASHES[project].label,
    commit: LEVEL2_PROJECT_HASHES[project].commit,
  }));

  return NextResponse.json({
    projects,
  });
}
