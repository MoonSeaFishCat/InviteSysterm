import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { applications } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const { fingerprint } = await request.json();
    
    const active = await db.select()
      .from(applications)
      .where(
        and(
          eq(applications.deviceId, fingerprint),
          inArray(applications.status, ["pending", "approved"])
        )
      )
      .limit(1);
    
    return NextResponse.json({ 
      hasPending: active[0]?.status === "pending", 
      hasApproved: active[0]?.status === "approved",
      application: active[0] || null 
    });
  } catch (error) {
    console.error("Check status error:", error);
    return NextResponse.json({ 
      hasPending: false, 
      hasApproved: false, 
      application: null 
    }, { status: 500 });
  }
}
