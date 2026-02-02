import { useState, useEffect } from 'react';
import { Input, Button, Card, CardBody, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@heroui/react";
import api from '../../api/client';
import toast from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FaLock, FaUser, FaShieldAlt, FaExternalLinkAlt, FaExclamationTriangle } from 'react-icons/fa';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    checkGeetestConfig();
    
    // 检查是否有错误信息
    const error = searchParams.get('error');
    if (error) {
      setErrorMsg(decodeURIComponent(error));
      onOpen();
      // 清除 URL 中的错误信息，避免刷新页面再次弹出
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('error');
      setSearchParams(newParams);
    }
  }, [searchParams]);

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
      const encrypted = await StarMoonSecurity.encryptData(finalPayload, fingerprint, nonce);

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
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-950 dark:to-indigo-950 px-4 py-12">
      <div className="w-full max-w-md">
        {/* 错误提示弹窗 */}
        <Modal 
          isOpen={isOpen} 
          onOpenChange={onOpenChange}
          backdrop="blur"
          placement="center"
          classNames={{
            base: "border-[#f31260] border-t-4",
            header: "border-b-[1px] border-default-100",
            footer: "border-t-[1px] border-default-100",
          }}
        >
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-danger">
                    <FaExclamationTriangle />
                    <span>登录失败</span>
                  </div>
                </ModalHeader>
                <ModalBody className="py-6">
                  <p className="text-default-600 font-medium">
                    {errorMsg}
                  </p>
                </ModalBody>
                <ModalFooter>
                  <Button color="danger" variant="light" onPress={onClose}>
                    知道了
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>

        {/* Logo 和标题 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shadow-2xl mb-4 animate-pulse">
            <FaShieldAlt size={40} className="text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent mb-2">
            管理后台
          </h1>
          <p className="text-default-500 text-lg">Administrator Login Portal</p>
        </div>

        {/* 登录卡片 */}
        <Card className="w-full shadow-2xl border-2 border-default-200 dark:border-default-100 backdrop-blur-sm bg-white/80 dark:bg-gray-900/80">
          <CardBody className="px-8 py-10">
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
                  label: "font-semibold text-base",
                  inputWrapper: "h-14 px-4 border-2 hover:border-primary transition-colors"
                }}
                startContent={<FaUser className="text-default-400 text-lg" />}
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
                  label: "font-semibold text-base",
                  inputWrapper: "h-14 px-4 border-2 hover:border-primary transition-colors"
                }}
                startContent={<FaLock className="text-default-400 text-lg" />}
              />
              <Button
                type="submit"
                color="primary"
                className="w-full mt-2 h-14 text-lg font-bold shadow-lg hover:shadow-xl transition-all bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                isLoading={loading}
              >
                {loading ? '登录中...' : '立即登录'}
              </Button>

              <div className="relative flex py-3 items-center">
                <div className="flex-grow border-t-2 border-default-200"></div>
                <span className="flex-shrink mx-4 text-default-400 text-sm font-medium">或者</span>
                <div className="flex-grow border-t-2 border-default-200"></div>
              </div>

              <Button
                onPress={handleLinuxDoLogin}
                variant="bordered"
                className="w-full h-14 text-lg font-bold border-2 hover:bg-default-100 dark:hover:bg-default-50 transition-all"
                startContent={<SiLinux className="text-xl" />}
                endContent={<FaExternalLinkAlt size={14} className="text-default-400" />}
              >
                使用 Linux DO 登录
              </Button>
            </form>
          </CardBody>
        </Card>

        {/* 底部提示 */}
        <div className="mt-8 text-center">
          <p className="text-sm text-default-400">
            🔒 安全提示：请妥善保管您的管理员凭据
          </p>
        </div>
      </div>
    </div>
  );
}
