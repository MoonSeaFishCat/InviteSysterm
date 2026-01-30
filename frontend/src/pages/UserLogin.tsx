import { useState } from 'react';
import { Input, Button, Card, CardBody, CardHeader, Link } from "@heroui/react";
import api from '../api/client';
import toast from 'react-hot-toast';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { FaLock, FaEnvelope, FaUserCircle } from 'react-icons/fa';

export default function UserLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      toast.error("请输入邮箱和密码");
      return;
    }

    setLoading(true);
    try {
      const { StarMoonSecurity } = await import('../utils/security');
      const { getDeviceId } = await import('../utils/device');
      
      const nonce = Math.floor(Math.random() * 1000000);
      const fingerprint = getDeviceId();
      const payload = { email, password };

      // 极验验证码逻辑
      let captchaResult: any = null;
      try {
        const settingsRes = await api.get('/stats');
        if (settingsRes.data.geetest_enabled === "true" || settingsRes.data.geetest_id) {
          // @ts-ignore
          if (window.initGeetest4) {
            captchaResult = await new Promise((resolve, reject) => {
              // @ts-ignore
              window.initGeetest4({
                captchaId: settingsRes.data.geetest_id,
                product: 'bind',
              }, (captchaObj: any) => {
                captchaObj.onSuccess(() => {
                  resolve(captchaObj.getValidate());
                }).onError((err: any) => {
                  reject(err);
                }).onClose(() => {
                  reject(new Error("用户关闭了验证码"));
                });
                captchaObj.showCaptcha();
              });
            });
          }
        }
      } catch (err: any) {
        if (err.message !== "用户关闭了验证码") {
          toast.error("人机验证初始化失败");
        }
        setLoading(false);
        return;
      }

      const finalPayload = captchaResult ? { ...payload, ...captchaResult } : payload;
      const encrypted = await StarMoonSecurity.encryptData(finalPayload, fingerprint, nonce);

      const res = await api.post('/user/login', { 
        encrypted,
        fingerprint,
        nonce
      });
      
      if (res.data.success) {
        toast.success("登录成功");
        localStorage.setItem('user_token', res.data.token);
        localStorage.setItem('user_info', JSON.stringify(res.data.user));
        navigate('/user/center');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh] w-full px-4">
      <div className="w-full max-w-md">
        <Card className="w-full shadow-xl border border-divider">
          <CardHeader className="flex flex-col gap-4 items-center py-8">
            <div className="p-3 rounded-full bg-primary/10">
              <FaUserCircle size={48} className="text-primary" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-tight">用户登录</h1>
              <p className="text-sm text-default-500">Welcome Back</p>
            </div>
          </CardHeader>
          
          <CardBody className="px-8 pb-10">
            <form onSubmit={handleLogin} className="flex flex-col gap-6">
              <Input
                label="邮箱"
                placeholder="请输入您的邮箱"
                type="email"
                value={email}
                onValueChange={setEmail}
                variant="bordered"
                radius="lg"
                size="lg"
                autoComplete="email"
                classNames={{
                  label: "font-bold",
                  inputWrapper: "h-14 px-4"
                }}
                startContent={<FaEnvelope className="text-default-400" />}
              />
              <Input
                label="密码"
                placeholder="请输入您的密码"
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
              
              <Button
                type="submit"
                color="primary"
                className="w-full mt-2 h-14 text-lg font-bold shadow-sm"
                isLoading={loading}
              >
                登录
              </Button>

              <div className="flex justify-between items-center mt-2">
                <Link as={RouterLink} to="/forgot-password" color="primary" className="text-sm font-medium">
                  忘记密码？
                </Link>
              </div>

              <div className="text-center">
                <p className="text-sm text-default-500">
                  还没有账号？{' '}
                  <Link as={RouterLink} to="/register" color="primary" className="font-bold">
                    立即注册
                  </Link>
                </p>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
