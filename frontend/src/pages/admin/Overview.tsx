import { useState, useEffect } from 'react';
import { Card, CardBody, CardHeader, Button, Divider, Chip, Progress, Skeleton, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Textarea } from "@heroui/react";
import api from '../../api/client';
import { storage } from '../../utils/storage';
import toast from 'react-hot-toast';
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
  const [settings, setSettings] = useState<any>({});
  const [userInfo, setUserInfo] = useState<any>(storage.get('admin_user'));
  const navigate = useNavigate();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [showRules, setShowRules] = useState(false);
  const [kpi, setKpi] = useState<any>(null);

  const role = userInfo?.role || 'commenter';

  useEffect(() => {
    fetchStats();
    fetchSettings();
    fetchUserInfo();
    if (role === 'reviewer' || role === 'super') {
      fetchKPI();
    }
    // 每30秒自动刷新一次
    const interval = setInterval(() => {
      fetchStats();
      fetchUserInfo();
      if (role === 'reviewer' || role === 'super') {
        fetchKPI();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [role]);

  const fetchKPI = async () => {
    try {
      const res = await api.get('/admin/admins/kpi');
      if (res.data.success) {
        setKpi(res.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch KPI", error);
      // 如果获取失败，可能是后端还没部署好或者权限问题
      setKpi(null);
    }
  };

  const fetchUserInfo = async () => {
    try {
      const res = await api.get('/admin/me');
      if (res.data.success) {
        const newData = { ...userInfo, ...res.data.data };
        setUserInfo(newData);
        storage.set('admin_user', newData);
      }
    } catch (error) {
      console.error("Failed to fetch user info", error);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await api.get('/admin/settings');
      setSettings(res.data);
    } catch (error: any) {
      console.error("Failed to fetch settings", error);
      // 如果获取失败且是 403 权限问题，说明当前角色无法获取设置
      // 这种情况下我们可以根据业务需求设置一些默认值，或者静默失败
      if (error.response?.status === 403) {
        console.warn("Current role does not have permission to access settings.");
      }
    }
  };

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

  useEffect(() => {
    let timer: any;
    if (showRules && countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (showRules && countdown === 0) {
      handleApplyAuditor();
      setShowRules(false);
    }
    return () => clearInterval(timer);
  }, [showRules, countdown]);

  const handleOpenApply = () => {
    if (settings.auditor_no_review === 'true') {
      setShowRules(true);
      setCountdown(10);
    } else {
      setShowRules(false);
    }
    onOpen();
  };

  const handleApplyAuditor = async () => {
    if (settings.auditor_no_review !== 'true' && !reason.trim()) {
      toast.error("请输入申请理由");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/admin/auditor/apply', { 
        reason: settings.auditor_no_review === 'true' ? '' : reason 
      });
      if (res.data.success) {
        toast.success(res.data.message || "申请成功");
        onClose();
        setReason('');
        // 角色可能已经改变，提示用户刷新
        if (settings.auditor_no_review === 'true' || res.data.message.includes('免审核')) {
          toast.loading("角色已更新，正在刷新页面...", { duration: 2000 });
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "申请失败");
    } finally {
      setSubmitting(false);
    }
  };

  // 计算申请通过率
  const approvalRate = (stats?.total_apps || 0) > 0
    ? ((stats?.approved_apps || 0) / stats.total_apps * 100).toFixed(1)
    : 0;

  // 计算工单处理率
  const ticketProcessRate = (stats?.total_tickets || 0) > 0
    ? (((stats?.total_tickets - (stats?.open_tickets || 0)) || 0) / stats.total_tickets * 100).toFixed(1)
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

  const roleMap: any = {
    'super': { label: '超级管理员', color: 'danger' },
    'reviewer': { label: '审核员', color: 'primary' },
    'commenter': { label: '评论员', color: 'success' }
  };

  const getPermissionLabels = (perms: string) => {
    if (!perms) return '无特别权限';
    if (perms === 'all') return '所有权限';
    const permMap: any = {
      'users': '用户管理',
      'applications': '申请审核',
      'settings': '系统设置',
      'admins': '管理员管理',
      'messages': '站内信',
      'tickets': '工单处理',
      'blacklist': '黑名单',
      'announcements': '公告管理'
    };
    return perms.split(',').map(p => permMap[p.trim()] || p.trim()).join(', ');
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 页面标题和用户信息 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 text-white">
              <FaChartBar size={24} />
            </div>
            数据概览
          </h2>
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <Chip 
              variant="flat" 
              color={roleMap[role]?.color || "default"}
              startContent={<FaUserShield className="ml-1" />}
              className="font-bold"
            >
              当前角色: {roleMap[role]?.label || role}
            </Chip>
            <div className="flex items-center gap-2 text-default-500 text-xs bg-default-100 px-3 py-1 rounded-full">
              <span className="font-semibold text-default-600">拥有的权限:</span>
              <span>{getPermissionLabels(userInfo?.permissions)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-default-400 text-xs hidden sm:block">
            最后更新: {new Date().toLocaleTimeString()}
          </p>
          <Button
            isIconOnly
            variant="flat"
            color="primary"
            onPress={() => { fetchStats(); fetchUserInfo(); }}
            isLoading={loading}
            radius="full"
            size="lg"
          >
            <FaSync size={16} />
          </Button>
        </div>
      </div>

      {/* KPI 提示消息 */}
      {(role === 'reviewer' || role === 'super') && kpi && (
        <Card className={`border-none shadow-md bg-gradient-to-r ${kpi.is_met ? 'from-success-50/50 to-success-100/50' : 'from-warning-50/50 to-warning-100/50'}`}>
          <CardBody className="py-4 px-6 flex flex-row items-center gap-4">
            <div className={`p-3 rounded-full ${kpi.is_met ? 'bg-success text-white' : 'bg-warning text-white'}`}>
              {kpi.is_met ? <FaCheckCircle size={20} /> : <FaExclamationTriangle size={20} />}
            </div>
            <div className="flex-1">
              <h4 className={`font-bold ${kpi.is_met ? 'text-success-700' : 'text-warning-700'} flex items-center gap-2`}>
                {kpi.is_met ? '本周审核指标已达成' : '本周审核指标待完成'}
                {kpi.is_met && <Chip size="sm" color="success" variant="flat">达标</Chip>}
              </h4>
              <p className="text-sm text-default-600">
                本周已审核: <span className="font-bold text-default-900">{kpi.count}</span> / 最小要求: <span className="font-bold text-default-900">{kpi.quota}</span>
                {kpi.remaining > 0 ? `，还需完成 ${kpi.remaining} 份申请审核。` : '，感谢您的辛勤工作！'}
              </p>
              {!kpi.is_met && role === 'reviewer' && (
                <p className="text-xs text-danger-500 mt-1 font-medium flex items-center gap-1">
                  <FaExclamationTriangle size={10} />
                  注意：若本周结束时未达到最小审核量（{kpi.quota}），系统将自动回收权限并拉黑。
                </p>
              )}
            </div>
            <div className="hidden md:block w-32">
              <Progress 
                size="sm" 
                value={(kpi.count / kpi.quota) * 100} 
                color={kpi.is_met ? "success" : "warning"}
                className="max-w-md"
              />
              <p className="text-[10px] text-center mt-1 text-default-400">完成进度: {Math.min(100, Math.round((kpi.count / kpi.quota) * 100))}%</p>
            </div>
          </CardBody>
        </Card>
      )}

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
                      {(stats?.total_apps || 0) > 0
                        ? ((stats?.rejected_apps || 0) / stats.total_apps * 100).toFixed(1)
                        : 0}%
                    </span>
                  </div>
                  <Progress
                    value={(stats?.total_apps || 0) > 0
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

      {/* 申请成为审核员 (仅限普通管理员/评论员) */}
      {role === 'commenter' && (
        <Card className="shadow-lg border-none bg-gradient-to-br from-primary-500/10 to-secondary-500/10 border-1 border-primary/20">
          <CardHeader className="px-6 py-4 border-b border-divider/50">
            <div className="flex items-center gap-2">
              <FaUserShield className="text-primary" />
              <h3 className="font-bold text-lg">加入审核团队</h3>
            </div>
          </CardHeader>
          <CardBody className="p-6 flex flex-col gap-4">
            <p className="text-sm text-default-600">
              你想参与到平台的申请审核中吗？作为审核员，你可以为每一份申请投出宝贵的一票。
            </p>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs text-default-500">
                <FaCheckCircle className="text-success" />
                <span>参与投票决策</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-default-500">
                <FaCheckCircle className="text-success" />
                <span>进入审核员排行榜</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-default-500">
                <FaCheckCircle className="text-success" />
                <span>获得专属勋章</span>
              </div>
            </div>
            <Button 
              color="primary" 
              className="mt-2 font-bold"
              onPress={handleOpenApply}
              startContent={<FaPaperPlane />}
            >
              立即申请
            </Button>
          </CardBody>
        </Card>
      )}

      {/* 申请模态框 */}
      <Modal isOpen={isOpen} onClose={onClose} size="md">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            {showRules ? "审核员工作要求和规则" : "申请成为审核员"}
          </ModalHeader>
          <ModalBody>
            {showRules ? (
              <div className="space-y-4">
                <div className="p-4 bg-primary-50 rounded-xl border border-primary-100">
                  <h4 className="font-bold text-primary mb-2 flex items-center gap-2">
                    <FaExclamationTriangle /> 审核员守则
                  </h4>
                  <ul className="text-xs text-default-600 space-y-2 list-disc pl-4">
                    <li>客观公正：根据申请人的理由和活跃度进行客观评价。</li>
                    <li>严禁泄露：不得向外界泄露申请人的个人隐私信息。</li>
                    <li>保持活跃：长期不参与审核可能会被收回权限。</li>
                    <li>严禁滥用：禁止恶意投反对票或无理由通过申请。</li>
                  </ul>
                </div>
                <div className="flex flex-col items-center justify-center py-4 gap-2">
                  <Progress 
                    value={countdown * 10} 
                    color="primary" 
                    className="max-w-xs"
                    showValueLabel={true}
                    label={`申请处理中，请阅读守则...`}
                    formatOptions={{ style: 'unit', unit: 'second' }}
                    valueLabel={`${countdown}s`}
                  />
                  <p className="text-tiny text-default-400">倒计时结束将自动为您开通权限</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-default-500">
                  请简述你的申请理由（例如：你的活跃度、为什么想加入审核团队等）。
                </p>
                <Textarea
                  label="申请理由"
                  placeholder="请输入你的申请理由..."
                  value={reason}
                  onValueChange={setReason}
                  minRows={4}
                  variant="flat"
                />
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            {!showRules && (
              <>
                <Button variant="light" onPress={onClose} isDisabled={submitting}>
                  取消
                </Button>
                <Button 
                  color="primary" 
                  onPress={handleApplyAuditor}
                  isLoading={submitting}
                >
                  提交申请
                </Button>
              </>
            )}
            {showRules && (
              <Button color="danger" variant="flat" onPress={onClose}>
                我再想想 (取消申请)
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
