import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    app: "money-mind-web",
    timestamp: new Date().toISOString()
  });
}
