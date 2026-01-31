import { useState, useEffect } from 'react';
import { Card, CardBody, CardHeader, Button, Divider, Chip, Progress, Skeleton } from "@heroui/react";
import api from '../../api/client';
import {
  FaUsers,
  FaPaperPlane,
  FaTicketAlt,
  FaEnvelope,
  FaChartBar,
  FaSync,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaUserShield,
  FaComments,
  FaExclamationTriangle,
  FaTrophy,
  FaServer
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

export default function Overview() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStats();
    // 每30秒自动刷新一次
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
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

  // 计算申请通过率
  const approvalRate = stats?.total_apps > 0
    ? ((stats?.approved_apps || 0) / stats.total_apps * 100).toFixed(1)
    : 0;

  // 计算工单处理率
  const ticketProcessRate = stats?.total_tickets > 0
    ? (((stats?.total_tickets - stats?.open_tickets) || 0) / stats.total_tickets * 100).toFixed(1)
    : 0;

  const primaryStats = [
    {
      title: "待审核申请",
      value: stats?.pending_apps || 0,
      icon: <FaClock />,
      color: "warning",
      bgGradient: "from-yellow-500 to-orange-500",
      tab: "applications",
      description: "需要立即处理"
    },
    {
      title: "待处理工单",
      value: stats?.open_tickets || 0,
      icon: <FaTicketAlt />,
      color: "primary",
      bgGradient: "from-blue-500 to-cyan-500",
      tab: "tickets",
      description: "用户等待回复"
    },
    {
      title: "注册用户",
      value: stats?.total_users || 0,
      icon: <FaUsers />,
      color: "success",
      bgGradient: "from-green-500 to-emerald-500",
      tab: "users",
      description: "平台总用户数"
    },
    {
      title: "站内消息",
      value: stats?.total_messages || 0,
      icon: <FaEnvelope />,
      color: "secondary",
      bgGradient: "from-purple-500 to-pink-500",
      tab: "messages",
      description: "已发送通知"
    }
  ];

  const applicationStats = [
    {
      label: "总申请",
      value: stats?.total_apps || 0,
      icon: <FaPaperPlane />,
      color: "default"
    },
    {
      label: "已通过",
      value: stats?.approved_apps || 0,
      icon: <FaCheckCircle />,
      color: "success"
    },
    {
      label: "已拒绝",
      value: stats?.rejected_apps || 0,
      icon: <FaTimesCircle />,
      color: "danger"
    },
    {
      label: "待审核",
      value: stats?.pending_apps || 0,
      icon: <FaClock />,
      color: "warning"
    }
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* 页面标题 */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 text-white">
              <FaChartBar size={24} />
            </div>
            数据概览
          </h2>
          <p className="text-default-500 text-sm mt-2">
            实时监控系统运行状态 · 最后更新: {new Date().toLocaleTimeString()}
          </p>
        </div>
        <Button
          isIconOnly
          variant="flat"
          color="primary"
          onPress={fetchStats}
          isLoading={loading}
          radius="full"
          size="lg"
        >
          <FaSync size={16} />
        </Button>
      </div>

      {/* 主要统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {primaryStats.map((card, index) => (
          <Card
            key={index}
            isPressable
            onPress={() => navigate(`/admin?tab=${card.tab}`)}
            className="shadow-lg hover:shadow-xl transition-all duration-300 border-none overflow-hidden"
          >
            <CardBody className="p-0">
              {loading ? (
                <div className="p-6">
                  <Skeleton className="rounded-lg h-24" />
                </div>
              ) : (
                <>
                  {/* 渐变背景 */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${card.bgGradient} opacity-5`} />

                  <div className="relative p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-default-500 text-xs font-medium uppercase tracking-wider">
                          {card.title}
                        </span>
                        <span className="text-4xl font-bold bg-gradient-to-br from-default-900 to-default-600 bg-clip-text text-transparent">
                          {card.value}
                        </span>
                      </div>
                      <div className={`p-3 rounded-2xl bg-gradient-to-br ${card.bgGradient} text-white shadow-lg`}>
                        <div className="text-2xl">
                          {card.icon}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-default-400">{card.description}</p>
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 申请统计详情 */}
        <Card className="lg:col-span-2 shadow-lg border-none">
          <CardHeader className="px-6 py-4 border-b border-divider">
            <div className="flex items-center gap-2">
              <FaPaperPlane className="text-primary" />
              <h3 className="font-bold text-lg">申请统计</h3>
            </div>
          </CardHeader>
          <CardBody className="p-6">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="rounded-lg h-20" />
                <Skeleton className="rounded-lg h-20" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* 申请数量统计 */}
                <div className="grid grid-cols-4 gap-4">
                  {applicationStats.map((stat, index) => (
                    <div key={index} className="text-center">
                      <div className={`inline-flex p-3 rounded-xl bg-${stat.color}/10 text-${stat.color} mb-2`}>
                        {stat.icon}
                      </div>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-xs text-default-500 mt-1">{stat.label}</p>
                    </div>
                  ))}
                </div>

                <Divider />

                {/* 通过率 */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">申请通过率</span>
                    <span className="text-sm font-bold text-success">{approvalRate}%</span>
                  </div>
                  <Progress
                    value={Number(approvalRate)}
                    color="success"
                    size="md"
                    className="max-w-full"
                  />
                </div>

                {/* 拒绝率 */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">申请拒绝率</span>
                    <span className="text-sm font-bold text-danger">
                      {stats?.total_apps > 0
                        ? ((stats?.rejected_apps || 0) / stats.total_apps * 100).toFixed(1)
                        : 0}%
                    </span>
                  </div>
                  <Progress
                    value={stats?.total_apps > 0
                      ? ((stats?.rejected_apps || 0) / stats.total_apps * 100)
                      : 0}
                    color="danger"
                    size="md"
                    className="max-w-full"
                  />
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        {/* 系统状态 */}
        <Card className="shadow-lg border-none">
          <CardHeader className="px-6 py-4 border-b border-divider">
            <div className="flex items-center gap-2">
              <FaServer className="text-success" />
              <h3 className="font-bold text-lg">系统状态</h3>
            </div>
          </CardHeader>
          <CardBody className="p-6">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="rounded-lg h-12" />
                <Skeleton className="rounded-lg h-12" />
                <Skeleton className="rounded-lg h-12" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 rounded-lg bg-success/10">
                  <div className="flex items-center gap-2">
                    <FaCheckCircle className="text-success" />
                    <span className="text-sm font-medium">运行状态</span>
                  </div>
                  <Chip color="success" size="sm" variant="flat">正常</Chip>
                </div>

                <Divider />

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-default-500">总申请量</span>
                    <span className="font-bold">{stats?.total_apps || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-default-500">总工单量</span>
                    <span className="font-bold">{stats?.total_tickets || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-default-500">审核员数</span>
                    <span className="font-bold">{stats?.total_admins || 0}</span>
                  </div>
                </div>

                <Divider />

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">工单处理率</span>
                    <span className="text-sm font-bold text-primary">{ticketProcessRate}%</span>
                  </div>
                  <Progress
                    value={Number(ticketProcessRate)}
                    color="primary"
                    size="sm"
                    className="max-w-full"
                  />
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* 快速操作和提醒 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 待办事项 */}
        <Card className="shadow-lg border-none">
          <CardHeader className="px-6 py-4 border-b border-divider">
            <div className="flex items-center gap-2">
              <FaExclamationTriangle className="text-warning" />
              <h3 className="font-bold text-lg">待办事项</h3>
            </div>
          </CardHeader>
          <CardBody className="p-6">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="rounded-lg h-16" />
                <Skeleton className="rounded-lg h-16" />
              </div>
            ) : (
              <div className="space-y-3">
                {(stats?.pending_apps || 0) > 0 && (
                  <div
                    className="flex items-center justify-between p-4 rounded-lg bg-warning/10 cursor-pointer hover:bg-warning/20 transition-colors"
                    onClick={() => navigate('/admin?tab=applications')}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-warning/20">
                        <FaClock className="text-warning" />
                      </div>
                      <div>
                        <p className="font-semibold">待审核申请</p>
                        <p className="text-xs text-default-500">需要尽快处理</p>
                      </div>
                    </div>
                    <Chip color="warning" variant="flat">{stats.pending_apps}</Chip>
                  </div>
                )}

                {(stats?.open_tickets || 0) > 0 && (
                  <div
                    className="flex items-center justify-between p-4 rounded-lg bg-primary/10 cursor-pointer hover:bg-primary/20 transition-colors"
                    onClick={() => navigate('/admin?tab=tickets')}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/20">
                        <FaTicketAlt className="text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">待处理工单</p>
                        <p className="text-xs text-default-500">用户等待回复</p>
                      </div>
                    </div>
                    <Chip color="primary" variant="flat">{stats.open_tickets}</Chip>
                  </div>
                )}

                {(stats?.pending_apps || 0) === 0 && (stats?.open_tickets || 0) === 0 && (
                  <div className="text-center py-8 text-default-400">
                    <FaTrophy className="text-4xl mx-auto mb-2 text-success" />
                    <p className="text-sm">太棒了！暂无待办事项</p>
                  </div>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        {/* 最近活动 */}
        <Card className="shadow-lg border-none">
          <CardHeader className="px-6 py-4 border-b border-divider">
            <div className="flex items-center gap-2">
              <FaComments className="text-secondary" />
              <h3 className="font-bold text-lg">平台活跃度</h3>
            </div>
          </CardHeader>
          <CardBody className="p-6">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="rounded-lg h-16" />
                <Skeleton className="rounded-lg h-16" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-blue-50 to-cyan-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100">
                      <FaUsers className="text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold">注册用户</p>
                      <p className="text-xs text-default-500">平台总用户数</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600">{stats?.total_users || 0}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-purple-50 to-pink-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-100">
                      <FaEnvelope className="text-purple-600" />
                    </div>
                    <div>
                      <p className="font-semibold">站内消息</p>
                      <p className="text-xs text-default-500">已发送通知</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-purple-600">{stats?.total_messages || 0}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100">
                      <FaUserShield className="text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold">审核团队</p>
                      <p className="text-xs text-default-500">审核员数量</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-600">{stats?.total_admins || 0}</p>
                  </div>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
