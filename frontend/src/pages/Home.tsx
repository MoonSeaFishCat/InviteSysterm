import { useEffect, useState } from 'react';
import { Card, CardBody, Button, ScrollShadow } from "@heroui/react";
import api from '../api/client';
import type { Stats } from '../types';
import { useNavigate } from 'react-router-dom';
import { 
  FaPaperPlane, 
  FaBullhorn,
  FaHeart
} from 'react-icons/fa';

interface Announcement {
  id: number;
  content: string;
  created_at: number;
}

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);
  const navigate = useNavigate();
  const userToken = localStorage.getItem('user_token');

  // Status state
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, annRes] = await Promise.all([
          api.get('/stats'),
          api.get('/announcements')
        ]);
        setStats(statsRes.data);
        setAnnouncements(Array.isArray(annRes.data) ? annRes.data : []);
      } catch (error) {
        console.error("Failed to fetch data", error);
      }
    };
    fetchData();
  }, []);

  const formatDate = (dateVal: any, showTime: boolean = false) => {
    if (!dateVal) return '';
    try {
      let date: Date;
      if (typeof dateVal === 'number') {
        date = new Date(dateVal * 1000);
      } else {
        date = new Date(dateVal);
        if (isNaN(date.getTime())) {
          const num = Number(dateVal);
          if (!isNaN(num)) {
            date = new Date(num * 1000);
          } else {
            return 'Invalid Date';
          }
        }
      }
      return showTime ? date.toLocaleString() : date.toLocaleDateString();
    } catch (e) {
      return 'Invalid Date';
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-64px)] flex flex-col items-center justify-center py-12 px-4">
      <div className="w-full max-w-3xl z-10">
        <header className="text-center mb-12">
          <div 
            className="inline-flex items-center justify-center w-20 h-20 rounded-large bg-primary/10 dark:bg-primary/20 mb-6 shadow-inner"
          >
            <FaHeart className="text-primary text-3xl drop-shadow-sm" />
          </div>
          <h1 className="text-4xl md:text-6xl font-black mb-6 tracking-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-500 to-pink-500 animate-gradient-x">
              {stats?.siteName || "社区邀请系统"}
            </span>
          </h1>
          <p className="text-default-500 dark:text-default-400 max-w-xl mx-auto leading-relaxed text-lg font-medium">
            {stats?.announcement || "每一份热爱都值得被温柔以待。目前我们采取邀请制，请提交申请获取属于您的邀请码。"}
          </p>
        </header>

        {announcements.length > 0 && (
          <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
            <Card className="bg-primary/5 dark:bg-primary/10 border-none shadow-none" radius="lg">
              <CardBody className="py-4 px-6">
                <div className="flex items-start gap-4">
                  <div className="mt-1 bg-primary/20 p-2 rounded-medium">
                    <FaBullhorn className="text-primary text-sm" />
                  </div>
                  <div className="flex-grow">
                    <ScrollShadow className="max-h-[100px]">
                      <div className="space-y-3">
                        {announcements.map((ann) => (
                          <div key={ann.id} className="text-sm font-medium text-default-700 leading-relaxed">
                            {ann.content}
                            <span className="ml-2 text-[10px] text-default-400 font-bold">
                              {formatDate(ann.created_at)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </ScrollShadow>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        )}

        <Card 
          className="border-none bg-white/60 dark:bg-default-100/10 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden"
          radius="lg"
        >
          <CardBody className="p-8 md:p-12">
            <div className="flex flex-col items-center gap-10">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full">
                <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-primary/5 dark:bg-primary/10 transition-transform hover:scale-105 duration-300">
                  <span className="text-3xl font-black text-primary mb-2">{stats?.total || 0}</span>
                  <span className="text-xs font-bold text-default-400 uppercase tracking-wider">累计申请</span>
                </div>
                <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-success/5 dark:bg-success/10 transition-transform hover:scale-105 duration-300">
                  <span className="text-3xl font-black text-success mb-2">{stats?.approved || 0}</span>
                  <span className="text-xs font-bold text-default-400 uppercase tracking-wider">成功加入</span>
                </div>
                <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-warning/5 dark:bg-warning/10 transition-transform hover:scale-105 duration-300">
                  <span className="text-3xl font-black text-warning mb-2">{stats?.pending || 0}</span>
                  <span className="text-xs font-bold text-default-400 uppercase tracking-wider">待处理</span>
                </div>
                <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-danger/5 dark:bg-danger/10 transition-transform hover:scale-105 duration-300">
                  <span className="text-3xl font-black text-danger mb-2">{stats?.rejected || 0}</span>
                  <span className="text-xs font-bold text-default-400 uppercase tracking-wider">已拒绝</span>
                </div>
              </div>

              <div className="w-full h-px bg-gradient-to-r from-transparent via-divider to-transparent opacity-50" />

              <div className="text-center space-y-8 max-w-lg mx-auto">
                <div className="space-y-4">
                  <h2 className="text-2xl font-black tracking-tight">开启您的社区之旅</h2>
                  <p className="text-default-500 font-medium leading-relaxed">
                    为了维护社区的高质量交流环境，我们采取实名制与邀请制。
                    您可以先注册账号，登录后在个人中心提交申请。
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Button 
                    color="primary" 
                    size="lg"
                    onPress={() => navigate(userToken ? '/user/center' : '/register')}
                    className="font-black h-14 px-10 text-lg shadow-lg shadow-primary/20 group"
                    endContent={<FaPaperPlane className="text-sm group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />}
                  >
                    {userToken ? '进入个人中心' : '立即注册账号'}
                  </Button>
                  {!userToken && (
                    <Button 
                      variant="flat" 
                      size="lg"
                      onPress={() => navigate('/login')}
                      className="font-bold h-14 px-10 text-lg"
                    >
                      已有账号登录
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Simple Stats Footer */}
        {stats && (
          <div className="mt-16 grid grid-cols-3 gap-8 md:gap-12 opacity-90">
            <div className="text-center group">
              <p className="text-3xl md:text-4xl font-black mb-2 text-default-800 group-hover:text-primary transition-colors">{stats.total}</p>
              <p className="text-[10px] md:text-xs uppercase font-black text-default-400 tracking-[0.2em]">累计申请</p>
            </div>
            <div className="text-center group">
              <p className="text-3xl md:text-4xl font-black mb-2 text-default-800 group-hover:text-success transition-colors">{stats.approved}</p>
              <p className="text-[10px] md:text-xs uppercase font-black text-default-400 tracking-[0.2em]">已通过</p>
            </div>
            <div className="text-center group">
              <p className="text-3xl md:text-4xl font-black mb-2 text-default-800 group-hover:text-warning transition-colors">{stats.pending}</p>
              <p className="text-[10px] md:text-xs uppercase font-black text-default-400 tracking-[0.2em]">待审核</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
