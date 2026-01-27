import { NextRequest, NextResponse } from "next/server";
import { generateCaptcha } from "@/lib/auth";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const { question, answer } = generateCaptcha();
    const cookieStore = await cookies();
    cookieStore.set("captcha_answer", answer, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === "production",
      maxAge: 300 
    });
    
    return NextResponse.json({ question });
  } catch (error) {
    return NextResponse.json({ error: "获取验证码失败" }, { status: 500 });
  }
}
