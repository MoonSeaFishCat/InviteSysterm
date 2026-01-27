"use server";

import { db } from "../db";
import { applications, verificationCodes, invitationCodes, settings } from "../db/schema";
import { eq, and, or, desc, inArray } from "drizzle-orm";
import nodemailer from "nodemailer";
import { headers, cookies } from "next/headers";
import { createSession, deleteSession, generateCaptcha, getSession } from "./auth";
import { StarMoonSecurity } from "./security";

// Dynamic Transporter Cache
let transporterCache: any = null;
let transporterConfig: string = "";

async function getTransporter() {
  const allSettings = await getSystemSettings();
  const configStr = JSON.stringify({
    host: allSettings.smtp_host,
    port: allSettings.smtp_port,
    user: allSettings.smtp_user,
    pass: allSettings.smtp_pass,
  });

  if (transporterCache && transporterConfig === configStr) {
    return transporterCache;
  }

  if (!allSettings.smtp_host || !allSettings.smtp_user) {
    return null;
  }

  transporterCache = nodemailer.createTransport({
    host: allSettings.smtp_host,
    port: parseInt(allSettings.smtp_port || "465"),
    secure: allSettings.smtp_port === "465",
    auth: {
      user: allSettings.smtp_user,
      pass: allSettings.smtp_pass,
    },
  });
  transporterConfig = configStr;
  return transporterCache;
}

export async function getSystemSettings() {
  const results = await db.select().from(settings);
  const settingsMap: Record<string, string> = {};
  results.forEach((s) => {
    settingsMap[s.key] = s.value;
  });
  return settingsMap;
}

export async function updateSystemSettings(data: Record<string, string>) {
  const session = await getSession();
  if (!session) return { success: false, message: "未授权" };

  try {
    db.transaction((tx) => {
      for (const [key, value] of Object.entries(data)) {
        tx.update(settings)
          .set({ value, updatedAt: new Date() })
          .where(eq(settings.key, key))
          .run();
      }
    });
    return { success: true, message: "设置已更新" };
  } catch (error) {
    console.error("Update settings error:", error);
    return { success: false, message: "更新失败" };
  }
}

export async function getCaptcha() {
  const { question, answer } = generateCaptcha();
  const cookieStore = await cookies();
  cookieStore.set("captcha_answer", answer, { httpOnly: true, secure: true, maxAge: 300 }); // 5 mins
  return question;
}

export async function adminLogin(password: string, captcha: string) {
  const cookieStore = await cookies();
  const storedCaptcha = cookieStore.get("captcha_answer")?.value;

  if (!storedCaptcha || captcha !== storedCaptcha) {
    return { success: false, message: "验证码错误" };
  }

  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  if (password !== adminPassword) {
    return { success: false, message: "密码错误" };
  }

  await createSession("admin");
  cookieStore.delete("captcha_answer");
  return { success: true };
}

export async function adminLogout() {
  await deleteSession();
}

export async function sendVerificationCode(email: string) {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Get system settings
  const sysSettings = await getSystemSettings();

  // 0. Check if application is open
  if (sysSettings.application_open === "false") {
    return { success: false, message: "申请通道暂未开放，请稍后再试" };
  }

  // 1. Check Whitelist
  const whitelist = sysSettings.email_whitelist?.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  if (whitelist && whitelist.length > 0) {
    const emailDomain = email.split("@")[1]?.toLowerCase();
    const isWhitelisted = whitelist.some(domain => domain === emailDomain || domain === email.toLowerCase());
    if (!isWhitelisted) {
      return { success: false, message: "该邮箱不在允许的白名单内" };
    }
  }

  // 2. Check if already applied
  const existing = await db.select().from(applications).where(eq(applications.email, email)).limit(1);
  if (existing.length > 0) {
    return { success: false, message: "该邮箱已提交过申请" };
  }

  try {
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

    return { success: true, message: "验证码已发送" };
  } catch (error) {
    console.error("Failed to send email:", error);
    return { success: false, message: "发送验证码失败" };
  }
}

export async function getSecurityChallenge() {
  const difficulty = 4; // 7星级标准，设置一个适中的难度
  return StarMoonSecurity.generateChallenge(difficulty);
}

export async function submitApplication(encryptedData: string, fingerprint: string, nonce: number) {
  // 1. 解密数据
  const data = StarMoonSecurity.decrypt(encryptedData, fingerprint, nonce);
  
  if (!data) {
    return { success: false, message: "安全校验失败：请求非法或已过期" };
  }

  const { email, code, reason } = data;
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for") || "unknown";
  
  const sysSettings = await getSystemSettings();

  // 1.5. Check if application is open
  if (sysSettings.application_open === "false") {
    return { success: false, message: "申请通道暂未开放，请稍后再试" };
  }

  // 2. Verify code
  const storedCode = await db
    .select()
    .from(verificationCodes)
    .where(and(eq(verificationCodes.email, email), eq(verificationCodes.code, code)))
    .orderBy(desc(verificationCodes.createdAt))
    .limit(1);

  if (!storedCode.length || storedCode[0].expiresAt < new Date()) {
    return { success: false, message: "验证码无效或已过期" };
  }

  // 3. Risk Control (指纹级风控)
  if (sysSettings.risk_control_enabled === "true") {
    // 检查是否存在未拒绝的申请 (只有当被拒绝了 才能继续申请)
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
      const msg = status === "pending" ? "您已有正在处理中的申请，请耐心等待" : "您已成功获得邀请码，暂不能重复提交";
      return { success: false, message: msg };
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
      return { success: false, message: "该邮箱已成功申请过邀请码" };
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
      return { success: false, message: "该设备已成功申请过邀请码" };
    }
  }

  // 4. Insert application
  try {
    await db.insert(applications).values({
      email,
      reason,
      deviceId: fingerprint, // 存储深度指纹
      ip,
      status: "pending",
    });

    return { success: true, message: "申请提交成功，请耐心等待审核" };
  } catch (error) {
    console.error("Submit error:", error);
    return { success: false, message: "提交失败，请重试" };
  }
}

