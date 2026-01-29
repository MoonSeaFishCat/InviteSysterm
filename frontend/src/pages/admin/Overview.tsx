import { useState, useEffect } from 'react';
import { Card, CardBody, CardHeader, Button, Divider, Chip } from "@heroui/react";
import api from '../../api/client';
import { FaUsers, FaPaperPlane, FaTicketAlt, FaEnvelope, FaChartBar, FaSync } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

export default function Overview() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/stats');
      setStats(res.data);
    } catch (error) {
      console.error("Failed to fetch stats", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "待审核申请",
      value: stats?.pending_apps || 0,
      icon: <FaPaperPlane className="text-warning" />,
      color: "warning",
      tab: "applications"
    },
    {
      title: "待处理工单",
      value: stats?.open_tickets || 0,
      icon: <FaTicketAlt className="text-primary" />,
      color: "primary",
      tab: "tickets"
    },
    {
      title: "总用户数",
      value: stats?.total_users || 0,
      icon: <FaUsers className="text-success" />,
      color: "success",
      tab: "messages"
    },
    {
      title: "已发送通知",
      value: stats?.total_messages || 0,
      icon: <FaEnvelope className="text-secondary" />,
      color: "secondary",
      tab: "messages"
    }
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FaChartBar className="text-primary" />
            数据概览
          </h2>
          <p className="text-default-500 text-sm">欢迎回来，这是系统的实时运行数据。</p>
        </div>
        <Button 
          isIconOnly 
          variant="flat" 
          onPress={fetchStats} 
          isLoading={loading}
          radius="full"
        >
          <FaSync size={14} />
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => (
          <Card 
            key={index} 
            isPressable 
            onPress={() => navigate(`/admin?tab=${card.tab}`)}
            className="shadow-sm border border-divider hover:border-primary/50 transition-colors"
          >
            <CardBody className="p-6">
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-1">
                  <span className="text-default-500 text-sm font-medium">{card.title}</span>
                  <span className="text-3xl font-bold">{card.value}</span>
                </div>
                <div className={`p-3 rounded-xl bg-${card.color}/10 text-xl`}>
                  {card.icon}
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border border-divider">
          <CardHeader className="px-6 py-4 border-b border-divider">
            <h3 className="font-bold">快速操作</h3>
          </CardHeader>
          <CardBody className="p-6">
            <div className="grid grid-cols-2 gap-4">
              <Button 
                color="primary" 
                variant="flat" 
                className="h-20 flex flex-col gap-2"
                onPress={() => navigate('/admin?tab=applications')}
              >
                <FaPaperPlane />
                <span>审核申请</span>
              </Button>
              <Button 
                color="secondary" 
                variant="flat" 
                className="h-20 flex flex-col gap-2"
                onPress={() => navigate('/admin?tab=tickets')}
              >
                <FaTicketAlt />
                <span>处理工单</span>
              </Button>
              <Button 
                color="success" 
                variant="flat" 
                className="h-20 flex flex-col gap-2"
                onPress={() => navigate('/admin?tab=messages')}
              >
                <FaEnvelope />
                <span>发送通知</span>
              </Button>
              <Button 
                color="warning" 
                variant="flat" 
                className="h-20 flex flex-col gap-2"
                onPress={() => navigate('/admin?tab=announcements')}
              >
                <FaSync />
                <span>发布公告</span>
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card className="shadow-sm border border-divider">
          <CardHeader className="px-6 py-4 border-b border-divider">
            <h3 className="font-bold">系统信息</h3>
          </CardHeader>
          <CardBody className="p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <span className="text-default-500 text-sm">运行状态</span>
              <Chip color="success" size="sm" variant="dot">正常运行中</Chip>
            </div>
            <Divider />
            <div className="flex justify-between items-center">
              <span className="text-default-500 text-sm">总申请量</span>
              <span className="font-bold">{stats?.total_apps || 0}</span>
            </div>
            <Divider />
            <div className="flex justify-between items-center">
              <span className="text-default-500 text-sm">当前时间</span>
              <span className="text-sm">{new Date().toLocaleString()}</span>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
