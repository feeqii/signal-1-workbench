import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error:
        "The generic target resolver is retired. Use the curated KRAS investigation at / and /api/case.",
    },
    { status: 410 },
  );
}
