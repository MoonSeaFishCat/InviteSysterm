import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Navbar, NavbarBrand, NavbarContent, NavbarItem, Button } from "@heroui/react";
import { FaUser, FaUserShield, FaSignOutAlt, FaHeart, FaMoon, FaSun, FaComments } from 'react-icons/fa';
import { useTheme } from '../hooks/useTheme';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isAdminPath = location.pathname.startsWith('/admin');
  const isUserCenterPath = location.pathname.startsWith('/user/center');
  const userToken = localStorage.getItem('user_token');
  const isUserLoggedIn = !!userToken;

  // 管理后台和用户中心页面不显示前台导航
  if (isAdminPath || isUserCenterPath) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 前台导航栏 */}
      <Navbar isBordered maxWidth="full">
        <NavbarBrand className="cursor-pointer" onClick={() => navigate('/')}>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <FaHeart className="text-primary text-lg" />
            </div>
            <p className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
              邀请码申请系统
            </p>
          </div>
        </NavbarBrand>

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

          {/* 问答专区 */}
          <NavbarItem>
            <Button
              size="sm"
              variant="flat"
              startContent={<FaComments />}
              onPress={() => navigate('/forum')}
            >
              问答专区
            </Button>
          </NavbarItem>

          {isUserLoggedIn ? (
            <>
              <NavbarItem>
                <Button
                  size="sm"
                  variant="flat"
                  color="primary"
                  startContent={<FaUser />}
                  onPress={() => navigate('/user/center')}
                >
                  用户中心
                </Button>
              </NavbarItem>
              <NavbarItem>
                <Button
                  size="sm"
                  variant="light"
                  color="danger"
                  startContent={<FaSignOutAlt />}
                  onPress={() => {
                    localStorage.removeItem('user_token');
                    localStorage.removeItem('user_info');
                    navigate('/');
                  }}
                >
                  退出
                </Button>
              </NavbarItem>
            </>
          ) : (
            <>
              <NavbarItem>
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => navigate('/login')}
                >
                  登录
                </Button>
              </NavbarItem>
              <NavbarItem>
                <Button
                  size="sm"
                  color="primary"
                  onPress={() => navigate('/register')}
                >
                  注册
                </Button>
              </NavbarItem>
            </>
          )}
          <NavbarItem>
            <Button
              size="sm"
              variant="light"
              startContent={<FaUserShield />}
              onPress={() => navigate('/admin/login')}
            >
              管理后台
            </Button>
          </NavbarItem>
        </NavbarContent>
      </Navbar>

      {/* 主内容区域 */}
      <main>{children}</main>
    </div>
  );
}
