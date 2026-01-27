import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { applications, verificationCodes } from "@/db/schema";
import { eq, and, or, desc, inArray } from "drizzle-orm";
import { StarMoonSecurity } from "@/lib/security";
import { getSystemSettings } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const { encryptedData, fingerprint, nonce } = await request.json();
    
    // 1. 解密数据
    const data = StarMoonSecurity.decrypt(encryptedData, fingerprint, nonce);
    
    if (!data) {
      return NextResponse.json({ 
        success: false, 
        message: "安全校验失败：请求非法或已过期" 
      }, { status: 400 });
    }

    const { email, code, reason } = data;
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    
    const sysSettings = await getSystemSettings();

    // 1.5. Check if application is open
    if (sysSettings.application_open === "false") {
      return NextResponse.json({ 
        success: false, 
        message: "申请通道暂未开放，请稍后再试" 
      }, { status: 403 });
    }

    // 2. Verify code
    const storedCode = await db
      .select()
      .from(verificationCodes)
      .where(and(eq(verificationCodes.email, email), eq(verificationCodes.code, code)))
      .orderBy(desc(verificationCodes.createdAt))
      .limit(1);

    if (!storedCode.length || storedCode[0].expiresAt < new Date()) {
      return NextResponse.json({ 
        success: false, 
        message: "验证码无效或已过期" 
      }, { status: 400 });
    }

    // 3. Risk Control (指纹级风控)
    if (sysSettings.risk_control_enabled === "true") {
      // 检查是否存在未拒绝的申请
      const activeApplications = await db.select()
        .from(applications)
        .where(
          and(
            inArray(applications.status, ["pending", "approved"]),
            or(
              eq(applications.email, email),
              eq(applications.deviceId, fingerprint)
            )
          )
        );
      
      if (activeApplications.length > 0) {
        const status = activeApplications[0].status;
        const msg = status === "pending" 
          ? "您已有正在处理中的申请，请耐心等待" 
          : "您已成功获得邀请码，暂不能重复提交";
        return NextResponse.json({ success: false, message: msg }, { status: 400 });
      }

      // Email check (仅统计已通过的次数)
      const maxEmail = parseInt(sysSettings.max_applications_per_email || "1");
      const approvedEmail = await db.select().from(applications).where(
        and(
          eq(applications.email, email),
          eq(applications.status, "approved")
        )
      );
      if (approvedEmail.length >= maxEmail) {
        return NextResponse.json({ 
          success: false, 
          message: "该邮箱已成功申请过邀请码" 
        }, { status: 400 });
      }

      // Device check (仅统计已通过的次数)
      const maxDevice = parseInt(sysSettings.max_applications_per_device || "1");
      const approvedDevice = await db.select().from(applications).where(
        and(
          eq(applications.deviceId, fingerprint),
          eq(applications.status, "approved")
        )
      );
      if (approvedDevice.length >= maxDevice) {
        return NextResponse.json({ 
          success: false, 
          message: "该设备已成功申请过邀请码" 
        }, { status: 400 });
      }
    }

    // 4. Insert application
    await db.insert(applications).values({
      email,
      reason,
      deviceId: fingerprint,
      ip,
      status: "pending",
    });

    return NextResponse.json({ success: true, message: "申请提交成功，请耐心等待审核" });
  } catch (error) {
    console.error("Submit application error:", error);
    return NextResponse.json({ 
      success: false, 
      message: "提交失败，请重试" 
    }, { status: 500 });
  }
}
