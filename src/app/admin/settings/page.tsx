"use client";

import React, { useEffect, useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Input,
  Button,
  Switch,
  Divider,
  Tab,
  Tabs,
} from "@heroui/react";
import {
  Settings,
  Mail,
  ShieldAlert,
  Save,
  Loader2,
} from "lucide-react";
import { getSystemSettings, updateSystemSettings } from "../../../lib/actions";
import { toast, Toaster } from "react-hot-toast";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await getSystemSettings();
      setSettings(data);
    } catch (error) {
      toast.error("加载设置失败");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await updateSystemSettings(settings);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch (error) {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Toaster />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-6 h-6 text-gray-600" />
          <h1 className="text-2xl font-bold text-gray-800">系统设置</h1>
        </div>
        <Button
          color="primary"
          onPress={handleSave}
          isLoading={saving}
          startContent={!saving && <Save size={18} />}
          className="bg-gradient-to-tr from-pink-500 to-rose-500 text-white shadow-lg"
        >
          保存更改
        </Button>
      </div>

      <Tabs aria-label="Settings Options" color="primary" variant="underlined">
        <Tab
          key="smtp"
          title={
            <div className="flex items-center gap-2">
              <Mail size={18} />
              <span>邮件配置</span>
            </div>
          }
        >
          <Card className="mt-4 border-none shadow-sm">
            <CardHeader>
              <h3 className="text-lg font-semibold">SMTP 设置</h3>
            </CardHeader>
            <Divider />
            <CardBody className="gap-4 py-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="SMTP 服务器"
                  placeholder="smtp.example.com"
                  value={settings.smtp_host || ""}
                  onValueChange={(v) => updateField("smtp_host", v)}
                  variant="bordered"
                />
                <Input
                  label="SMTP 端口"
                  placeholder="465"
                  value={settings.smtp_port || ""}
                  onValueChange={(v) => updateField("smtp_port", v)}
                  variant="bordered"
                />
                <Input
                  label="SMTP 用户名"
                  placeholder="user@example.com"
                  value={settings.smtp_user || ""}
                  onValueChange={(v) => updateField("smtp_user", v)}
                  variant="bordered"
                />
                <Input
                  label="SMTP 密码"
                  type="password"
                  placeholder="******"
                  value={settings.smtp_pass || ""}
                  onValueChange={(v) => updateField("smtp_pass", v)}
                  variant="bordered"
                />
              </div>
              <p className="text-xs text-gray-400">
                用于发送验证码和审核通知邮件。推荐使用 465 端口。
              </p>
            </CardBody>
          </Card>
        </Tab>

        <Tab
          key="risk"
          title={
            <div className="flex items-center gap-2">
              <ShieldAlert size={18} />
              <span>风控与限制</span>
            </div>
          }
        >
          <Card className="mt-4 border-none shadow-sm">
            <CardHeader className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">申请开关</h3>
              <Switch
                isSelected={settings.application_open === "true"}
                onValueChange={(v) => updateField("application_open", v ? "true" : "false")}
                color="success"
              >
                开放申请
              </Switch>
            </CardHeader>
            <Divider />
            <CardBody className="py-4">
              <p className="text-sm text-gray-500">
                关闭后，用户将无法提交新的申请。适用于暂停接收申请的场景。
              </p>
            </CardBody>
          </Card>

          <Card className="mt-4 border-none shadow-sm">
            <CardHeader className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">风控策略</h3>
              <Switch
                isSelected={settings.risk_control_enabled === "true"}
                onValueChange={(v) => updateField("risk_control_enabled", v ? "true" : "false")}
                color="danger"
              >
                开启风控
              </Switch>
            </CardHeader>
            <Divider />
            <CardBody className="gap-6 py-6">
              <div className="space-y-4">
                <Input
                  label="邮箱白名单"
                  placeholder="linux.do, gmail.com (逗号分隔)"
                  description="留空表示不限制。支持域名或完整邮箱。"
                  value={settings.email_whitelist || ""}
                  onValueChange={(v) => updateField("email_whitelist", v)}
                  variant="bordered"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <Input
                    type="number"
                    label="每个邮箱最大申请数"
                    value={settings.max_applications_per_email || "1"}
                    onValueChange={(v) => updateField("max_applications_per_email", v)}
                    variant="bordered"
                  />
                  <Input
                    type="number"
                    label="每个设备最大申请数"
                    value={settings.max_applications_per_device || "1"}
                    onValueChange={(v) => updateField("max_applications_per_device", v)}
                    variant="bordered"
                  />
                </div>
              </div>
            </CardBody>
          </Card>
        </Tab>
      </Tabs>
    </div>
  );
}
