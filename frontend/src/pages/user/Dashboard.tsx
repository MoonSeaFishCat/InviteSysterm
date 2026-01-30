import Profile from './Profile';
import Applications from './Applications';
import Tickets from './Tickets';
import Messages from './Messages';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, Button, Avatar, Divider, Chip } from "@heroui/react";
import { FaUser, FaPaperPlane, FaTicketAlt, FaEnvelope, FaSignOutAlt, FaHome, FaBullhorn, FaTimes, FaMoon, FaSun } from 'react-icons/fa';
import Watermark from '../../components/Watermark';
import { useState, useEffect } from 'react';
import api from '../../api/client';
import { useTheme } from '../../hooks/useTheme';

interface Announcement {
  id: number;
  content: string;
  is_active: number;
  created_at: number;
}

export default function UserDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
  const username = userInfo.nickname || userInfo.email || '用户';
  const email = userInfo.email || '';

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<number[]>([]);

  const searchParams = new URLSearchParams(location.search);
  const activeTab = (searchParams.get('tab') as 'profile' | 'applications' | 'tickets' | 'messages') || 'applications';

  useEffect(() => {
    fetchAnnouncements();
    // 从 localStorage 读取已关闭的公告
    const dismissed = localStorage.getItem('dismissed_announcements');
    if (dismissed) {
      setDismissedAnnouncements(JSON.parse(dismissed));
    }
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const res = await api.get('/announcements');
      setAnnouncements(res.data || []);
    } catch (error) {
      console.error('获取公告失败:', error);
    }
  };

  const handleDismissAnnouncement = (id: number) => {
    const newDismissed = [...dismissedAnnouncements, id];
    setDismissedAnnouncements(newDismissed);
    localStorage.setItem('dismissed_announcements', JSON.stringify(newDismissed));
  };

  const handleLogout = () => {
    localStorage.removeItem('user_token');
    localStorage.removeItem('user_info');
    navigate('/');
  };

  const menuItems = [
    { key: 'applications', label: '申请管理', icon: FaPaperPlane, description: '管理邀请码申请' },
    { key: 'tickets', label: '我的工单', icon: FaTicketAlt, description: '提交和查看工单' },
    { key: 'messages', label: '站内信', icon: FaEnvelope, description: '查看系统消息' },
    { key: 'profile', label: '个人设置', icon: FaUser, description: '修改个人信息' },
  ];

  // 过滤出未被关闭的活跃公告
  const activeAnnouncements = announcements.filter(
    ann => ann.is_active === 1 && !dismissedAnnouncements.includes(ann.id)
  );

  return (
    <>
      <Watermark username={username} email={email} role="user" />
      <div className="min-h-screen bg-default-50/50">
      <div className="container mx-auto px-4 py-6">
        {/* 系统公告区域 */}
        {activeAnnouncements.length > 0 && (
          <div className="mb-6 space-y-3">
            {activeAnnouncements.map((announcement) => (
              <Card
                key={announcement.id}
                className="border-l-4 border-l-warning shadow-sm"
              >
                <div className="flex items-start gap-4 p-4">
                  <div className="flex-shrink-0 mt-1">
                    <Chip
                      startContent={<FaBullhorn />}
                      color="warning"
                      variant="flat"
                      size="sm"
                    >
                      系统公告
                    </Chip>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {announcement.content}
                    </p>
                    <p className="text-xs text-default-400 mt-2">
                      发布时间: {new Date(announcement.created_at * 1000).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    onPress={() => handleDismissAnnouncement(announcement.id)}
                    className="flex-shrink-0"
                  >
                    <FaTimes />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="flex gap-6">
          {/* 左侧边栏 */}
          <aside className="w-64 flex-shrink-0">
            <Card className="sticky top-6">
              {/* 用户信息 */}
              <div className="p-6 text-center border-b border-divider">
                <Avatar
                  size="lg"
                  className="mx-auto mb-3"
                  name={username}
                  color="primary"
                />
                <h3 className="font-bold text-lg">{username}</h3>
                <p className="text-xs text-default-500 mt-1">{email}</p>
              </div>

              {/* 导航菜单 */}
              <div className="p-3">
                <Button
                  fullWidth
                  variant="light"
                  className="justify-start mb-2"
                  startContent={<FaHome />}
                  onPress={() => navigate('/')}
                >
                  返回首页
                </Button>

                {/* 主题切换按钮 */}
                <Button
                  fullWidth
                  variant="light"
                  className="justify-start mb-2"
                  startContent={theme === 'dark' ? <FaSun /> : <FaMoon />}
                  onPress={toggleTheme}
                >
                  {theme === 'dark' ? '浅色模式' : '深色模式'}
                </Button>

                <Divider className="my-2" />

                {menuItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.key;
                  return (
                    <Button
                      key={item.key}
                      fullWidth
                      variant={isActive ? 'flat' : 'light'}
                      color={isActive ? 'primary' : 'default'}
                      className="justify-start mb-1"
                      startContent={<Icon />}
                      onPress={() => navigate(`/user/center?tab=${item.key}`)}
                    >
                      <div className="flex flex-col items-start flex-1">
                        <span className="font-medium">{item.label}</span>
                        {!isActive && (
                          <span className="text-xs text-default-400">{item.description}</span>
                        )}
                      </div>
                    </Button>
                  );
                })}

                <Divider className="my-2" />

                <Button
                  fullWidth
                  variant="light"
                  color="danger"
                  className="justify-start"
                  startContent={<FaSignOutAlt />}
                  onPress={handleLogout}
                >
                  退出登录
                </Button>
              </div>
            </Card>
          </aside>

          {/* 右侧内容区域 */}
          <main className="flex-1 min-w-0">
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              {activeTab === 'applications' && <Applications />}
              {activeTab === 'tickets' && <Tickets />}
              {activeTab === 'messages' && <Messages />}
              {activeTab === 'profile' && <Profile />}
            </div>
          </main>
        </div>
      </div>
    </div>
    </>
  );
}
