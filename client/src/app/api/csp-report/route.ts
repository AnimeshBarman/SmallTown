import { NextResponse } from "next/server";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === "string" ? value.slice(0, 200) : undefined;
}

function blockedOrigin(value: unknown) {
  if (typeof value !== "string") return undefined;
  if (value === "inline" || value === "eval" || value === "self") return value;
  try {
    return new URL(value).origin;
  } catch {
    return "invalid-url";
  }
}

export async function POST(request: Request) {
  const body = await request.text();
  if (body.length > 16_384) {
    return new NextResponse(null, { status: 413 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const reports = Array.isArray(parsed) ? parsed.slice(0, 20) : [parsed];
  for (const report of reports) {
    if (!isRecord(report)) continue;
    const details = isRecord(report["csp-report"])
      ? report["csp-report"]
      : isRecord(report.body)
        ? report.body
        : report;
    console.warn("CSP report", {
      directive: getString(details["effective-directive"] ?? details["effectiveDirective"]),
      blockedOrigin: blockedOrigin(details["blocked-uri"] ?? details["blockedURL"]),
      disposition: getString(details.disposition),
    });
  }

  return new NextResponse(null, { status: 204 });
}
