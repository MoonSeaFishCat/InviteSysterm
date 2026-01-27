import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { applications } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, message: "未授权" }, { status: 401 });
    }

    const allApplications = await db.select().from(applications).orderBy(desc(applications.createdAt));
    return NextResponse.json(allApplications);
  } catch (error) {
    console.error("Get applications error:", error);
    return NextResponse.json({ error: "获取申请列表失败" }, { status: 500 });
  }
}
