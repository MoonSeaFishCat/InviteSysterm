import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSystemSettings } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: "未授权" }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ success: false, message: "新密码至少需要6个字符" }, { status: 400 });
    }

    const crypto = await import("crypto");
    const sysSettings = await getSystemSettings();
    
    // 验证当前密码
    const currentHash = crypto.createHash("sha256").update(currentPassword).digest("hex");
    if (currentHash !== sysSettings.admin_password_hash) {
      return NextResponse.json({ success: false, message: "当前密码错误" }, { status: 401 });
    }

    // 更新为新密码
    const newHash = crypto.createHash("sha256").update(newPassword).digest("hex");
    await db.update(settings)
      .set({ value: newHash, updatedAt: new Date() })
      .where(eq(settings.key, "admin_password_hash"))
      .run();

    return NextResponse.json({ success: true, message: "密码修改成功" });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json({ success: false, message: "密码修改失败" }, { status: 500 });
  }
}
