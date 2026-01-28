import { useState, useEffect } from 'react';
import { 
  Input, Button, Card, CardBody, CardHeader, Divider, Switch, Spinner, Textarea, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure
} from "@heroui/react";
import { FaSave, FaCog, FaEnvelope, FaShieldAlt, FaKey } from 'react-icons/fa';
import api from '../../api/client';
import toast from 'react-hot-toast';

export default function Settings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const {isOpen, onOpen, onClose} = useDisclosure();

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/settings');
      setSettings(res.data);
    } catch (error: any) {
      toast.error("无法加载设置");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleUpdate = async () => {
    setSaving(true);
    try {
      await api.post('/admin/settings/update', settings);
      toast.success("设置已更新");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "更新失败");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword) {
      toast.error("请提供当前密码进行身份验证");
      return;
    }

    if (!newUsername && !newPassword) {
      toast.error("至少需要修改一项信息 (用户名或密码)");
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      toast.error("两次输入的新密码不一致");
      return;
    }

    setChangingPassword(true);
    try {
      const res = await api.post('/admin/change-password', {
        currentPassword: oldPassword,
        newUsername,
        newPassword
      });

      if (res.data.relogin) {
        toast.success("信息修改成功，请重新登录");
        localStorage.removeItem('admin_token');
        window.location.href = '/admin/login';
      } else {
        toast.success("信息修改成功");
        onClose();
        // 重置表单
        setOldPassword('');
        setNewUsername('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "修改失败");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) return <div className="flex justify-center p-10"><Spinner size="lg" /></div>;

  return (
    <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-content1 p-8 rounded-large shadow-sm border border-divider">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <FaCog className="text-primary" />
            系统设置
          </h1>
          <p className="text-sm text-default-500">配置系统基础参数、安全规则与通知渠道</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="solid"
            color="warning"
            radius="lg"
            className="font-bold h-12 px-6 shadow-sm"
            startContent={<FaKey />} 
            onPress={onOpen}
          >
            修改密码
          </Button>
          <Button 
            color="primary" 
            radius="lg"
            className="font-bold h-12 px-8 shadow-lg shadow-primary/20"
            startContent={<FaSave />} 
            onPress={handleUpdate}
            isLoading={saving}
          >
            保存更改
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="shadow-sm border border-divider">
          <CardHeader className="flex gap-3 px-6 py-4">
            <FaShieldAlt className="text-primary" size={20} />
            <p className="font-bold text-lg">基础配置</p>
          </CardHeader>
          <Divider />
          <CardBody className="gap-6 px-6 py-6">
            <div className="flex justify-between items-center p-4 bg-default-50 rounded-large border border-divider">
              <div>
                <p className="text-sm font-bold">开放申请</p>
                <p className="text-tiny text-default-500">是否允许新用户提交申请</p>
              </div>
              <Switch 
                color="primary"
                isSelected={settings.application_open === 'true'} 
                onValueChange={(val) => handleChange('application_open', val ? 'true' : 'false')}
              />
            </div>
            <div className="flex justify-between items-center p-4 bg-default-50 rounded-large border border-divider">
              <div>
                <p className="text-sm font-bold">风控系统</p>
                <p className="text-tiny text-default-500">开启设备指纹与频率限制</p>
              </div>
              <Switch 
                color="primary"
                isSelected={settings.risk_control_enabled === 'true'} 
                onValueChange={(val) => handleChange('risk_control_enabled', val ? 'true' : 'false')}
              />
            </div>
            <div className="flex justify-between items-center p-4 bg-default-50 rounded-large border border-divider">
              <div>
                <p className="text-sm font-bold">注册审核</p>
                <p className="text-tiny text-default-500">新用户申请是否需要人工审核</p>
              </div>
              <Switch 
                color="primary"
                isSelected={settings.require_audit === 'true'} 
                onValueChange={(val) => handleChange('require_audit', val ? 'true' : 'false')}
              />
            </div>
            <Input
              label="网站名称"
              placeholder="例如: Invite System"
              value={settings.site_name || ''}
              onValueChange={(val) => handleChange('site_name', val)}
              variant="bordered"
              radius="lg"
              size="lg"
              classNames={{
                label: "font-bold text-default-500",
                inputWrapper: "border-2"
              }}
            />
            <Textarea
              label="首页公告 (副标题)"
              placeholder="显示在首页大标题下方的介绍文字"
              value={settings.home_announcement || ''}
              onValueChange={(val) => handleChange('home_announcement', val)}
              variant="bordered"
              radius="lg"
              minRows={2}
              classNames={{
                label: "font-bold text-default-500",
                inputWrapper: "border-2"
              }}
            />
          </CardBody>
        </Card>

        <Card className="shadow-sm border border-divider">
          <CardHeader className="flex gap-3 px-6 py-4">
            <FaShieldAlt className="text-purple-500" size={20} />
            <p className="font-bold text-lg">限制策略</p>
          </CardHeader>
          <Divider />
          <CardBody className="gap-6 px-6 py-6">
            <Input
              label="单邮箱申请上限"
              type="number"
              value={settings.max_applications_per_email || '1'}
              onValueChange={(val) => handleChange('max_applications_per_email', val)}
              variant="bordered"
              radius="lg"
              size="lg"
              classNames={{
                label: "font-bold text-default-500",
                inputWrapper: "border-2"
              }}
            />
            <Input
              label="单设备申请上限"
              type="number"
              value={settings.max_applications_per_device || '1'}
              onValueChange={(val) => handleChange('max_applications_per_device', val)}
              variant="bordered"
              radius="lg"
              size="lg"
              classNames={{
                label: "font-bold text-default-500",
                inputWrapper: "border-2"
              }}
            />
            <Textarea
              label="邮箱白名单"
              placeholder="允许的后缀, 如: gmail.com, qq.com"
              value={settings.email_whitelist || ''}
              onValueChange={(val) => handleChange('email_whitelist', val)}
              variant="bordered"
              radius="lg"
              minRows={2}
              classNames={{
                label: "font-bold text-default-500",
                inputWrapper: "border-2"
              }}
            />
          </CardBody>
        </Card>

        <Card className="shadow-sm border border-divider md:col-span-2">
          <CardHeader className="flex gap-3 px-6 py-4">
            <FaEnvelope className="text-pink-500" size={20} />
            <p className="font-bold text-lg">邮件通知服务</p>
          </CardHeader>
          <Divider />
          <CardBody className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-6 py-6">
            <Input
              label="SMTP 服务器"
              value={settings.smtp_host || ''}
              onValueChange={(val) => handleChange('smtp_host', val)}
              variant="bordered"
              radius="lg"
              classNames={{
                label: "font-bold text-default-500",
                inputWrapper: "border-2"
              }}
            />
            <Input
              label="SMTP 端口"
              value={settings.smtp_port || '465'}
              onValueChange={(val) => handleChange('smtp_port', val)}
              variant="bordered"
              radius="lg"
              classNames={{
                label: "font-bold text-default-500",
                inputWrapper: "border-2"
              }}
            />
            <Input
              label="SMTP 账号"
              value={settings.smtp_user || ''}
              onValueChange={(val) => handleChange('smtp_user', val)}
              variant="bordered"
              radius="lg"
              classNames={{
                label: "font-bold text-default-500",
                inputWrapper: "border-2"
              }}
            />
            <Input
              label="SMTP 密码"
              type="password"
              value={settings.smtp_pass || ''}
              onValueChange={(val) => handleChange('smtp_pass', val)}
              variant="bordered"
              radius="lg"
              classNames={{
                label: "font-bold text-default-500",
                inputWrapper: "border-2"
              }}
            />
            <Input
              label="发件人邮箱"
              value={settings.smtp_from || ''}
              onValueChange={(val) => handleChange('smtp_from', val)}
              variant="bordered"
              radius="lg"
              classNames={{
                label: "font-bold text-default-500",
                inputWrapper: "border-2"
              }}
            />
            <Input
              label="发件人名称"
              value={settings.smtp_from_name || ''}
              onValueChange={(val) => handleChange('smtp_from_name', val)}
              variant="bordered"
              radius="lg"
              classNames={{
                label: "font-bold text-default-500",
                inputWrapper: "border-2"
              }}
            />
          </CardBody>
        </Card>
      </div>

      <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        backdrop="blur"
        radius="lg"
        classNames={{
          header: "border-b border-divider/50 px-8 py-6",
          body: "px-8 py-6",
          footer: "border-t border-divider/50 px-8 py-4"
        }}
      >
        <ModalContent>
          <ModalHeader>
            <h3 className="text-xl font-black">修改管理员信息</h3>
          </ModalHeader>
          <ModalBody className="gap-6">
            <Input
              label="当前密码"
              placeholder="请输入当前密码以验证身份"
              type="password"
              value={oldPassword}
              onValueChange={setOldPassword}
              variant="bordered"
              radius="lg"
              size="lg"
            />
            <Divider />
            <Input
              label="新用户名 (可选)"
              placeholder="留空则不修改"
              value={newUsername}
              onValueChange={setNewUsername}
              variant="bordered"
              radius="lg"
              size="lg"
            />
            <Input
              label="新密码 (可选)"
              placeholder="留空则不修改"
              type="password"
              value={newPassword}
              onValueChange={setNewPassword}
              variant="bordered"
              radius="lg"
              size="lg"
            />
            <Input
              label="确认新密码"
              placeholder="请再次输入新密码"
              type="password"
              value={confirmPassword}
              onValueChange={setConfirmPassword}
              variant="bordered"
              radius="lg"
              size="lg"
              isDisabled={!newPassword}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" color="primary" onPress={onClose} radius="lg" className="font-bold">取消</Button>
            <Button 
              color="primary" 
              onPress={handleChangePassword} 
              isLoading={changingPassword}
              radius="lg"
              className="font-bold shadow-lg"
            >
              更新信息
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
