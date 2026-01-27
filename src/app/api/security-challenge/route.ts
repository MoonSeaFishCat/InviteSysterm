import { NextRequest, NextResponse } from "next/server";
import { StarMoonSecurity } from "@/lib/security";

export async function GET() {
  try {
    const difficulty = 4;
    const challenge = StarMoonSecurity.generateChallenge(difficulty);
    return NextResponse.json(challenge);
  } catch (error) {
    return NextResponse.json({ error: "生成挑战失败" }, { status: 500 });
  }
}
