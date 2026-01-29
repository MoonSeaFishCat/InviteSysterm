import { useEffect, useState } from 'react';
import { Card, CardBody, Button, Input, Textarea, Chip, Tabs, Tab, ScrollShadow } from "@heroui/react";
import api from '../api/client';
import type { Stats, ApplicationStatus } from '../types';
import toast from 'react-hot-toast';
import { 
  FaPaperPlane, FaSearch, FaInfoCircle, FaCheckCircle, 
  FaClock, FaSync, FaEnvelope, FaTimesCircle,
  FaHeart, FaBullhorn
} from 'react-icons/fa';

interface Announcement {
  id: number;
  content: string;
  created_at: number;
}
import { StarMoonSecurity } from '../utils/security';
import { getDeviceId } from '../utils/device';

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeTab, setActiveTab] = useState("apply");

  // Application state
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [captchaQuestion, setCaptchaQuestion] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaLoading, setCaptchaLoading] = useState(false);

  // Status state
  const [statusEmail, setStatusEmail] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);
  const [status, setStatus] = useState<ApplicationStatus | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, annRes] = await Promise.all([
          api.get('/stats'),
          api.get('/announcements')
        ]);
        setStats(statsRes.data);
        setAnnouncements(Array.isArray(annRes.data) ? annRes.data : []);
      } catch (error) {
        console.error("Failed to fetch data", error);
      }
    };
    fetchData();
    fetchCaptcha();
  }, []);

  const fetchCaptcha = async () => {
    setCaptchaLoading(true);
    try {
      const res = await api.get('/captcha');
      setCaptchaQuestion(res.data.question);
    } catch (error) {
      toast.error("加载人机验证失败");
    } finally {
      setCaptchaLoading(false);
    }
  };

  const handleSendCode = async () => {
    if (!email || !captchaAnswer) {
      toast.error("请填写完整信息");
      return;
    }
    setSending(true);
    try {
      await api.post('/verification-code', { email, captchaAnswer });
      toast.success("验证码已发送，请检查邮箱");
      setStep(2);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "发送失败");
      fetchCaptcha();
      setCaptchaAnswer('');
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async () => {
    if (!email || !code || !reason) {
      toast.error("请填写完整信息");
      return;
    }

    if (reason.length < 50) {
      toast.error("申请理由不能少于 50 个字，请认真填写");
      return;
    }

    setSubmitting(true);
    try {
      const nonce = Math.floor(Math.random() * 1000000);
      const fingerprint = getDeviceId();
      const payload = { email, code, reason };
      const encrypted = StarMoonSecurity.encryptData(payload, fingerprint, nonce);
      
      await api.post('/application/submit', { encrypted, fingerprint, nonce });
      toast.success("申请提交成功！");
      setActiveTab("status");
      setStatusEmail(email);
      handleCheckStatus(email);
      // Reset apply form
      setStep(1);
      setCode("");
      setReason("");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckStatus = async (targetEmail?: string) => {
    const emailToCheck = targetEmail || statusEmail;
    if (!emailToCheck) {
      toast.error("请输入邮箱地址");
      return;
    }
    setStatusLoading(true);
    try {
      const res = await api.post('/application/status', { email: emailToCheck });
      if (res.data.success) {
        setStatus(res.data.data);
      } else {
        toast.error(res.data.message || "查询失败");
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "查询失败");
      setStatus(null);
    } finally {
      setStatusLoading(false);
    }
  };

  const formatDate = (dateVal: any, showTime: boolean = false) => {
    if (!dateVal) return '';
    try {
      let date: Date;
      if (typeof dateVal === 'number') {
        date = new Date(dateVal * 1000);
      } else {
        date = new Date(dateVal);
        if (isNaN(date.getTime())) {
          const num = Number(dateVal);
          if (!isNaN(num)) {
            date = new Date(num * 1000);
          } else {
            return 'Invalid Date';
          }
        }
      }
      return showTime ? date.toLocaleString() : date.toLocaleDateString();
    } catch (e) {
      return 'Invalid Date';
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-64px)] flex flex-col items-center justify-center py-12 px-4">
      <div className="w-full max-w-3xl z-10">
        <header className="text-center mb-12">
          <div 
            className="inline-flex items-center justify-center w-20 h-20 rounded-large bg-primary/10 dark:bg-primary/20 mb-6 shadow-inner"
          >
            <FaHeart className="text-primary text-3xl drop-shadow-sm" />
          </div>
          <h1 className="text-4xl md:text-6xl font-black mb-6 tracking-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-500 to-pink-500 animate-gradient-x">
              {stats?.siteName || "社区邀请系统"}
            </span>
          </h1>
          <p className="text-default-500 dark:text-default-400 max-w-xl mx-auto leading-relaxed text-lg font-medium">
            {stats?.announcement || "每一份热爱都值得被温柔以待。目前我们采取邀请制，请提交申请获取属于您的邀请码。"}
          </p>
        </header>

        {announcements.length > 0 && (
          <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
            <Card className="bg-primary/5 dark:bg-primary/10 border-none shadow-none" radius="lg">
              <CardBody className="py-4 px-6">
                <div className="flex items-start gap-4">
                  <div className="mt-1 bg-primary/20 p-2 rounded-medium">
                    <FaBullhorn className="text-primary text-sm" />
                  </div>
                  <div className="flex-grow">
                    <ScrollShadow className="max-h-[100px]">
                      <div className="space-y-3">
                        {announcements.map((ann) => (
                          <div key={ann.id} className="text-sm font-medium text-default-700 leading-relaxed">
                            {ann.content}
                            <span className="ml-2 text-[10px] text-default-400 font-bold">
                              {formatDate(ann.created_at)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </ScrollShadow>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        )}

        <Card 
          className="border-none bg-white/60 dark:bg-default-100/10 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)]"
          radius="lg"
        >
          <CardBody className="p-0">
            <Tabs 
              fullWidth 
              size="lg" 
              aria-label="Options" 
              selectedKey={activeTab} 
              onSelectionChange={(key) => setActiveTab(key as string)}
              variant="underlined"
              classNames={{
                tabList: "gap-0 w-full relative rounded-none p-0 border-b border-divider/50",
                cursor: "w-full bg-primary h-[3px]",
                tab: "h-16",
                tabContent: "group-data-[selected=true]:text-primary text-default-500 font-bold text-base transition-all duration-300"
              }}
            >
              <Tab
                key="apply"
                title={
                  <div className="flex items-center space-x-2.5">
                    <FaPaperPlane className="text-sm" />
                    <span>申请加入</span>
                  </div>
                }
              >
                <div className="p-8 md:p-12 flex flex-col gap-8">
                  {!stats?.isApplicationOpen ? (
                    <div className="py-16 text-center flex flex-col items-center gap-6">
                      <div className="w-20 h-20 rounded-large bg-default-100 dark:bg-default-200/50 flex items-center justify-center shadow-sm">
                        <FaTimesCircle className="text-default-400 text-3xl" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-2xl font-bold text-default-600">申请通道已暂时关闭</p>
                        <p className="text-default-400">美好的事物总是值得等待，请稍后再试</p>
                      </div>
                      <Button 
                        variant="light" 
                        color="primary"
                        onPress={() => setActiveTab("status")}
                        className="font-bold px-8 shadow-sm"
                      >
                        查询已有申请
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-8">
                      <div className="space-y-6">
                        <Input
                          type="email"
                          label="邮箱地址"
                          labelPlacement="outside"
                          placeholder="your.email@example.com"
                          value={email}
                          onValueChange={setEmail}
                          variant="bordered"
                          isDisabled={step > 1}
                          startContent={<FaEnvelope className="text-default-400" />}
                          classNames={{
                            inputWrapper: "h-14 border-divider/50",
                            label: "font-bold text-default-600 mb-1"
                          }}
                        />
                        
                        {step === 1 ? (
                          <div className="flex flex-col gap-6">
                            <div className="space-y-2">
                              <label className="text-sm font-bold text-default-600 block ml-1">验证问答</label>
                              <Input
                                aria-label="人机验证"
                                placeholder={captchaLoading ? "正在召唤验证码..." : `计算结果: ${captchaQuestion}`}
                                value={captchaAnswer}
                                onValueChange={setCaptchaAnswer}
                                variant="bordered"
                                className="flex-grow"
                                classNames={{
                                  inputWrapper: "h-14 border-divider/50",
                                }}
                                endContent={
                                  <Button isIconOnly size="sm" variant="light" color="primary" onPress={fetchCaptcha}>
                                    <FaSync className={captchaLoading ? "animate-spin text-primary" : "text-primary/60"} />
                                  </Button>
                                }
                              />
                            </div>
                            <Button 
                              color="primary" 
                              size="lg"
                              onPress={handleSendCode} 
                              isLoading={sending}
                              className="font-bold h-14 text-lg shadow-sm"
                            >
                              获取验证码
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-8">
                            <div className="grid gap-6">
                              <Input
                                label="验证码"
                                labelPlacement="outside"
                                placeholder="请输入6位验证码"
                                value={code}
                                onValueChange={setCode}
                                variant="bordered"
                                classNames={{
                                  inputWrapper: "h-14 border-divider/50",
                                  label: "font-bold text-default-600"
                                }}
                              />
                              <Textarea
                                label="申请理由"
                                labelPlacement="outside"
                                placeholder="请详细说明您的加入理由，真诚的理由更容易通过哦..."
                                value={reason}
                                onValueChange={setReason}
                                variant="bordered"
                                minRows={4}
                                description={
                                  <div className="flex justify-between w-full">
                                    <span>请认真填写，审核将非常严格</span>
                                    <span className={reason.length < 50 ? "text-danger" : "text-success"}>
                                      {reason.length} / 50 (最少 50 字)
                                    </span>
                                  </div>
                                }
                                classNames={{
                                  inputWrapper: "border-divider/50 p-4",
                                  label: "font-bold text-default-600"
                                }}
                              />
                            </div>
                            <div className="flex flex-col gap-4">
                              <Button 
                                color="primary" 
                                size="lg"
                                onPress={handleSubmit} 
                                isLoading={submitting}
                                className="font-bold h-14 text-lg"
                              >
                                提交申请
                              </Button>
                              <Button 
                                variant="light" 
                                color="primary"
                                onPress={() => setStep(1)}
                                isDisabled={submitting}
                                className="font-bold"
                              >
                                返回修改邮箱
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Tab>
              <Tab
                key="status"
                title={
                  <div className="flex items-center space-x-2.5">
                    <FaSearch className="text-sm" />
                    <span>查询进度</span>
                  </div>
                }
              >
                <div className="p-8 md:p-12 flex flex-col gap-10">
                  <div className="flex gap-3">
                    <Input
                      type="email"
                      placeholder="输入申请邮箱"
                      value={statusEmail}
                      onValueChange={setStatusEmail}
                      variant="bordered"
                      className="flex-grow"
                      startContent={<FaEnvelope className="text-default-400" />}
                      onKeyDown={(e) => e.key === 'Enter' && handleCheckStatus()}
                      classNames={{
                        inputWrapper: "h-14 border-divider/50",
                      }}
                    />
                    <Button 
                      color="primary" 
                      onPress={() => handleCheckStatus()} 
                      isLoading={statusLoading}
                      isIconOnly
                      className="h-14 w-14 min-w-14 shadow-sm"
                    >
                      <FaSearch className="text-lg" />
                    </Button>
                  </div>

                  {status && (
                    <div className="bg-content1 rounded-large p-8 border border-divider shadow-sm relative overflow-hidden">
                      <div className="relative z-10 flex justify-between items-start mb-8">
                        <div>
                          <h3 className="font-black text-2xl mb-2">申请状态</h3>
                          <p className="text-default-400 font-medium">{status.email}</p>
                        </div>
                        <StatusChip status={status.status} />
                      </div>
                      
                      <div className="space-y-6 relative z-10">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-xs uppercase font-black text-default-400 tracking-widest">申请时间</span>
                          <span className="text-base font-bold text-default-700">{formatDate(status.createdAt, true)}</span>
                        </div>

                        {status.adminNote && (
                          <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-large p-5 shadow-inner">
                            <span className="text-xs uppercase font-black text-primary/60 block mb-2 tracking-widest">管理员回复</span>
                            <p className="text-sm leading-relaxed font-medium text-default-700">{status.adminNote}</p>
                          </div>
                        )}

                        {status.status === 'approved' && (
                          <div className="mt-8 p-8 bg-default-100 dark:bg-default-50 rounded-large border border-divider text-center shadow-sm">
                            <div className="flex flex-col items-center gap-2 mb-6">
                              <div className="w-12 h-12 rounded-large bg-success/20 flex items-center justify-center mb-2">
                                <FaCheckCircle className="text-success text-2xl" />
                              </div>
                              <p className="text-success font-black text-xl">恭喜！您的申请已通过</p>
                            </div>
                            
                            {status.inviteCode ? (
                              <div className="flex flex-col gap-4 items-center">
                                <div className="group relative">
                                  <div className="relative bg-content2 px-8 py-4 rounded-large border-2 border-dashed border-success/30 text-3xl font-mono font-black text-success tracking-[0.2em] shadow-sm">
                                    {status.inviteCode}
                                  </div>
                                </div>
                                <Button 
                                  size="md" 
                                  color="success"
                                  variant="solid"
                                  onPress={() => {
                                    navigator.clipboard.writeText(status.inviteCode || '');
                                    toast.success("邀请码已飞入剪贴板 ✨");
                                  }}
                                  className="font-black px-8 shadow-sm"
                                >
                                  点击复制邀请码
                                </Button>
                              </div>
                            ) : (
                              <p className="text-default-500 font-medium">邀请码已发送至您的邮箱，请注意查收。</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Tab>
            </Tabs>
          </CardBody>
        </Card>

        {/* Simple Stats Footer */}
        {stats && (
          <div className="mt-16 grid grid-cols-3 gap-8 md:gap-12 opacity-90">
            <div className="text-center group">
              <p className="text-3xl md:text-4xl font-black mb-2 text-default-800 group-hover:text-primary transition-colors">{stats.total}</p>
              <p className="text-[10px] md:text-xs uppercase font-black text-default-400 tracking-[0.2em]">累计申请</p>
            </div>
            <div className="text-center group">
              <p className="text-3xl md:text-4xl font-black mb-2 text-default-800 group-hover:text-success transition-colors">{stats.approved}</p>
              <p className="text-[10px] md:text-xs uppercase font-black text-default-400 tracking-[0.2em]">已通过</p>
            </div>
            <div className="text-center group">
              <p className="text-3xl md:text-4xl font-black mb-2 text-default-800 group-hover:text-warning transition-colors">{stats.pending}</p>
              <p className="text-[10px] md:text-xs uppercase font-black text-default-400 tracking-[0.2em]">待审核</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const configs: any = {
    pending: { color: "warning", label: "审核中", icon: <FaClock className="text-xs" /> },
    approved: { color: "success", label: "已通过", icon: <FaCheckCircle className="text-xs" /> },
    rejected: { color: "danger", label: "已拒绝", icon: <FaTimesCircle className="text-xs" /> }
  };
  const config = configs[status] || { color: "primary", label: status, icon: <FaInfoCircle className="text-xs" /> };
  
  return (
    <Chip 
      color={config.color} 
      variant="flat" 
      startContent={config.icon}
      className="font-black px-4 h-9 rounded-large shadow-sm"
      classNames={{
        content: "ml-1"
      }}
    >
      {config.label}
    </Chip>
  );
}
