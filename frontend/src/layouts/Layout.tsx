import React, { useEffect, useState } from 'react';
import { Navbar, NavbarBrand, NavbarContent, NavbarItem, Link, Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/react";
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import { FaMoon, FaSun, FaUserCircle, FaSignOutAlt, FaShieldAlt, FaUsers, FaBullhorn, FaCog, FaUserShield, FaHistory, FaTicketAlt, FaEnvelope } from 'react-icons/fa';

import { storage } from '../utils/storage';

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const hasAdminToken = !!localStorage.getItem('admin_token');
  const hasUserToken = !!localStorage.getItem('user_token');
  const isAdminPage = location.pathname.startsWith('/admin');
  const isDashboard = location.pathname === '/admin/dashboard';

  // Get user role
  const adminUser = storage.get('admin_user');
  const userInfo = storage.get('user_info');
  const role = adminUser.role || 'reviewer';
  const permissions = adminUser.permissions || '';

  const allAdminTabs = [
    { id: 'applications', label: '申请管理', icon: <FaUsers size={16} />, permission: 'applications' },
    { id: 'tickets', label: '工单管理', icon: <FaTicketAlt size={16} />, permission: 'tickets' },
    { id: 'messages', label: '消息中心', icon: <FaEnvelope size={16} />, permission: 'messages' },
    { id: 'announcements', label: '系统公告', icon: <FaBullhorn size={16} />, permission: 'announcements' },
    { id: 'audit-logs', label: '审核日志', icon: <FaHistory size={16} />, permission: 'audit-logs' },
    { id: 'settings', label: '系统设置', icon: <FaCog size={16} />, permission: 'settings' },
    { id: 'admins', label: '人员管理', icon: <FaUserShield size={16} />, permission: 'admins' },
  ];

  const adminTabs = allAdminTabs.filter(tab => {
    if (role === 'super') return true;
    if (permissions === 'all') return true;
    return permissions.split(',').includes(tab.permission);
  });

  const currentTab = new URLSearchParams(location.search).get('tab') || 'applications';

  useEffect(() => {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    navigate('/admin/login');
  };

  const handleUserLogout = () => {
    localStorage.removeItem('user_token');
    localStorage.removeItem('user_info');
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col w-full bg-background text-foreground transition-colors duration-500 ease-in-out">
      <Navbar 
        maxWidth="xl" 
        className="bg-background/70 backdrop-blur-md border-b border-divider"
        classNames={{
          wrapper: "px-6",
        }}
      >
      <NavbarBrand>
        <RouterLink to="/" className="flex items-center gap-2">
          <FaShieldAlt size={24} className="text-primary" />
          <span className="font-bold text-xl tracking-tight">INVITE</span>
        </RouterLink>
      </NavbarBrand>

      {hasAdminToken && isDashboard && adminTabs.length === 1 && (
        <NavbarContent className="hidden sm:flex" justify="center">
          <NavbarItem>
            <span className="text-sm font-bold text-primary bg-primary/10 px-4 py-2 rounded-lg border border-primary/20">
              {adminTabs[0].label}
            </span>
          </NavbarItem>
        </NavbarContent>
      )}

      {hasAdminToken && isDashboard && adminTabs.length > 1 && (
        <NavbarContent className="flex gap-1 sm:gap-4" justify="center">
          {adminTabs.map((tab) => (
            <NavbarItem key={tab.id} isActive={currentTab === tab.id}>
              <Button
                  as={RouterLink}
                  to={`/admin/dashboard?tab=${tab.id}`}
                  variant={currentTab === tab.id ? "solid" : "light"}
                  color="primary"
                  className={`font-bold h-9 px-2 sm:px-4 ${currentTab === tab.id ? "shadow-md" : "text-primary/70 hover:bg-primary/10"}`}
                  size="sm"
                  radius="lg"
                  startContent={tab.icon}
                >
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.id === 'announcements' && <span className="sm:hidden text-[10px]">公告</span>}
                {tab.id === 'applications' && <span className="sm:hidden text-[10px]">申请</span>}
                {tab.id === 'tickets' && <span className="sm:hidden text-[10px]">工单</span>}
                {tab.id === 'messages' && <span className="sm:hidden text-[10px]">消息</span>}
                {tab.id === 'audit-logs' && <span className="sm:hidden text-[10px]">日志</span>}
                {tab.id === 'settings' && <span className="sm:hidden text-[10px]">设置</span>}
                {tab.id === 'admins' && <span className="sm:hidden text-[10px]">人员</span>}
              </Button>
            </NavbarItem>
          ))}
        </NavbarContent>
      )}
        
        <NavbarContent justify="end" className="gap-2">
          <NavbarItem>
            <Button 
              isIconOnly 
              variant="light" 
              color="primary"
              onPress={toggleTheme} 
              className="text-xl transition-colors"
              radius="lg"
            >
              {isDarkMode ? <FaSun className="text-yellow-500" /> : <FaMoon className="text-purple-600" />}
            </Button>
          </NavbarItem>
          
          <NavbarItem className="flex gap-2">
            {hasAdminToken ? (
              <Dropdown placement="bottom-end" backdrop="blur">
                <DropdownTrigger>
                  <Button 
                    isIconOnly 
                    variant="solid" 
                    color="primary"
                    radius="lg"
                    className="shadow-md"
                  >
                    <FaUserCircle size={20} />
                  </Button>
                </DropdownTrigger>
                <DropdownMenu 
                  aria-label="Admin Actions" 
                  variant="flat"
                  classNames={{
                    base: "p-2",
                  }}
                >
                  <DropdownItem 
                    key="dashboard" 
                    onPress={() => navigate('/admin/dashboard')}
                    startContent={<FaShieldAlt className="text-primary" />}
                    className="h-10"
                  >
                    {role === 'super' ? '控制台' : '申请管理'}
                  </DropdownItem>
                  <DropdownItem 
                    key="logout" 
                    color="danger" 
                    onPress={handleAdminLogout} 
                    startContent={<FaSignOutAlt />}
                    className="h-10 text-danger"
                  >
                    登出管理员
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            ) : null}

            {hasUserToken ? (
              <Dropdown placement="bottom-end" backdrop="blur">
                <DropdownTrigger>
                  <Button 
                    variant="bordered" 
                    color="primary"
                    radius="lg"
                    className="shadow-sm font-bold"
                    startContent={<FaUserCircle size={18} />}
                  >
                    {userInfo.nickname || '用户中心'}
                  </Button>
                </DropdownTrigger>
                <DropdownMenu 
                  aria-label="User Actions" 
                  variant="flat"
                  classNames={{
                    base: "p-2",
                  }}
                >
                  <DropdownItem 
                    key="center" 
                    onPress={() => navigate('/user/center')}
                    startContent={<FaUserCircle className="text-primary" />}
                    className="h-10"
                  >
                    个人中心
                  </DropdownItem>
                  <DropdownItem 
                    key="logout" 
                    color="danger" 
                    onPress={handleUserLogout} 
                    startContent={<FaSignOutAlt />}
                    className="h-10 text-danger"
                  >
                    退出登录
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            ) : (
              !isAdminPage && !hasAdminToken && (
                <div className="flex gap-2">
                  <Button 
                    as={RouterLink} 
                    to="/login" 
                    color="primary" 
                    variant="flat" 
                    size="sm" 
                    className="font-bold px-4 h-9"
                    radius="lg"
                  >
                    登录
                  </Button>
                  <Button 
                    as={RouterLink} 
                    to="/register" 
                    color="primary" 
                    variant="solid" 
                    size="sm" 
                    className="font-bold px-4 h-9 shadow-sm"
                    radius="lg"
                  >
                    注册
                  </Button>
                </div>
              )
            )}

            {!isAdminPage && !hasAdminToken && (
              <Button 
                as={RouterLink} 
                to="/admin/login" 
                color="default" 
                variant="light" 
                size="sm" 
                className="font-bold px-2 h-9 text-default-400"
                radius="lg"
              >
                管理员
              </Button>
            )}
          </NavbarItem>
        </NavbarContent>
      </Navbar>

      <main className="flex-grow flex flex-col relative">
        {children}
      </main>

      <footer className="w-full py-10 text-center text-sm text-default-400 mt-auto border-t border-divider/30 bg-background/20 backdrop-blur-sm">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col items-center md:items-start gap-1">
            <p className="font-medium">&copy; {new Date().getFullYear()} Invite System. All rights reserved.</p>
            <p className="text-tiny opacity-60">让每一次加入都充满期待</p>
          </div>
          <div className="flex items-center gap-8">
            <Link 
              size="sm" 
              color="foreground" 
              isExternal 
              href="https://github.com/MoonSeaFishCat"
              className="hover:text-primary transition-colors font-medium"
            >
              GitHub
            </Link>
            <div className="w-1 h-1 bg-default-300 rounded-full" />
            <Link 
              size="sm" 
              color="foreground" 
              href="#"
              className="hover:text-primary transition-colors font-medium"
            >
              服务条款
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
