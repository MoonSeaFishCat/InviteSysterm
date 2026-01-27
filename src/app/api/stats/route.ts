import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { applications } from "@/db/schema";
import { getSystemSettings } from "@/lib/api-utils";

export async function GET() {
  try {
    const allApps = await db.select().from(applications);
    const pending = allApps.filter(a => a.status === "pending").length;
    const approved = allApps.filter(a => a.status === "approved").length;
    const rejected = allApps.filter(a => a.status === "rejected").length;
    const processed = allApps.filter(a => a.status !== "pending").length;
    
    const sysSettings = await getSystemSettings();
    const isApplicationOpen = sysSettings.application_open !== "false";
    
    return NextResponse.json({
      total: allApps.length,
      pending,
      approved,
      rejected,
      processed,
      isApplicationOpen
    });
  } catch (error) {
    console.error("Get stats error:", error);
    return NextResponse.json({ 
      total: 0, 
      pending: 0, 
      approved: 0, 
      rejected: 0, 
      processed: 0,
      isApplicationOpen: true
    }, { status: 500 });
  }
}
