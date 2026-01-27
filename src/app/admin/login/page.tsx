"use client";

import React, { useState, useEffect } from "react";
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Input, 
  Button, 
  Divider 
} from "@heroui/react";
import { Lock, ShieldCheck, RefreshCcw } from "lucide-react";
import { toast, Toaster } from "react-hot-toast";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [captchaQuestion, setCaptchaQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const refreshCaptcha = async () => {
    const res = await fetch("/api/captcha");
    const data = await res.json();
    setCaptchaQuestion(data.question);
  };

  useEffect(() => {
    refreshCaptcha();
  }, []);

  const handleLogin = async () => {
    if (!password || !captchaInput) {
      toast.error("请填写完整信息");
      return;
    }
    setLoading(true);
    
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, captcha: captchaInput }),
    });
    
    const data = await res.json();
    setLoading(false);
    
    if (data.success) {
      toast.success("登录成功");
      router.push("/admin");
    } else {
      toast.error(data.message || "登录失败");
      refreshCaptcha();
      setCaptchaInput("");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#fdfbf7]">
      <Toaster position="top-center" />
      <div className="w-full max-w-md">
        <header className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-pink-400 to-rose-400 mb-4 shadow-lg shadow-pink-200">
            <Lock className="text-white w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-gray-700">管理员登录</h1>
          <p className="text-gray-400 text-sm mt-1">请验证身份以继续</p>
        </header>

        <Card className="border-none shadow-xl bg-white/80 backdrop-blur-md">
          <CardBody className="gap-6 p-8">
            <div className="flex flex-col gap-4">
              <Input
                label="管理密码"
                type="password"
                placeholder="请输入管理员密码"
                variant="bordered"
                value={password}
                onValueChange={setPassword}
                startContent={<Lock className="text-gray-400 w-4 h-4" />}
                classNames={{
                  inputWrapper: "border-gray-100 focus-within:border-pink-200 transition-colors",
                }}
              />

              <div className="flex gap-2">
                <Input
                  label="验证码"
                  placeholder={captchaQuestion ? `计算: ${captchaQuestion}` : "加载中..."}
                  variant="bordered"
                  value={captchaInput}
                  onValueChange={setCaptchaInput}
                  startContent={<ShieldCheck className="text-gray-400 w-4 h-4" />}
                  classNames={{
                    inputWrapper: "border-gray-100 focus-within:border-pink-200 transition-colors",
                  }}
                />
                <Button 
                  isIconOnly 
                  className="h-[56px] bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors"
                  onClick={refreshCaptcha}
                >
                  <RefreshCcw className="w-4 h-4" />
                </Button>
              </div>

              <Button 
                color="primary" 
                className="w-full h-12 text-lg font-medium bg-gradient-to-r from-pink-300 to-rose-300 shadow-lg shadow-pink-200/50 mt-2"
                onClick={handleLogin}
                isLoading={loading}
              >
                进入后台
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
