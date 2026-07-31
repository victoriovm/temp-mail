import { NextResponse } from "next/server"

const corsHeaders = {
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
}

export function apiJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders })
}

export function corsOptions() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}
