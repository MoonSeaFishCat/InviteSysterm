import { useState, useEffect } from 'react';
import { Input, Button, Card, CardBody, CardHeader, Link } from "@heroui/react";
import api from '../api/client';
import toast from 'react-hot-toast';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { FaLock, FaEnvelope, FaUserEdit, FaUser } from 'react-icons/fa';
import { StarMoonSecurity } from '../utils/security';
import { getDeviceId } from '../utils/device';

export default function UserRegister() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const navigate = useNavigate();

  // 倒计时逻辑
  useEffect(() => {
    let timer: any;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const getCaptcha = async () => {
    try {
      const settingsRes = await api.get('/stats');
      if (settingsRes.data.geetest_enabled === "true" || settingsRes.data.geetest_id) {
        // @ts-ignore
        if (window.initGeetest4) {
          return await new Promise((resolve, reject) => {
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
      return null;
    } catch (err) {
      throw err;
    }
  };

  const sendCode = async () => {
    if (!email) {
      toast.error("请先输入邮箱");
      return;
    }
    setSendingCode(true);
    try {
      const captchaResult = await getCaptcha();
      const nonce = Math.floor(Math.random() * 1000000);
      const fingerprint = getDeviceId();
      const payload = captchaResult ? { email, ...(captchaResult as object) } : { email };
      const encrypted = StarMoonSecurity.encryptData(payload, fingerprint, nonce);

      const res = await api.post('/register-code', {
        encrypted,
        fingerprint,
        nonce
      });

      if (res.data.success) {
        toast.success("验证码已发送");
        setCountdown(60);
      }
    } catch (error: any) {
      if (error.message !== "用户关闭了验证码") {
        toast.error(error.response?.data?.message || "发送失败");
      }
    } finally {
      setSendingCode(false);
    }
  };

  const handleRegister = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      toast.error("请填写完整注册信息");
      return;
    }

    if (password.length < 6) {
      toast.error("密码长度至少为 6 位");
      return;
    }

    setLoading(true);
    try {
      const captchaResult = await getCaptcha();
      const nonce = Math.floor(Math.random() * 1000000);
      const fingerprint = getDeviceId();
      const payload = { 
        email, 
        password,
        code,
        nickname: nickname || email.split('@')[0],
        ...(captchaResult ? (captchaResult as object) : {})
      };
      const encrypted = StarMoonSecurity.encryptData(payload, fingerprint, nonce);

      const res = await api.post('/user/register', { 
        encrypted,
        fingerprint,
        nonce
      });
      
      if (res.data.success) {
        toast.success("注册成功，请登录");
        navigate('/login');
      }
    } catch (error: any) {
      if (error.message !== "用户关闭了验证码") {
        toast.error(error.response?.data?.message || "注册失败，请稍后重试");
      }
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
              <FaUserEdit size={48} className="text-primary" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-tight">用户注册</h1>
              <p className="text-sm text-default-500">Create New Account</p>
            </div>
          </CardHeader>
          
          <CardBody className="px-8 pb-10">
            <form onSubmit={handleRegister} className="flex flex-col gap-6">
              <Input
                label="邮箱"
                placeholder="请输入您的邮箱"
                type="email"
                value={email}
                onValueChange={setEmail}
                variant="bordered"
                radius="lg"
                size="lg"
                classNames={{
                  label: "font-bold",
                  inputWrapper: "h-14 px-4"
                }}
                startContent={<FaEnvelope className="text-default-400" />}
              />
              
              <div className="flex gap-2">
                <Input
                  label="验证码"
                  placeholder="请输入验证码"
                  value={code}
                  onValueChange={setCode}
                  variant="bordered"
                  radius="lg"
                  size="lg"
                  className="flex-1"
                  classNames={{
                    label: "font-bold",
                    inputWrapper: "h-14 px-4"
                  }}
                  startContent={<FaLock className="text-default-400" />}
                />
                <Button 
                  className="h-14 min-w-[120px]"
                  variant="flat"
                  color="primary"
                  onPress={sendCode}
                  isLoading={sendingCode}
                  isDisabled={countdown > 0}
                >
                  {countdown > 0 ? `${countdown}s` : "获取验证码"}
                </Button>
              </div>

              <Input
                label="昵称 (可选)"
                placeholder="请输入您的昵称"
                value={nickname}
                onValueChange={setNickname}
                variant="bordered"
                radius="lg"
                size="lg"
                classNames={{
                  label: "font-bold",
                  inputWrapper: "h-14 px-4"
                }}
                startContent={<FaUser className="text-default-400" />}
              />
              <Input
                label="密码"
                placeholder="请设置登录密码"
                type="password"
                value={password}
                onValueChange={setPassword}
                variant="bordered"
                radius="lg"
                size="lg"
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
                注册
              </Button>

              <div className="text-center mt-2">
                <p className="text-sm text-default-500">
                  已有账号？{' '}
                  <Link as={RouterLink} to="/login" color="primary" className="font-bold">
                    立即登录
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
