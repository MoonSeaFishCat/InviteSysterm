import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { applications, invitationCodes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSystemSettings, getTransporter } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: "未授权" }, { status: 401 });
    }

    const { id, status, code, note } = await request.json();

    const app = await db.select().from(applications).where(eq(applications.id, id)).limit(1);
    if (!app.length) {
      return NextResponse.json({ success: false, message: "申请不存在" }, { status: 404 });
    }

    const email = app[0].email;

    // 更新申请状态
    await db.update(applications)
      .set({ 
        status, 
        adminNote: note, 
        updatedAt: new Date() 
      })
      .where(eq(applications.id, id))
      .run();
    
    // 如果通过，插入邀请码
    if (status === "approved" && code) {
      await db.insert(invitationCodes).values({
        code: code,
        isUsed: true,
        applicationId: id
      }).onConflictDoNothing().run();
    }

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
                  ${code}
                </div>
              ` : ''}
              
              <p style="margin: 15px 0 5px 0; font-size: 14px; color: #9d174d;">管理员寄语：</p>
              <div style="color: #4b5563; font-style: italic;">
                "${note || (isApproved ? '祝你在社区玩得开心~' : '抱歉，这次没有通过审核。')}"
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
      console.log(`Email to ${email}: ${status} - Code: ${code} - Note: ${note} (SMTP not configured)`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Review error:", error);
    return NextResponse.json({ success: false, message: "审核操作失败" }, { status: 500 });
  }
}
