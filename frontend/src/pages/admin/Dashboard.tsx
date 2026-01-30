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
import { useLocation, useNavigate } from 'react-router-dom';
import { storage } from '../../utils/storage';
import { Navbar, NavbarBrand, NavbarContent, NavbarItem, Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/react";
import { FaChartBar, FaPaperPlane, FaTicketAlt, FaEnvelope, FaBullhorn, FaCog, FaUserShield, FaHistory, FaUsers, FaBan, FaChevronDown, FaSignOutAlt, FaMoon, FaSun } from 'react-icons/fa';
import Watermark from '../../components/Watermark';
import { useTheme } from '../../hooks/useTheme';

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  // Get user role from localStorage
  const user = storage.get('admin_user');
  const role = user?.role || 'reviewer';
  const username = user?.username || '管理员';

  // Get active tab from URL query params
  const searchParams = new URLSearchParams(location.search);
  const activeTab = (searchParams.get('tab') as 'overview' | 'applications' | 'settings' | 'announcements' | 'admins' | 'audit-logs' | 'tickets' | 'messages' | 'users' | 'blacklist') || 'overview';

  const handleLogout = () => {
    storage.remove('admin_token');
    storage.remove('admin_user');
    navigate('/admin/login');
  };

  const menuItems = [
    { key: 'overview', label: '概览', icon: <FaChartBar />, show: true },
    { key: 'applications', label: '申请管理', icon: <FaPaperPlane />, show: true },
    { key: 'tickets', label: '工单管理', icon: <FaTicketAlt />, show: true },
    { key: 'messages', label: '消息通知', icon: <FaEnvelope />, show: true },
    { key: 'users', label: '用户管理', icon: <FaUsers />, show: role === 'super' },
    { key: 'blacklist', label: '黑名单', icon: <FaBan />, show: role === 'super' },
    { key: 'announcements', label: '公告管理', icon: <FaBullhorn />, show: role === 'super' },
    { key: 'settings', label: '系统设置', icon: <FaCog />, show: role === 'super' },
    { key: 'admins', label: '管理员', icon: <FaUserShield />, show: role === 'super' },
    { key: 'audit-logs', label: '审计日志', icon: <FaHistory />, show: role === 'super' },
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
        
        <NavbarContent className="hidden sm:flex gap-2" justify="center">
          {menuItems.filter(item => item.show).map(item => (
            <NavbarItem key={item.key}>
              <Button
                size="sm"
                variant={activeTab === item.key ? 'flat' : 'light'}
                color={activeTab === item.key ? 'primary' : 'default'}
                startContent={item.icon}
                onPress={() => navigate(`/admin/dashboard?tab=${item.key}`)}
              >
                {item.label}
              </Button>
            </NavbarItem>
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
                  角色: {role === 'super' ? '超级管理员' : '审核员'}
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
          {activeTab === 'overview' && <Overview />}
          {activeTab === 'applications' && <Applications />}
          {activeTab === 'tickets' && <Tickets />}
          {activeTab === 'messages' && <Messages />}
          {activeTab === 'announcements' && role === 'super' && <Announcements />}
          {activeTab === 'settings' && role === 'super' && <Settings />}
          {activeTab === 'admins' && role === 'super' && <Admins />}
          {activeTab === 'audit-logs' && role === 'super' && <AuditLogs />}
          {activeTab === 'users' && role === 'super' && <UserManagement />}
          {activeTab === 'blacklist' && role === 'super' && <Blacklist />}
        </div>
      </div>
    </div>
    </>
  );
}
