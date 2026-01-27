import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { verificationCodes, applications } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSystemSettings, getTransporter } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const sysSettings = await getSystemSettings();

    // 0. Check if application is open
    if (sysSettings.application_open === "false") {
      return NextResponse.json({ success: false, message: "申请通道暂未开放，请稍后再试" }, { status: 403 });
    }

    // 1. Check Whitelist
    const whitelist = sysSettings.email_whitelist?.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
    if (whitelist && whitelist.length > 0) {
      const emailDomain = email.split("@")[1]?.toLowerCase();
      const isWhitelisted = whitelist.some(domain => domain === emailDomain || domain === email.toLowerCase());
      if (!isWhitelisted) {
        return NextResponse.json({ success: false, message: "该邮箱不在允许的白名单内" }, { status: 403 });
      }
    }

    // 2. Check if already applied
    const existing = await db.select().from(applications).where(eq(applications.email, email)).limit(1);
    if (existing.length > 0) {
      return NextResponse.json({ success: false, message: "该邮箱已提交过申请" }, { status: 400 });
    }

    // Send email
    const transporter = await getTransporter();
    if (transporter) {
      await transporter.sendMail({
        from: `"L站邀请申请" <${sysSettings.smtp_user}>`,
        to: email,
        subject: "您的验证码",
        text: `您的验证码是 ${code}，有效期 10 分钟。`,
      });
    } else {
      console.log(`Verification code for ${email}: ${code} (SMTP not configured)`);
    }

    await db.insert(verificationCodes).values({
      email,
      code,
      expiresAt,
    });

    return NextResponse.json({ success: true, message: "验证码已发送" });
  } catch (error) {
    console.error("Send code error:", error);
    return NextResponse.json({ success: false, message: "发送验证码失败" }, { status: 500 });
  }
}
