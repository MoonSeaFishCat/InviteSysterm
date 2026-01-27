import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { getSystemSettings } from "@/lib/api-utils";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const { password, captcha } = await request.json();
    
    const cookieStore = await cookies();
    const storedCaptcha = cookieStore.get("captcha_answer")?.value;

    if (!storedCaptcha || captcha !== storedCaptcha) {
      return NextResponse.json({ success: false, message: "验证码错误" }, { status: 400 });
    }

    const sysSettings = await getSystemSettings();
    const crypto = await import("crypto");
    const hashedPassword = crypto.createHash("sha256").update(password).digest("hex");
    
    if (hashedPassword !== sysSettings.admin_password_hash) {
      return NextResponse.json({ success: false, message: "密码错误" }, { status: 401 });
    }

    await createSession("admin");
    cookieStore.delete("captcha_answer");
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ success: false, message: "登录失败" }, { status: 500 });
  }
}
