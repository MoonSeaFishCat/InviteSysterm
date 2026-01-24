import React from "react";
import { getSession } from "../../lib/auth";
import { redirect } from "next/navigation";
import LogoutButton from "../../components/LogoutButton";
import Link from "next/link";
import { Settings as SettingsIcon, LayoutDashboard, ClipboardList } from "lucide-react";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  
  return (
    <div className="min-h-screen bg-gray-50/50">
      <nav className="bg-white border-b border-gray-100 p-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/admin" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-pink-400 to-rose-400 flex items-center justify-center">
                <span className="text-white font-bold">L</span>
              </div>
              <span className="font-semibold text-gray-700">邀请码管理系统</span>
            </Link>
            
            <div className="hidden md:flex items-center gap-1">
              <Link 
                href="/admin" 
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <LayoutDashboard size={18} />
                仪表盘
              </Link>
              <Link 
                href="/admin/logs" 
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <ClipboardList size={18} />
                申请日志
              </Link>
              <Link 
                href="/admin/settings" 
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <SettingsIcon size={18} />
                系统设置
              </Link>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">管理员</span>
            {session && <LogoutButton />}
          </div>
        </div>
      </nav>
      <main className="p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}
