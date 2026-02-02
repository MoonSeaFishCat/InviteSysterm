import Applications from './Applications';
import Settings from './Settings';
import Announcements from './Announcements';
import Admins from './Admins';
import AuditLogs from './AuditLogs';
import Tickets from './Tickets';
import Messages from './Messages';
import Overview from './Overview';
import UserManagement from './UserManagement';
import Blacklist from './Blacklist';
import AdminChat from './AdminChat';
import PendingChat from './PendingChat';
import AuditorRanking from './AuditorRanking';
import AuditorApplications from './AuditorApplications';
import { useLocation, useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import { storage } from '../../utils/storage';
import { Navbar, NavbarBrand, NavbarContent, NavbarItem, Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Badge } from "@heroui/react";
import { FaChartBar, FaPaperPlane, FaTicketAlt, FaEnvelope, FaBullhorn, FaCog, FaUserShield, FaHistory, FaUsers, FaBan, FaChevronDown, FaSignOutAlt, FaMoon, FaSun, FaComments, FaTrophy } from 'react-icons/fa';
import Watermark from '../../components/Watermark';
import { useTheme } from '../../hooks/useTheme';
import { useState, useEffect } from 'react';
import api from '../../api/client';

export default function Dashboard() {
  const [pendingCount, setPendingCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const fetchPendingCount = async () => {
    try {
      const res = await api.get('/admin/chat/pending');
      if (res.data.success) {
        setPendingCount(res.data.data?.length || 0);
      }
    } catch (error) {
      console.error('Failed to fetch pending count:', error);
    }
  };

  useEffect(() => {
    fetchPendingCount();
    const timer = setInterval(fetchPendingCount, 30000); // 每30秒更新一次
    return () => clearInterval(timer);
  }, []);

  // Get user role from localStorage
  const user = storage.get('admin_user');
  const role = user?.role || 'commenter';
  const username = user?.username || '管理员';

  // Get active tab from URL path
  const pathParts = location.pathname.split('/');
  const activeTab = pathParts[pathParts.length - 1] === 'dashboard' ? 'overview' : pathParts[pathParts.length - 1];

  const handleLogout = () => {
    storage.remove('admin_token');
    storage.remove('admin_user');
    navigate('/admin/login');
  };

  const menuGroups = [
    {
      label: '工作台',
      items: [
        { key: 'overview', label: '概览', icon: <FaChartBar />, show: true },
        { key: 'ranking', label: '审核排行', icon: <FaTrophy />, show: true },
        { key: 'pending-chat', label: '待回私信', icon: <FaEnvelope />, show: true },
        { key: 'chat', label: '交流空间', icon: <FaComments />, show: true },
      ]
    },
    {
      label: '业务管理',
      items: [
        { key: 'applications', label: '申请管理', icon: <FaPaperPlane />, show: true },
        { key: 'auditor-apps', label: '审核申请', icon: <FaUserShield />, show: role === 'super' },
        { key: 'tickets', label: '工单管理', icon: <FaTicketAlt />, show: true },
      ]
    },
    {
      label: '消息公告',
      items: [
        { key: 'messages', label: '消息通知', icon: <FaEnvelope />, show: true },
        { key: 'announcements', label: '公告管理', icon: <FaBullhorn />, show: role === 'super' },
      ]
    },
    {
      label: '系统设置',
      show: role === 'super',
      items: [
        { key: 'users', label: '用户管理', icon: <FaUsers />, show: true },
        { key: 'blacklist', label: '黑名单', icon: <FaBan />, show: true },
        { key: 'admins', label: '管理员管理', icon: <FaUserShield />, show: true },
        { key: 'audit-logs', label: '审计日志', icon: <FaHistory />, show: true },
        { key: 'settings', label: '系统参数', icon: <FaCog />, show: true },
      ]
    }
  ];

  return (
    <>
      <Watermark username={username} role={role} />
      <div className="flex flex-col w-full min-h-screen bg-default-50/50">
      {/* Navigation Bar */}
      <Navbar isBordered maxWidth="full" className="border-b">
        <NavbarBrand>
          <p className="font-bold text-xl text-primary">管理后台</p>
        </NavbarBrand>
        
        <NavbarContent className="hidden lg:flex gap-1" justify="center">
          {menuGroups.filter(group => group.show !== false).map(group => (
            group.items.filter(item => item.show).map(item => (
              <NavbarItem key={item.key}>
                <Badge
                  content={pendingCount}
                  color="danger"
                  size="sm"
                  isInvisible={item.key !== 'pending-chat' || pendingCount === 0}
                >
                  <Button
                    size="sm"
                    variant={activeTab === item.key ? 'flat' : 'light'}
                    color={activeTab === item.key ? 'primary' : 'default'}
                    startContent={item.icon}
                    onPress={() => navigate(`/admin/dashboard/${item.key}`)}
                    className="px-3"
                  >
                    {item.label}
                  </Button>
                </Badge>
              </NavbarItem>
            ))
          ))}
        </NavbarContent>

        <NavbarContent justify="end">
          {/* 主题切换按钮 */}
          <NavbarItem>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={toggleTheme}
              aria-label="切换主题"
            >
              {theme === 'dark' ? <FaSun className="text-lg" /> : <FaMoon className="text-lg" />}
            </Button>
          </NavbarItem>

          <Dropdown>
            <DropdownTrigger>
              <Button
                variant="flat"
                size="sm"
                endContent={<FaChevronDown size={12} />}
              >
                {username}
              </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="用户菜单">
              <DropdownItem
                key="role"
                className="cursor-default"
                textValue="角色"
              >
                <div className="text-xs text-default-500">
                  角色: {role === 'super' ? '超级管理员' : role === 'reviewer' ? '审核员' : '评论员'}
                </div>
              </DropdownItem>
              <DropdownItem
                key="logout"
                color="danger"
                startContent={<FaSignOutAlt />}
                onPress={handleLogout}
              >
                退出登录
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </NavbarContent>
      </Navbar>

      {/* Main Content Area */}
      <div className="flex-grow container mx-auto px-6 py-8">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Routes>
            <Route path="overview" element={<Overview />} />
            <Route path="applications" element={<Applications />} />
            <Route path="tickets" element={<Tickets />} />
            <Route path="messages" element={<Messages />} />
            <Route path="chat" element={<AdminChat />} />
            <Route path="pending-chat" element={<PendingChat />} />
            <Route path="ranking" element={<AuditorRanking />} />
            <Route path="auditor-apps" element={role === 'super' ? <AuditorApplications /> : <Navigate to="overview" />} />
            <Route path="announcements" element={role === 'super' ? <Announcements /> : <Navigate to="overview" />} />
            <Route path="settings" element={role === 'super' ? <Settings /> : <Navigate to="overview" />} />
            <Route path="admins" element={role === 'super' ? <Admins /> : <Navigate to="overview" />} />
            <Route path="audit-logs" element={role === 'super' ? <AuditLogs /> : <Navigate to="overview" />} />
            <Route path="users" element={role === 'super' ? <UserManagement /> : <Navigate to="overview" />} />
            <Route path="blacklist" element={role === 'super' ? <Blacklist /> : <Navigate to="overview" />} />
            <Route path="/" element={<Navigate to="overview" replace />} />
          </Routes>
        </div>
      </div>
    </div>
    </>
  );
}
