import { useState, useEffect } from 'react';
import { Input, Button, Card, CardBody, CardHeader } from "@heroui/react";
import api from '../../api/client';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { FaLock, FaUser, FaShieldAlt, FaSync, FaExternalLinkAlt } from 'react-icons/fa';
import { StarMoonSecurity } from '../../utils/security';
import { getDeviceId } from '../../utils/device';
import { SiLinux } from 'react-icons/si';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captchaQuestion, setCaptchaQuestion] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCaptcha();
  }, []);

  const handleLinuxDoLogin = () => {
    // 直接跳转到后端的 Linux DO 登录接口
    window.location.href = '/api/admin/linuxdo';
  };

  const fetchCaptcha = async () => {
    setCaptchaLoading(true);
    try {
      const res = await api.get('/captcha');
      setCaptchaQuestion(res.data.question);
    } catch (error) {
      toast.error("加载验证码失败");
    } finally {
      setCaptchaLoading(false);
    }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!username || !password || !captchaAnswer) {
      toast.error("请填写完整登录信息");
      return;
    }

    setLoading(true);
    try {
      const nonce = Math.floor(Math.random() * 1000000);
      const fingerprint = getDeviceId();
      const payload = { username, password };
      const encrypted = StarMoonSecurity.encryptData(payload, fingerprint, nonce);

      const res = await api.post('/admin/login', { 
        encrypted, 
        fingerprint, 
        nonce,
        captchaAnswer 
      });
      
      localStorage.setItem('admin_token', res.data.token);
      
      // 获取当前用户信息
      const meRes = await api.get('/admin/me');
      if (meRes.data.success) {
        localStorage.setItem('admin_user', JSON.stringify(meRes.data.data));
      }

      toast.success("登录成功");
      navigate('/admin/dashboard');
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || "登录失败，请检查凭据");
      fetchCaptcha();
      setCaptchaAnswer('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh] w-full px-4">
      <div className="w-full max-w-md">
        <Card className="w-full shadow-xl border border-divider">
          <CardHeader className="flex flex-col gap-4 items-center py-8">
            <FaShieldAlt size={48} className="text-primary" />
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-tight">管理后台</h1>
              <p className="text-sm text-default-500">Administrator Login</p>
            </div>
          </CardHeader>
          
          <CardBody className="px-8 pb-10">
            <form onSubmit={handleLogin} className="flex flex-col gap-6">
              <Input
                label="用户名"
                placeholder="请输入管理员账号"
                value={username}
                onValueChange={setUsername}
                variant="bordered"
                radius="lg"
                size="lg"
                autoComplete="username"
                classNames={{
                  label: "font-bold",
                  inputWrapper: "h-14 px-4"
                }}
                startContent={<FaUser className="text-default-400" />}
              />
              <Input
                label="密码"
                placeholder="请输入管理员密码"
                type="password"
                value={password}
                onValueChange={setPassword}
                variant="bordered"
                radius="lg"
                size="lg"
                autoComplete="current-password"
                classNames={{
                  label: "font-bold",
                  inputWrapper: "h-14 px-4"
                }}
                startContent={<FaLock className="text-default-400" />}
              />
              <Input
                label="验证问答"
                placeholder={captchaLoading ? "正在获取..." : `计算结果: ${captchaQuestion}`}
                value={captchaAnswer}
                onValueChange={setCaptchaAnswer}
                variant="bordered"
                radius="lg"
                size="lg"
                classNames={{
                  label: "font-bold",
                  inputWrapper: "h-14 px-4"
                }}
                endContent={
                  <Button isIconOnly size="sm" variant="light" color="primary" onPress={fetchCaptcha}>
                    <FaSync className={captchaLoading ? "animate-spin" : ""} />
                  </Button>
                }
              />
              <Button 
                type="submit"
                color="primary" 
                className="w-full mt-4 h-14 text-lg font-bold shadow-sm"
                isLoading={loading}
              >
                登录
              </Button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-divider"></div>
                <span className="flex-shrink mx-4 text-default-400 text-sm">或者</span>
                <div className="flex-grow border-t border-divider"></div>
              </div>

              <Button 
                onPress={handleLinuxDoLogin}
                variant="bordered"
                className="w-full h-14 text-lg font-bold border-2 hover:bg-default-100"
                startContent={<SiLinux />}
                endContent={<FaExternalLinkAlt size={14} className="text-default-400" />}
              >
                使用 Linux DO 登录
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
