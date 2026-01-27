import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: "未授权" }, { status: 401 });
    }

    const data = await request.json();

    // libsql 需要逐个执行更新
    for (const [key, value] of Object.entries(data)) {
      // 过滤掉密码哈希字段，不允许直接更新
      if (key === "admin_password_hash") continue;
      
      await db.update(settings)
        .set({ value: value as string, updatedAt: new Date() })
        .where(eq(settings.key, key))
        .run();
    }
    
    return NextResponse.json({ success: true, message: "设置已更新" });
  } catch (error) {
    console.error("Update settings error:", error);
    return NextResponse.json({ success: false, message: "更新失败" }, { status: 500 });
  }
}
