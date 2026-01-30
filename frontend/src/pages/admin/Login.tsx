import { useState, useEffect } from 'react';
import { Input, Button, Card, CardBody, CardHeader } from "@heroui/react";
import api from '../../api/client';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { FaLock, FaUser, FaShieldAlt, FaExternalLinkAlt } from 'react-icons/fa';
import { StarMoonSecurity } from '../../utils/security';
import { getDeviceId } from '../../utils/device';
import { SiLinux } from 'react-icons/si';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [geetestEnabled, setGeetestEnabled] = useState(false);
  const [geetestId, setGeetestId] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    checkGeetestConfig();
  }, []);

  const checkGeetestConfig = async () => {
    try {
      const res = await api.get('/stats');
      setGeetestEnabled(res.data.geetest_enabled === "true");
      setGeetestId(res.data.geetest_id || '');
    } catch (error) {
      console.error('获取极验配置失败:', error);
    }
  };

  const handleLinuxDoLogin = () => {
    // 直接跳转到后端的 Linux DO 登录接口
    window.location.href = '/api/admin/linuxdo';
  };

  const getCaptcha = async () => {
    if (!geetestEnabled || !geetestId) {
      return null;
    }

    try {
      // @ts-ignore
      if (window.initGeetest4) {
        return await new Promise((resolve, reject) => {
          // @ts-ignore
          window.initGeetest4({
            captchaId: geetestId,
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
    } catch (err) {
      throw err;
    }
    return null;
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!username || !password) {
      toast.error("请填写完整登录信息");
      return;
    }

    setLoading(true);
    try {
      // Get Geetest captcha result
      let captchaResult: any = null;
      if (geetestEnabled && geetestId) {
        try {
          captchaResult = await getCaptcha();
        } catch (err: any) {
          if (err.message !== "用户关闭了验证码") {
            toast.error("人机验证失败");
          }
          setLoading(false);
          return;
        }
      }

      const nonce = Math.floor(Math.random() * 1000000);
      const fingerprint = getDeviceId();
      const payload = { username, password };
      const finalPayload = captchaResult ? { ...payload, ...captchaResult } : payload;
      const encrypted = StarMoonSecurity.encryptData(finalPayload, fingerprint, nonce);

      const res = await api.post('/admin/login', {
        encrypted,
        fingerprint,
        nonce
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
