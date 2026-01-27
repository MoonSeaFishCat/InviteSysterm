// API 路由共享工具函数
import { db } from "../db";
import { settings } from "../db/schema";
import nodemailer from "nodemailer";

// Dynamic Transporter Cache
let transporterCache: any = null;
let transporterConfig: string = "";

export async function getTransporter() {
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
