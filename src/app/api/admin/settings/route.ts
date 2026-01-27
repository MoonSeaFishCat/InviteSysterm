import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSystemSettings } from "@/lib/api-utils";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: "未授权" }, { status: 401 });
    }

    const settingsData = await getSystemSettings();
    return NextResponse.json(settingsData);
  } catch (error) {
    console.error("Get settings error:", error);
    return NextResponse.json({ error: "获取设置失败" }, { status: 500 });
  }
}
