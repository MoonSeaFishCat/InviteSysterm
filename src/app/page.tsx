"use client";

import React, { useState, useEffect } from "react";
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Input, 
  Textarea, 
  Button, 
  Divider,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/react";
import { Mail, MessageSquare, ShieldCheck, Heart, Send, ShieldAlert, Cpu, Clock, CheckCircle2, Loader2, Info } from "lucide-react";
import { toast, Toaster } from "react-hot-toast";
import { getDeviceFingerprint, StarMoonSecurity } from "../lib/security";

export default function Home() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [fingerprint, setFingerprint] = useState("");
  const [powStatus, setPowStatus] = useState<"idle" | "solving" | "done">("idle");
  const [stats, setStats] = useState<any>(null);
  const [statusInfo, setStatusInfo] = useState<{ hasPending: boolean; hasApproved: boolean } | null>(null);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  useEffect(() => {
    async function init() {
      const fp = await getDeviceFingerprint();
      setFingerprint(fp);
      
      const [statsRes, statusRes] = await Promise.all([
        fetch("/api/stats"),
        fetch("/api/application/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fingerprint: fp }),
        }),
      ]);
      
      const statsData = await statsRes.json();
      const statusData = await statusRes.json();
      
      setStats(statsData);
      setStatusInfo({ hasPending: statusData.hasPending, hasApproved: statusData.hasApproved });
    }
    init();
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendCode = async () => {
    if (!email || !email.includes("@")) {
      toast.error("请输入正确的邮箱");
      return;
    }
    setSendingCode(true);
    
    const res = await fetch("/api/verification-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    
    setSendingCode(false);
    if (data.success) {
      toast.success(data.message);
      setCountdown(60);
    } else {
      toast.error(data.message);
    }
  };

  const handleSubmit = async () => {
    if (!email || !code || !reason) {
      toast.error("请填写完整信息");
      return;
    }
    
    setLoading(true);
    
    try {
      // 1. 获取 PoW 挑战
      setPowStatus("solving");
      const challengeRes = await fetch("/api/security-challenge");
      const challenge = await challengeRes.json();
      
      // 2. 解决 PoW
      const nonce = await StarMoonSecurity.solveChallenge(challenge.salt, challenge.difficulty);
      setPowStatus("done");

      // 3. 加密数据
      const encrypted = await StarMoonSecurity.encrypt(
        { email, code, reason },
        fingerprint,
        nonce
      );

      // 4. 提交
      const submitRes = await fetch("/api/application/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ encrypted, fingerprint, nonce }),
      });
      const res = await submitRes.json();
      
      if (res.success) {
        onOpen(); // 打开成功弹窗
        setStatusInfo({ hasPending: true, hasApproved: false }); // 隐藏表单
        // Reset form
        setCode("");
        setReason("");
        // 刷新统计
        const statsRes = await fetch("/api/stats");
        const newStats = await statsRes.json();
        setStats(newStats);
      } else {
        toast.error(res.message);
      }
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("提交失败,请重试");
    } finally {
      setLoading(false);
      setPowStatus("idle");
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden">
      {/* Healing Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-pink-100/30 rounded-full blur-[100px] -z-10" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100/30 rounded-full blur-[100px] -z-10" />
      <div className="absolute top-[20%] right-[10%] w-[20%] h-[20%] bg-yellow-100/20 rounded-full blur-[80px] -z-10" />
      
      <Toaster position="top-center" />

      <Modal 
        isOpen={isOpen} 
        onOpenChange={onOpenChange}
        backdrop="blur"
        classNames={{
          backdrop: "bg-pink-50/30",
          base: "border-none shadow-2xl bg-white/90 backdrop-blur-lg",
          header: "border-b-0",
          footer: "border-t-0",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1 items-center pt-8">
                <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-2">
                  <ShieldCheck className="text-green-500 w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-gray-700">申请提交成功</h3>
              </ModalHeader>
              <ModalBody className="text-center px-8 pb-8">
                <p className="text-gray-500 leading-relaxed">
                  您的申请已进入审核队列。请耐心等待管理员审核，审核结果将通过邮件通知您。
                </p>
                <div className="mt-4 p-4 bg-pink-50/50 rounded-xl border border-pink-100 text-sm text-pink-600 italic">
                  “生活总会有不期而遇的温暖，和生生不息的希望。”
                </div>
              </ModalBody>
              <ModalFooter className="justify-center pb-8">
                <Button 
                  color="primary" 
                  className="px-12 bg-gradient-to-r from-pink-400 to-rose-400 font-medium"
                  onPress={onClose}
                >
                  我知道了
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
      
      <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <header className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-pink-50 mb-4">
            <Heart className="text-pink-400 w-8 h-8 fill-pink-400" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-400 to-rose-400 bg-clip-text text-transparent">
            L站邀请码申请
          </h1>
          <p className="mt-4 text-gray-500 max-w-md mx-auto leading-relaxed">
            欢迎来到小汐的邀请码申请系统，请认真填写您的申请理由，我们将用心审核每一份申请。
            PS：小汐也不知道项目会运行多久 一切随缘（确信）大概率应该是小汐跌出三级？
          </p>

          {/* Stats Display */}
          <div className="flex justify-center gap-6 mt-6">
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1.5 text-orange-400 font-medium">
                <Clock className="w-4 h-4" />
                <span>待审核</span>
              </div>
              <span className="text-xl font-bold text-gray-700">{stats?.pending ?? "-"}</span>
            </div>
            <div className="h-10 w-px bg-gray-100 self-center"></div>
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1.5 text-blue-400 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>已审核</span>
              </div>
              <span className="text-xl font-bold text-gray-700">{stats?.processed ?? "-"}</span>
            </div>
            <div className="h-10 w-px bg-gray-100 self-center"></div>
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1.5 text-green-400 font-medium">
                <Heart className="w-4 h-4" />
                <span>已通过</span>
              </div>
              <span className="text-xl font-bold text-gray-700">{stats?.approved ?? "-"}</span>
            </div>
          </div>
        </header>

        <Card className="border-none shadow-xl bg-white/80 backdrop-blur-md">
          <CardHeader className="flex flex-col gap-1 p-6">
            <h2 className="text-xl font-semibold text-gray-700 flex items-center gap-2">
              <ShieldCheck className="text-green-400" />
              提交申请
            </h2>
            <p className="text-sm text-gray-400">
              请填写您的真实信息，以便我们更好地下发邀请码。
            </p>
          </CardHeader>
          <Divider />
          <CardBody className="p-6">
            {!stats?.isApplicationOpen ? (
              <div className="py-10 flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in duration-500">
                <div className="relative">
                  <div className="absolute -inset-4 bg-gray-100 rounded-full animate-pulse opacity-50"></div>
                  <ShieldAlert className="w-16 h-16 text-gray-400 relative z-10" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-gray-700">申请通道暂未开放</h2>
                  <p className="text-gray-500 max-w-sm mx-auto">
                    管理员已暂时关闭申请通道，请稍后再来尝试吧~
                  </p>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button 
                    variant="flat" 
                    color="default" 
                    className="bg-gray-50 text-gray-600 font-medium"
                    startContent={<Clock className="w-4 h-4" />}
                  >
                    请耐心等待开放
                  </Button>
                </div>
              </div>
            ) : statusInfo?.hasApproved ? (
              <div className="py-10 flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in duration-500">
                <div className="relative">
                  <div className="absolute -inset-4 bg-green-100 rounded-full animate-pulse opacity-50"></div>
                  <CheckCircle2 className="w-16 h-16 text-green-500 relative z-10" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-gray-700">您已获得邀请码</h2>
                  <p className="text-gray-500 max-w-sm mx-auto">
                    贪心的人类，每人只有一个哦~ 请珍惜您的邀请码，在 L 站开启新的旅程吧！
                  </p>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button 
                    variant="flat" 
                    color="success" 
                    className="bg-green-50 text-green-600 font-medium"
                    startContent={<Heart className="w-4 h-4 fill-green-600" />}
                  >
                    祝您在 L 站玩得开心
                  </Button>
                </div>
              </div>
            ) : statusInfo?.hasPending ? (
              <div className="py-10 flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in duration-500">
                <div className="relative">
                  <div className="absolute -inset-4 bg-orange-100 rounded-full animate-pulse opacity-50"></div>
                  <Clock className="w-16 h-16 text-orange-400 relative z-10" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-gray-700">申请处理中</h2>
                  <p className="text-gray-500 max-w-sm mx-auto">
                    我们已经收到了您的申请，管理员正在认真审核中。请耐心等待邮件通知哦~
                  </p>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button 
                    variant="flat" 
                    color="warning" 
                    className="bg-orange-50 text-orange-600 font-medium"
                    startContent={<Info className="w-4 h-4" />}
                  >
                    审核结果将发送至您的邮箱
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-4">
                  <div className="flex gap-2">
                    <Input
                      label="邮箱地址"
                      placeholder="your@email.com"
                      variant="bordered"
                      value={email}
                      onValueChange={setEmail}
                      startContent={<Mail className="text-gray-400 w-4 h-4" />}
                      classNames={{
                        inputWrapper: "border-gray-100 focus-within:border-pink-200 transition-colors",
                      }}
                    />
                    <Button 
                      className="h-[56px] min-w-[120px] bg-pink-100 text-pink-500 font-medium hover:bg-pink-200 transition-colors"
                      onClick={handleSendCode}
                      isLoading={sendingCode}
                      disabled={countdown > 0 || !stats?.isApplicationOpen}
                    >
                      {countdown > 0 ? `${countdown}s` : "获取验证码"}
                    </Button>
                  </div>

                  <Input
                    label="验证码"
                    placeholder="请输入邮箱验证码"
                    variant="bordered"
                    value={code}
                    onValueChange={setCode}
                    startContent={<ShieldCheck className="text-gray-400 w-4 h-4" />}
                    classNames={{
                      inputWrapper: "border-gray-100 focus-within:border-pink-200 transition-colors",
                    }}
                  />

                  <Textarea
                    label="申请理由"
                    placeholder="请详细描述您的申请理由，这将大大提高通过率..."
                    variant="bordered"
                    value={reason}
                    onValueChange={setReason}
                    startContent={<MessageSquare className="text-gray-400 w-4 h-4 mt-2" />}
                    classNames={{
                      inputWrapper: "border-gray-100 focus-within:border-pink-200 transition-colors",
                    }}
                  />
                </div>

                <Button
                  className="w-full h-12 text-lg font-bold bg-gradient-to-r from-pink-400 to-rose-400 text-white shadow-lg shadow-pink-200/50 hover:shadow-pink-300/50 transition-all active:scale-95"
                  onPress={handleSubmit}
                  isLoading={loading || powStatus === "solving"}
                  isDisabled={!stats?.isApplicationOpen}
                  startContent={powStatus === "solving" ? null : <Send size={20} />}
                >
                  {powStatus === "solving" ? "正在进行安全验证..." : "提交申请"}
                </Button>
              </div>
            )}
          </CardBody>
        </Card>

        <footer className="mt-12 text-center text-gray-400 text-sm">
          <p>© 2026 L站邀请码分发系统 · 治愈系设计</p>
        </footer>
      </div>
    </main>
  );
}
