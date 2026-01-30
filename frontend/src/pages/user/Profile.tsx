import { useState, useEffect } from 'react';
import { Card, CardHeader, CardBody, Input, Button, Divider, Avatar, Chip } from "@heroui/react";
import { FaSave, FaUser, FaEnvelope, FaCalendar, FaKey, FaShieldAlt } from 'react-icons/fa';
import apiClient from '../../api/client';

export default function Profile() {
  const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
  
  const [nickname, setNickname] = useState(userInfo.nickname || '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accountStats, setAccountStats] = useState({
    total_applications: 0,
    approved_applications: 0,
    pending_applications: 0,
    register_date: ''
  });

  useEffect(() => {
    fetchAccountStats();
  }, []);

  const fetchAccountStats = async () => {
    try {
      const response = await apiClient.get('/user/profile/stats');
      if (response.data.success) {
        setAccountStats(response.data.data);
      }
    } catch (error) {
      console.error('获取统计信息失败:', error);
    }
  };

  const handleUpdateNickname = async () => {
    if (!nickname.trim()) {
      alert('昵称不能为空');
      return;
    }

    try {
      const response = await apiClient.put('/user/profile', { nickname });
      if (response.data.success) {
        alert('昵称更新成功');
        const updatedInfo = { ...userInfo, nickname };
        localStorage.setItem('user_info', JSON.stringify(updatedInfo));
        window.location.reload();
      }
    } catch (error: any) {
      alert(error.response?.data?.message || '更新失败');
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      alert('请填写完整信息');
      return;
    }

    if (newPassword !== confirmPassword) {
      alert('两次输入的新密码不一致');
      return;
    }

    if (newPassword.length < 6) {
      alert('新密码长度不能少于6位');
      return;
    }

    try {
      const response = await apiClient.put('/user/password', {
        old_password: oldPassword,
        new_password: newPassword
      });
      if (response.data.success) {
        alert('密码修改成功，请重新登录');
        localStorage.removeItem('user_token');
        localStorage.removeItem('user_info');
        window.location.href = '/user/login';
      }
    } catch (error: any) {
      alert(error.response?.data?.message || '修改失败');
    }
  };

  return (
    <div className="space-y-6">
      {/* 账户概览 */}
      <Card>
        <CardHeader>
          <h3 className="text-2xl font-bold">账户概览</h3>
        </CardHeader>
        <CardBody>
          <div className="flex items-center gap-6 mb-6">
            <Avatar
              size="lg"
              name={nickname || userInfo.email}
              color="primary"
              className="w-20 h-20"
            />
            <div className="flex-1">
              <h4 className="text-xl font-bold mb-1">{nickname || '未设置昵称'}</h4>
              <div className="flex items-center gap-2 text-default-500 text-sm">
                <FaEnvelope />
                <span>{userInfo.email}</span>
              </div>
              <div className="flex items-center gap-2 text-default-500 text-sm mt-1">
                <FaCalendar />
                <span>注册时间: {userInfo.created_at ? new Date(userInfo.created_at).toLocaleDateString('zh-CN') : '未知'}</span>
              </div>
            </div>
          </div>

          <Divider className="my-4" />

          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-default-100 rounded-lg">
              <div className="text-2xl font-bold text-primary">{accountStats.total_applications}</div>
              <div className="text-sm text-default-500 mt-1">总申请数</div>
            </div>
            <div className="text-center p-4 bg-success-100 rounded-lg">
              <div className="text-2xl font-bold text-success">{accountStats.approved_applications}</div>
              <div className="text-sm text-default-500 mt-1">已批准</div>
            </div>
            <div className="text-center p-4 bg-warning-100 rounded-lg">
              <div className="text-2xl font-bold text-warning">{accountStats.pending_applications}</div>
              <div className="text-sm text-default-500 mt-1">待审核</div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* 基本信息 */}
      <Card>
        <CardHeader className="flex items-center gap-2">
          <FaUser className="text-primary" />
          <h3 className="text-xl font-bold">基本信息</h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <Input
            label="邮箱"
            value={userInfo.email}
            isDisabled
            startContent={<FaEnvelope className="text-default-400" />}
            description="邮箱不可修改"
          />
          <Input
            label="昵称"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="请输入昵称"
            startContent={<FaUser className="text-default-400" />}
            description="设置一个好记的昵称吧"
          />
          <div>
            <Button
              color="primary"
              startContent={<FaSave />}
              onPress={handleUpdateNickname}
              className="w-full sm:w-auto"
            >
              保存昵称
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* 安全设置 */}
      <Card>
        <CardHeader className="flex items-center gap-2">
          <FaShieldAlt className="text-primary" />
          <h3 className="text-xl font-bold">安全设置</h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="bg-warning-50 border border-warning-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <FaKey className="text-warning mt-1" />
              <div className="flex-1">
                <p className="font-medium text-warning-800">修改密码后需要重新登录</p>
                <p className="text-sm text-warning-600 mt-1">请确保您记住新密码</p>
              </div>
            </div>
          </div>

          <Input
            label="当前密码"
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            placeholder="请输入当前密码"
            startContent={<FaKey className="text-default-400" />}
          />
          <Input
            label="新密码"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="请输入新密码（至少6位）"
            startContent={<FaKey className="text-default-400" />}
          />
          <Input
            label="确认新密码"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="请再次输入新密码"
            startContent={<FaKey className="text-default-400" />}
          />
          <div>
            <Button
              color="danger"
              startContent={<FaSave />}
              onPress={handleChangePassword}
              className="w-full sm:w-auto"
            >
              修改密码
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* 账户状态 */}
      <Card>
        <CardHeader>
          <h3 className="text-xl font-bold">账户状态</h3>
        </CardHeader>
        <CardBody>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">账户状态</p>
              <p className="text-sm text-default-500">您的账户处于正常状态</p>
            </div>
            <Chip color="success" variant="flat" size="lg">
              正常
            </Chip>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