// Admin Actions
export async function getApplications() {
  return await db.select().from(applications).orderBy(desc(applications.createdAt));
}

export async function reviewApplication(id: number, status: "approved" | "rejected", data: { code?: string; note?: string }) {
  const session = await getSession();
  if (!session) return { success: false, message: "未授权" };

  try {
    const app = await db.select().from(applications).where(eq(applications.id, id)).limit(1);
    if (!app.length) return { success: false, message: "申请不存在" };

    const email = app[0].email;

    db.transaction((tx) => {
      tx.update(applications)
        .set({ 
          status, 
          adminNote: data.note, 
          updatedAt: new Date() 
        })
        .where(eq(applications.id, id))
        .run();
      
      if (status === "approved" && data.code) {
        tx.insert(invitationCodes).values({
          code: data.code,
          isUsed: true,
          applicationId: id
        }).onConflictDoNothing().run();
      }
    });

    // Send Email
    const sysSettings = await getSystemSettings();
    const transporter = await getTransporter();
    
    if (transporter) {
      const isApproved = status === "approved";
      const subject = isApproved ? "✨ 申请已通过 - 小汐の邀请码分发系统" : "📩 申请审核结果 - 小汐の邀请码分发系统";
      
      const html = `
        <div style="max-width: 600px; margin: 0 auto; font-family: 'Microsoft YaHei', sans-serif; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); border: 1px solid #f0f0f0;">
          <div style="background: linear-gradient(135deg, #f9a8d4 0%, #fb7185 100%); padding: 30px 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; letter-spacing: 1px;">小汐の邀请码分发系统</h1>
          </div>
          <div style="padding: 40px 30px; background: white; color: #4b5563; line-height: 1.6;">
            <p style="font-size: 18px; color: #1f2937; margin-bottom: 20px;">你好呀，</p>
            <p style="margin-bottom: 25px;">你关于 <b>L站邀请码</b> 的申请已经审核完成啦：</p>
            
            <div style="background: #fdf2f8; border-radius: 12px; padding: 25px; margin-bottom: 25px; border: 1px dashed #f9a8d4;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #9d174d;">审核状态：</p>
              <div style="font-size: 20px; font-weight: bold; color: ${isApproved ? '#059669' : '#dc2626'}; margin-bottom: 15px;">
                ${isApproved ? '✅ 审核通过' : '❌ 很遗憾，未通过'}
              </div>
              
              ${isApproved ? `
                <p style="margin: 15px 0 5px 0; font-size: 14px; color: #9d174d;">你的邀请码：</p>
                <div style="background: white; padding: 15px; border-radius: 8px; text-align: center; font-family: monospace; font-size: 24px; color: #be185d; border: 1px solid #f9a8d4; letter-spacing: 2px;">
                  ${data.code}
                </div>
              ` : ''}
              
              <p style="margin: 15px 0 5px 0; font-size: 14px; color: #9d174d;">管理员寄语：</p>
              <div style="color: #4b5563; font-style: italic;">
                "${data.note || (isApproved ? '祝你在社区玩得开心~' : '抱歉，这次没有通过审核。')}"
              </div>
            </div>

            <p style="font-size: 14px; color: #9ca3af; margin-top: 30px;">
              * 此邮件由系统自动发出，请勿直接回复哦。<br>
              * 申请理由可以用于继续申请L站的注册理由。
            </p>
          </div>
          <div style="background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6;">
            © ${new Date().getFullYear()} 小汐の邀请码分发系统 · 温馨治愈
          </div>
        </div>
      `;

      await transporter.sendMail({
        from: `"小汐の邀请申请" <${sysSettings.smtp_user}>`,
        to: email,
        subject,
        html,
      });
    } else {
      console.log(`Email to ${email}: ${status} - Code: ${data.code} - Note: ${data.note} (SMTP not configured)`);
    }

    return { success: true };
  } catch (error) {
    console.error("Review error:", error);
    return { success: false, message: "审核操作失败" };
  }
}

export async function getStats() {
  const allApps = await db.select().from(applications);
  const pending = allApps.filter(a => a.status === "pending").length;
  const approved = allApps.filter(a => a.status === "approved").length;
  const rejected = allApps.filter(a => a.status === "rejected").length;
  const processed = allApps.filter(a => a.status !== "pending").length;
  
  const sysSettings = await getSystemSettings();
  const isApplicationOpen = sysSettings.application_open !== "false";
  
  return {
    total: allApps.length,
    pending,
    approved,
    rejected,
    processed,
    isApplicationOpen
  };
}

export async function checkApplicationStatus(fingerprint: string) {
  const active = await db.select()
    .from(applications)
    .where(
      and(
        eq(applications.deviceId, fingerprint),
        inArray(applications.status, ["pending", "approved"])
      )
    )
    .limit(1);
  
  return { 
    hasPending: active[0]?.status === "pending", 
    hasApproved: active[0]?.status === "approved",
    application: active[0] || null 
  };
}
