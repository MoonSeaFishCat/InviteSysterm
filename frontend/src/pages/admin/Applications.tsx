import { useState, useEffect } from 'react';
import {
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Chip, Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  useDisclosure, Textarea, Input, Spinner, Select, SelectItem, Pagination,
  Tooltip, Card, CardBody, Badge, Progress, Avatar
} from "@heroui/react";
import {
  FaCheck, FaTimes, FaInfoCircle, FaSync, FaSearch, FaCopy, FaEnvelope,
  FaCalendarAlt, FaGlobe, FaFingerprint, FaTrash, FaHistory, FaClock,
  FaCheckCircle, FaTimesCircle, FaHourglassHalf, FaUserShield, FaFilter,
  FaRobot, FaBrain, FaSearchPlus, FaChartBar
} from 'react-icons/fa';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { storage } from '../../utils/storage';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Application {
  id: number;
  email: string;
  userNickname: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  deviceId: string;
  ip: string;
  createdAt: string;
  adminNote?: string;
  reviewOpinion?: string;
  adminUsername?: string;
  aigcScore?: number;
  aigcConfidence?: string;
  aigcEvidence?: string;
  aigcAnalysis?: string;
  aigcRelevance?: number;
  aigcAuthenticity?: number;
  aigcCompleteness?: number;
  aigcExpression?: number;
  aigcReply?: string;
}

interface ApplicationDetail {
  application: Application;
  history: Application[];
  readOnly?: boolean;
  lockedBy?: string;
}

import type { ApplicationVote } from '../../types';
import { FaThumbsUp, FaThumbsDown, FaCommentDots } from 'react-icons/fa';

export default function Applications() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'approved' | 'rejected'>('approved');
  const [inviteCode, setInviteCode] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [reviewOpinion, setReviewOpinion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<any>(new Set());
  const [applicationDetail, setApplicationDetail] = useState<ApplicationDetail | null>(null);
  const [lockRefreshInterval, setLockRefreshInterval] = useState<number | null>(null);
  const [globalStats, setGlobalStats] = useState<any>(null);
  const [votes, setVotes] = useState<ApplicationVote[]>([]);
  const [myVote, setMyVote] = useState<{opinion: string, comment: string}>({opinion: 'agree', comment: ''});
  const [voting, setVoting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const {isOpen, onOpen, onClose} = useDisclosure();
  const deleteModal = useDisclosure();
  const batchReviewModal = useDisclosure();
  const batchDeleteModal = useDisclosure();
  const [appToDelete, setAppToDelete] = useState<Application | null>(null);

  // Get user role
  const adminUser = storage.get('admin_user') || {};
  const role = adminUser.role || 'reviewer';

  const fetchVotes = async (appId: number) => {
    try {
      const res = await api.get(`/admin/applications/${appId}/votes`);
      if (res.data.success) {
        setVotes(res.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch votes", error);
    }
  };

  const handleVote = async () => {
    if (!selectedApp) return;
    setVoting(true);
    try {
      const res = await api.post(`/admin/applications/${selectedApp.id}/vote`, myVote);
      if (res.data.success) {
        toast.success("投票成功");
        fetchVotes(selectedApp.id);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "投票失败");
    } finally {
      setVoting(false);
    }
  };

  const handleAnalyzeAIGC = async () => {
    if (!selectedApp) return;
    setAnalyzing(true);
    try {
      const res = await api.post(`/admin/applications/${selectedApp.id}/analyze-aigc`);
      if (res.data.success) {
        toast.success("AI 分析完成");
        // 更新详情中的数据
        if (applicationDetail) {
          setApplicationDetail({
            ...applicationDetail,
            application: {
              ...applicationDetail.application,
              ...res.data.data,
              aigcScore: res.data.data.score,
              aigcConfidence: res.data.data.confidence,
              aigcEvidence: res.data.data.evidence,
              aigcAnalysis: res.data.data.analysis,
              aigcRelevance: res.data.data.relevance,
              aigcAuthenticity: res.data.data.authenticity,
              aigcCompleteness: res.data.data.completeness,
              aigcExpression: res.data.data.expression,
              aigcReply: res.data.data.reply
            }
          });
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "AI 分析失败");
    } finally {
      setAnalyzing(false);
    }
  };

  const fetchApps = async () => {
    setLoading(true);
    try {
      const params: any = {
        page,
        pageSize,
      };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (searchQuery) params.search = searchQuery;

      const res = await api.get('/admin/applications', { params });
      if (res.data && res.data.items) {
        setApps(res.data.items);
        setTotal(res.data.total);
      } else {
        setApps(Array.isArray(res.data) ? res.data : []);
      }
    } catch (error: any) {
      toast.error("无法加载申请列表");
    } finally {
      setLoading(false);
    }
  };

  const fetchGlobalStats = async () => {
    try {
      const res = await api.get('/admin/stats');
      setGlobalStats(res.data);
    } catch (error: any) {
      console.error("Failed to fetch global stats", error);
    }
  };

  useEffect(() => {
    fetchGlobalStats();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchApps();
    }, 300);
    return () => clearTimeout(timer);
  }, [statusFilter, searchQuery, page, pageSize]);

  const handleOpenDetail = async (app: Application) => {
    setSelectedApp(app);
    setReviewStatus('approved');
    setInviteCode('');
    setAdminNote(app.adminNote || '');
    setReviewOpinion(app.reviewOpinion || '');
    setVotes([]);
    fetchVotes(app.id);

    // 获取详细信息和历史记录
    try {
      const res = await api.get(`/admin/applications/${app.id}`);
      if (res.data.success) {
        setApplicationDetail(res.data);

        // 如果不是只读模式且不是评论员，启动锁定刷新定时器
        if (!res.data.readOnly && role !== 'commenter') {
          const interval = window.setInterval(async () => {
            try {
              await api.post(`/admin/applications/${app.id}/refresh-lock`);
            } catch (error: any) {
              if (error.response?.status === 423) {
                toast.error(error.response?.data?.message || '该申请已被其他审核员占用');
                handleCloseDetail();
              }
            }
          }, 2 * 60 * 1000);

          setLockRefreshInterval(interval);
        } else if (res.data.readOnly) {
          toast(`该申请正在被 ${res.data.lockedBy} 审核中，您处于只读模式`, {
            duration: 5000,
            icon: 'ℹ️',
          });
        }
      } else if (res.data.locked) {
        toast.error(res.data.message || '该申请正在被其他审核员审核中');
        return;
      }
    } catch (error: any) {
      if (error.response?.status === 423) {
        toast.error(error.response?.data?.message || '该申请正在被其他审核员审核中');
        return;
      }
      console.error('Failed to fetch application detail:', error);
    }

    onOpen();
  };

  const handleCloseDetail = () => {
    // 清除锁定刷新定时器
    if (lockRefreshInterval) {
      clearInterval(lockRefreshInterval);
      setLockRefreshInterval(null);
    }

    // 解锁申请（只读模式不需要解锁）
    if (selectedApp && !applicationDetail?.readOnly) {
      api.post(`/admin/applications/${selectedApp.id}/unlock`).catch(err => {
        console.error('Failed to unlock application:', err);
      });
    }

    setApplicationDetail(null);
    onClose();
  };

  const submitReview = async () => {
    if (!selectedApp) return;
    if (reviewStatus === 'approved' && !inviteCode) {
      toast.error("请输入邀请码");
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/admin/review', {
        appId: selectedApp.id,
        status: reviewStatus,
        data: {
          code: inviteCode,
          note: adminNote,
          opinion: reviewOpinion
        }
      });
      toast.success("审核提交成功");
      handleCloseDetail();
      fetchApps();
    } catch (error: any) {
      if (error.response?.status === 423) {
        toast.error(error.response?.data?.message || "该申请已被其他审核员占用");
        handleCloseDetail();
      } else {
        toast.error(error.response?.data?.message || "审核失败");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!appToDelete) return;
    
    setSubmitting(true);
    try {
      await api.delete(`/admin/applications/${appToDelete.id}`);
      toast.success("删除成功");
      deleteModal.onClose();
      fetchApps();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "删除失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBatchReview = async (status: 'approved' | 'rejected') => {
    if (selectedKeys.size === 0) {
      toast.error("请选择申请");
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/admin/applications/batch-review', {
        appIds: Array.from(selectedKeys).map(id => Number(id)),
        status,
        data: {
          opinion: reviewOpinion,
          note: adminNote
        }
      });
      toast.success("批量处理成功");
      batchReviewModal.onClose();
      setSelectedKeys(new Set());
      fetchApps();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "批量处理失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedKeys.size === 0) {
      toast.error("请选择申请");
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/admin/applications/batch-delete', {
        appIds: Array.from(selectedKeys).map(id => Number(id))
      });
      toast.success("批量删除成功");
      batchDeleteModal.onClose();
      setSelectedKeys(new Set());
      fetchApps();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "批量删除失败");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateVal: any) => {
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
      return date.toLocaleString();
    } catch (e) {
      return 'Invalid Date';
    }
  };

  const renderCell = (app: Application, columnKey: React.Key) => {
    switch (columnKey) {
      case "userNickname":
        return (
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <p className="text-bold text-sm capitalize">{app.userNickname || "未知用户"}</p>
              {app.email && app.email !== '********' && (
                <Button 
                  size="sm" 
                  variant="light" 
                  color="primary"
                  isIconOnly 
                  className="h-6 w-6 min-w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(app.email);
                    toast.success("邮箱已复制");
                  }}
                >
                  <FaCopy className="text-[12px]" />
                </Button>
              )}
            </div>
            {role === 'super' && <p className="text-bold text-tiny text-default-400">{app.email}</p>}
          </div>
        );
      case "reason":
        return (
          <div className="max-w-[300px] truncate text-default-600" title={app.reason}>
            {app.reason}
          </div>
        );
      case "status":
        const statusColors: Record<string, "warning" | "success" | "danger" | "default"> = {
          pending: "warning",
          approved: "success",
          rejected: "danger"
        };
        return (
          <Chip className="capitalize font-bold" color={statusColors[app.status]} size="sm" variant="flat">
            {app.status === 'pending' ? '待审核' : app.status === 'approved' ? '已批准' : '已拒绝'}
          </Chip>
        );
      case "createdAt":
        return (
          <div className="text-default-500 text-sm">
            {formatDate(app.createdAt)}
          </div>
        );
      case "actions":
        return (
          <div className="relative flex items-center justify-end gap-2">
            <Button 
              size="sm" 
              variant="flat" 
              color="primary"
              onPress={() => handleOpenDetail(app)}
              startContent={<FaInfoCircle />}
              className="font-bold shadow-sm"
            >
              详情
            </Button>
            {role === 'super' && (
              <Tooltip content="删除申请" color="danger">
                <Button 
                  size="sm" 
                  variant="flat" 
                  color="danger"
                  isIconOnly
                  onPress={() => {
                    setAppToDelete(app);
                    deleteModal.onOpen();
                  }}
                  className="font-bold shadow-sm"
                >
                  <FaTrash />
                </Button>
              </Tooltip>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  // 统计数据 - 使用全局统计数据
  const stats = {
    total: globalStats?.total_apps || 0,
    pending: globalStats?.pending_apps || 0,
    approved: globalStats?.approved_apps || 0,
    rejected: globalStats?.rejected_apps || 0,
  };

  return (
    <div className="flex flex-col gap-6 w-full p-6">
      {/* 页面标题 */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
          <FaEnvelope className="text-2xl text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            申请管理
          </h1>
          <p className="text-sm text-default-500 mt-1">管理和审核用户的邀请码申请</p>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-none bg-gradient-to-br from-blue-500/10 to-cyan-500/10 shadow-md hover:shadow-lg transition-shadow">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-default-500 uppercase">总申请</p>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">{stats.total}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <FaEnvelope className="text-2xl text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="border-none bg-gradient-to-br from-yellow-500/10 to-orange-500/10 shadow-md hover:shadow-lg transition-shadow">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-default-500 uppercase">待审核</p>
                <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">{stats.pending}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <FaHourglassHalf className="text-2xl text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="border-none bg-gradient-to-br from-green-500/10 to-emerald-500/10 shadow-md hover:shadow-lg transition-shadow">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-default-500 uppercase">已通过</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">{stats.approved}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <FaCheckCircle className="text-2xl text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="border-none bg-gradient-to-br from-red-500/10 to-pink-500/10 shadow-md hover:shadow-lg transition-shadow">
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-default-500 uppercase">已拒绝</p>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-1">{stats.rejected}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <FaTimesCircle className="text-2xl text-red-600 dark:text-red-400" />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* 处理进度 */}
      {stats.total > 0 && (
        <Card className="border-none bg-gradient-to-r from-primary/5 to-secondary/5 shadow-md">
          <CardBody className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-default-600">申请处理进度</p>
              <p className="text-xs text-default-500">
                已处理: {stats.approved + stats.rejected} / {stats.total}
                ({((stats.approved + stats.rejected) / stats.total * 100).toFixed(1)}%)
              </p>
            </div>
            <Progress
              value={(stats.approved + stats.rejected) / stats.total * 100}
              color="primary"
              size="sm"
              className="mb-2"
            />
            <div className="flex gap-4 text-xs">
              <span className="text-green-600 dark:text-green-400 font-bold">
                ✓ 通过率: {stats.total > 0 ? ((stats.approved / stats.total) * 100).toFixed(1) : 0}%
              </span>
              <span className="text-red-600 dark:text-red-400 font-bold">
                ✗ 拒绝率: {stats.total > 0 ? ((stats.rejected / stats.total) * 100).toFixed(1) : 0}%
              </span>
            </div>
          </CardBody>
        </Card>
      )}

      {/* 操作栏 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-content1 p-4 rounded-large shadow-sm border border-divider">
        <div className="flex gap-2">
          {role !== 'commenter' && (
            <>
              <Badge
                content={selectedKeys === "all" ? apps.length : (selectedKeys instanceof Set ? selectedKeys.size : 0)}
                color="primary"
                isInvisible={selectedKeys === "all" ? false : (selectedKeys instanceof Set ? selectedKeys.size === 0 : true)}
              >
                <Button
                  size="sm"
                  color="primary"
                  variant="flat"
                  isDisabled={selectedKeys === "all" ? false : (selectedKeys instanceof Set ? selectedKeys.size === 0 : true)}
                  onPress={() => {
                    setReviewOpinion('');
                    setAdminNote('');
                    batchReviewModal.onOpen();
                  }}
                  className="h-10 px-4 rounded-lg font-bold"
                  startContent={<FaUserShield />}
                >
                  批量审核
                </Button>
              </Badge>
              <Badge
                content={selectedKeys === "all" ? apps.length : (selectedKeys instanceof Set ? selectedKeys.size : 0)}
                color="danger"
                isInvisible={selectedKeys === "all" ? false : (selectedKeys instanceof Set ? selectedKeys.size === 0 : true)}
              >
                <Button
                  size="sm"
                  color="danger"
                  variant="flat"
                  isDisabled={selectedKeys === "all" ? false : (selectedKeys instanceof Set ? selectedKeys.size === 0 : true)}
                  onPress={batchDeleteModal.onOpen}
                  className="h-10 px-4 rounded-lg font-bold"
                  startContent={<FaTrash />}
                >
                  批量删除
                </Button>
              </Badge>
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Input
            isClearable
            aria-label="搜索申请"
            className="w-full sm:max-w-[280px]"
            placeholder="搜索邮箱或理由..."
            startContent={<FaSearch className="text-default-400" />}
            value={searchQuery}
            onValueChange={setSearchQuery}
            variant="bordered"
            size="sm"
            radius="lg"
            classNames={{
              inputWrapper: "border-2 h-10"
            }}
            onClear={() => setSearchQuery('')}
          />
          <Select
            aria-label="筛选状态"
            className="w-full sm:max-w-[160px]"
            placeholder="状态筛选"
            selectedKeys={[statusFilter]}
            onSelectionChange={(keys) => setStatusFilter(Array.from(keys)[0] as string)}
            variant="bordered"
            size="sm"
            radius="lg"
            startContent={<FaFilter className="text-default-400" />}
            classNames={{
              trigger: "border-2 h-10"
            }}
          >
            <SelectItem key="all" textValue="全部状态">全部状态</SelectItem>
            <SelectItem key="pending" textValue="待审核">待审核</SelectItem>
            <SelectItem key="approved" textValue="已批准">已批准</SelectItem>
            <SelectItem key="rejected" textValue="已拒绝">已拒绝</SelectItem>
          </Select>
          <Button
            isIconOnly
            variant="flat"
            color="primary"
            onPress={fetchApps}
            size="sm"
            className="h-10 w-10 min-w-10 rounded-lg transition-transform active:scale-95"
          >
            <FaSync className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      <div className="bg-content1 rounded-large shadow-sm border border-divider overflow-hidden">
        <Table 
          aria-label="申请列表" 
          removeWrapper
          selectionMode="multiple"
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          className="min-w-full"
          classNames={{
            th: "bg-default-100 text-default-500 font-bold h-12 first:pl-6 last:pr-6",
            td: "py-4 first:pl-6 last:pr-6 border-b border-divider last:border-none",
          }}
        >
          <TableHeader>
            <TableColumn key="userNickname">申请人</TableColumn>
            <TableColumn key="reason">理由</TableColumn>
            <TableColumn key="status">状态</TableColumn>
            <TableColumn key="createdAt">申请时间</TableColumn>
            <TableColumn key="actions" align="end">操作</TableColumn>
          </TableHeader>
          <TableBody 
            emptyContent={!loading && "暂无申请记录"}
            items={apps || []}
            loadingContent={<Spinner color="primary" />}
            loadingState={loading ? "loading" : "idle"}
          >
            {(app) => (
              <TableRow key={app.id} className="hover:bg-default-50/50 dark:hover:bg-default-800/30 transition-colors cursor-pointer" onClick={() => handleOpenDetail(app)}>
                {(columnKey) => <TableCell>{renderCell(app, columnKey)}</TableCell>}
              </TableRow>
            )}
          </TableBody>
        </Table>
        {total > pageSize && (
          <div className="flex justify-center py-4 border-t border-divider">
            <Pagination
              isCompact
              showControls
              showShadow
              color="primary"
              page={page}
              total={Math.ceil(total / pageSize)}
              onChange={setPage}
            />
          </div>
        )}
      </div>

      <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        backdrop="blur"
        radius="lg"
        size="2xl"
        scrollBehavior="inside"
        classNames={{
          header: "border-b border-divider/50 px-8 py-6",
          body: "px-8 py-6",
          footer: "border-t border-divider/50 px-8 py-4"
        }}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-black">申请详情</h3>
              {applicationDetail?.readOnly && (
                <Chip
                  color="warning"
                  variant="flat"
                  size="sm"
                  startContent={<FaClock className="text-xs" />}
                >
                  只读模式 - {applicationDetail.lockedBy} 正在审核
                </Chip>
              )}
            </div>
            <p className="text-xs text-default-400 font-bold uppercase tracking-wider">ID: {selectedApp?.id} • {selectedApp?.userNickname || "未知用户"}</p>
          </ModalHeader>
          <ModalBody className="gap-8">{applicationDetail?.readOnly && (
              <div className="p-4 bg-warning/10 border border-warning/30 rounded-xl">
                <div className="flex items-start gap-3">
                  <FaInfoCircle className="text-warning text-lg mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-warning mb-1">只读模式</p>
                    <p className="text-xs text-default-600">
                      该申请正在被 <span className="font-bold text-warning">{applicationDetail.lockedBy}</span> 审核中。
                      作为超级管理员，您可以查看详情，但无法提交审核。
                    </p>
                  </div>
                </div>
              </div>
            )}
            {/* 基本信息网格 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 p-3 rounded-xl bg-default-50 border border-divider/50">
                <div className="flex items-center gap-2 text-default-400">
                  <FaEnvelope className="text-xs" />
                  <p className="text-xs font-bold uppercase">申请人用户名</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-default-700">{selectedApp?.userNickname || "未知用户"}</p>
                  {selectedApp?.email && selectedApp.email !== '********' && (
                    <Button size="sm" variant="light" isIconOnly className="h-6 w-6" onPress={() => {
                      navigator.clipboard.writeText(selectedApp?.email || '');
                      toast.success("邮箱已复制");
                    }}>
                      <FaCopy className="text-default-400 text-[10px]" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-2 p-3 rounded-xl bg-default-50 border border-divider/50">
                <div className="flex items-center gap-2 text-default-400">
                  <FaCalendarAlt className="text-xs" />
                  <p className="text-xs font-bold uppercase">申请时间</p>
                </div>
                <p className="font-semibold text-default-700">
                  {formatDate(selectedApp?.createdAt)}
                </p>
              </div>
              {role === 'super' && (
                <>
                  <div className="space-y-2 p-3 rounded-xl bg-default-50 border border-divider/50">
                    <div className="flex items-center gap-2 text-default-400">
                      <FaGlobe className="text-xs" />
                      <p className="text-xs font-bold uppercase">IP 地址</p>
                    </div>
                    <p className="font-semibold text-default-700">{selectedApp?.ip}</p>
                  </div>
                  <div className="space-y-2 p-3 rounded-xl bg-default-50 dark:bg-default-100 border border-divider/50">
                    <div className="flex items-center gap-2 text-default-400">
                      <FaFingerprint className="text-xs" />
                      <p className="text-xs font-bold uppercase">设备指纹</p>
                    </div>
                    <p className="font-mono text-[10px] text-default-700 dark:text-default-600 break-all bg-default-100 dark:bg-default-200 p-1.5 rounded-lg border border-divider/30">
                      {selectedApp?.deviceId}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* 申请理由 */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-default-400 uppercase">申请理由</p>
              <div className="p-4 bg-primary/5 dark:bg-primary/10 rounded-xl border border-primary/20">
                <p className="text-sm leading-relaxed text-default-700 whitespace-pre-wrap">
                  {selectedApp?.reason}
                </p>
              </div>
            </div>

            {/* AIGC 分析区域 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FaRobot className="text-primary" />
                  <p className="text-xs font-bold text-default-400 uppercase">AIGC 检测分析</p>
                </div>
                {!applicationDetail?.application.aigcAnalysis && (
                  <Button 
                    size="sm" 
                    color="primary" 
                    variant="flat"
                    startContent={<FaBrain className="text-xs" />}
                    onPress={handleAnalyzeAIGC}
                    isLoading={analyzing}
                    className="h-8 font-bold"
                  >
                    开始 AI 分析
                  </Button>
                )}
              </div>

              {applicationDetail?.application.aigcAnalysis ? (
                <Card className="border-none bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 border border-indigo-500/20 shadow-md">
                  <CardBody className="p-0">
                    {/* 头部摘要栏 */}
                    <div className="p-4 border-b border-indigo-500/10 bg-white/30 dark:bg-black/20 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-default-400 uppercase tracking-wider">AI 生成概率</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-3xl font-black ${
                              applicationDetail.application.aigcScore && applicationDetail.application.aigcScore > 55 ? "text-danger" : 
                              applicationDetail.application.aigcScore && applicationDetail.application.aigcScore > 30 ? "text-warning" : "text-success"
                            }`}>
                              {applicationDetail.application.aigcScore}%
                            </span>
                            {applicationDetail.application.aigcScore && applicationDetail.application.aigcScore > 55 && (
                              <Chip size="sm" color="danger" variant="shadow" className="font-bold animate-pulse">
                                建议驳回
                              </Chip>
                            )}
                          </div>
                        </div>
                        <div className="h-10 w-px bg-divider mx-2 hidden md:block" />
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-default-400 uppercase tracking-wider">置信度</span>
                          <Chip size="sm" variant="flat" color="secondary" className="font-bold mt-1">
                            {applicationDetail.application.aigcConfidence}
                          </Chip>
                        </div>
                      </div>
                      
                      <Button 
                        size="sm" 
                        variant="light" 
                        color="primary"
                        isIconOnly
                        onPress={handleAnalyzeAIGC}
                        isLoading={analyzing}
                        className="rounded-full hover:bg-primary/10"
                      >
                        <FaSync size={14} className={analyzing ? "animate-spin" : ""} />
                      </Button>
                    </div>

                    {/* 多维度评分网格 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4">
                      {[
                        { label: '相关性', value: applicationDetail.application.aigcRelevance, color: 'primary' },
                        { label: '真实性', value: applicationDetail.application.aigcAuthenticity, color: 'success' },
                        { label: '完整性', value: applicationDetail.application.aigcCompleteness, color: 'warning' },
                        { label: '表达力', value: applicationDetail.application.aigcExpression, color: 'secondary' },
                      ].map((item) => (
                        <div key={item.label} className="bg-white/40 dark:bg-black/10 p-3 rounded-xl border border-white/50 dark:border-white/5">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-xs font-bold text-default-500">{item.label}</span>
                            <span className="text-xs font-black text-default-700">{item.value}/100</span>
                          </div>
                          <Progress 
                            value={item.value} 
                            color={item.color as any}
                            size="sm"
                            radius="full"
                            className="h-1.5"
                          />
                        </div>
                      ))}
                    </div>

                    {/* 详细内容区 */}
                    <div className="p-4 pt-0 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 px-1">
                            <FaSearchPlus size={12} />
                            <span>检测证据与异常点</span>
                          </div>
                          <div className="p-3 bg-white/50 dark:bg-black/20 rounded-xl text-xs leading-relaxed border border-indigo-500/10 min-h-[80px]">
                            {applicationDetail.application.aigcEvidence}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400 px-1">
                            <FaChartBar size={12} />
                            <span>综合判定结论</span>
                          </div>
                          <div className="p-3 bg-white/50 dark:bg-black/20 rounded-xl text-xs leading-relaxed border border-purple-500/10 min-h-[80px]">
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {applicationDetail.application.aigcAnalysis || ""}
                              </ReactMarkdown>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 参考回复 */}
                      {applicationDetail.application.aigcReply && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-pink-600 dark:text-pink-400">
                              <FaRobot size={12} />
                              <span>建议参考回复</span>
                            </div>
                            <Button 
                              size="sm" 
                              variant="light" 
                              color="danger" 
                              className="h-6 text-[10px] min-w-0 px-2 font-bold"
                              onPress={() => {
                                setReviewOpinion(applicationDetail.application.aigcReply || "");
                                toast.success("已填入审核意见");
                              }}
                            >
                              使用此回复
                            </Button>
                          </div>
                          <div className="p-3 bg-pink-500/5 dark:bg-pink-500/10 rounded-xl text-xs leading-relaxed border border-pink-500/10 italic text-default-600">
                            {applicationDetail.application.aigcReply}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardBody>
                </Card>
              ) : (
                <div className="p-6 border-2 border-dashed border-divider rounded-xl flex flex-col items-center justify-center gap-2 text-default-400 bg-default-50/50">
                  <FaRobot size={24} className="opacity-20" />
                  <p className="text-[10px] font-medium">尚未进行 AIGC 生成概率分析</p>
                </div>
              )}
            </div>

            {/* 投票区域 - 所有人可见 */}
            {selectedApp?.status === 'pending' && (
              <div className="mt-6 p-4 bg-default-50 rounded-xl border border-divider">
                <div className="flex items-center gap-2 font-bold mb-4">
                  <FaCommentDots className="text-primary" />
                  <span>提交审核意见 (投票)</span>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex gap-4">
                    <Button
                      className={`flex-grow font-bold ${myVote.opinion === 'agree' ? 'bg-success text-white' : 'bg-default-200'}`}
                      onPress={() => setMyVote({...myVote, opinion: 'agree'})}
                      startContent={<FaThumbsUp />}
                    >
                      赞成
                    </Button>
                    <Button
                      className={`flex-grow font-bold ${myVote.opinion === 'reject' ? 'bg-danger text-white' : 'bg-default-200'}`}
                      onPress={() => setMyVote({...myVote, opinion: 'reject'})}
                      startContent={<FaThumbsDown />}
                    >
                      反对
                    </Button>
                  </div>
                  <Textarea
                    placeholder="请输入投票备注 (可选)"
                    value={myVote.comment}
                    onValueChange={(val) => setMyVote({...myVote, comment: val})}
                    size="sm"
                  />
                  <Button 
                    color="primary" 
                    onPress={handleVote} 
                    isLoading={voting}
                    isDisabled={votes.some(v => v.voterId === adminUser.id)}
                  >
                    {votes.some(v => v.voterId === adminUser.id) ? "您已投票" : "提交投票"}
                  </Button>
                </div>
              </div>
            )}
            {votes.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center gap-2 font-bold mb-3">
                  <FaHistory className="text-primary" />
                  <span>审核员投票 ({votes.length})</span>
                </div>
                <div className="space-y-3">
                  {votes.map((vote) => (
                    <div key={vote.id} className="flex items-start gap-3 p-3 rounded-lg bg-default-50 border border-divider">
                      <Avatar size="sm" name={vote.voterUsername} />
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-semibold text-sm">{vote.voterUsername}</span>
                          <Chip
                            size="sm"
                            color={vote.opinion === 'agree' ? 'success' : 'danger'}
                            variant="flat"
                            startContent={vote.opinion === 'agree' ? <FaThumbsUp size={10} /> : <FaThumbsDown size={10} />}
                          >
                            {vote.opinion === 'agree' ? '赞成' : '反对'}
                          </Chip>
                        </div>
                        {vote.comment && (
                          <p className="text-xs text-default-600 italic">"{vote.comment}"</p>
                        ) || <p className="text-xs text-default-400 italic">无备注</p>}
                        <div className="text-[10px] text-default-400 mt-1">
                          {new Date(vote.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 历史申请记录 */}
            {applicationDetail && applicationDetail.history && applicationDetail.history.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-divider">
                <div className="flex items-center gap-2">
                  <FaHistory className="text-warning" />
                  <p className="text-sm font-bold text-default-600">历史申请记录</p>
                  <Chip size="sm" variant="flat" color="warning">
                    {applicationDetail.history.length} 条
                  </Chip>
                </div>
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {applicationDetail.history.map((histApp) => (
                    <Card key={histApp.id} className="border border-divider">
                      <CardBody className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Chip
                              size="sm"
                              color={
                                histApp.status === 'approved' ? 'success' :
                                histApp.status === 'rejected' ? 'danger' :
                                'warning'
                              }
                              variant="flat"
                            >
                              {histApp.status === 'approved' ? '✓ 已通过' :
                               histApp.status === 'rejected' ? '✗ 已拒绝' :
                               '⏳ 待审核'}
                            </Chip>
                            <span className="text-xs text-default-400">申请 ID: #{histApp.id}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-default-400">
                            <FaClock />
                            <span>{formatDate(histApp.createdAt)}</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="p-3 bg-default-50 rounded-lg">
                            <p className="text-xs font-bold text-default-500 mb-1">申请理由：</p>
                            <p className="text-sm text-default-700 whitespace-pre-wrap">{histApp.reason}</p>
                          </div>

                          {histApp.reviewOpinion && (
                            <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                              <p className="text-xs font-bold text-primary mb-1">审核意见：</p>
                              <p className="text-sm text-default-700 whitespace-pre-wrap">{histApp.reviewOpinion}</p>
                            </div>
                          )}

                          {histApp.adminNote && (
                            <div className="p-3 bg-warning/5 rounded-lg border border-warning/20">
                              <p className="text-xs font-bold text-warning mb-1">内部备注：</p>
                              <p className="text-sm text-default-700 whitespace-pre-wrap">{histApp.adminNote}</p>
                            </div>
                          )}

                          <div className="flex gap-3 text-xs text-default-400 pt-1">
                            {role === 'super' && <span>🌐 IP: {histApp.ip}</span>}
                            {histApp.adminUsername && <span>👤 审核员: {histApp.adminUsername}</span>}
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* 审核区域 */}
            {role !== 'commenter' && (
              <div className="space-y-4 pt-4 border-t border-divider">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-default-600">处理申请</p>
                  <div className="flex items-center gap-2">
                    {selectedApp?.adminUsername && (
                      <Chip size="sm" variant="flat" color="secondary" className="font-bold">
                        审核员: {selectedApp.adminUsername}
                      </Chip>
                    )}
                    {selectedApp?.status !== 'pending' && (
                      <Chip 
                        color={selectedApp?.status === 'approved' ? 'success' : 'danger'} 
                        variant="flat"
                        className="font-bold"
                      >
                        {selectedApp?.status === 'approved' ? '已批准' : '已拒绝'}
                      </Chip>
                    )}
                  </div>
                </div>

                {selectedApp?.status === 'pending' ? (
                  <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex gap-4">
                      <Button
                        className={`flex-grow h-14 font-bold ${reviewStatus === 'approved' ? 'bg-primary text-white shadow-lg' : 'bg-default-100'}`}
                        onPress={() => setReviewStatus('approved')}
                        startContent={<FaCheck />}
                        radius="lg"
                      >
                        批准申请
                      </Button>
                      <Button
                        className={`flex-grow h-14 font-bold ${reviewStatus === 'rejected' ? 'bg-danger text-white shadow-lg' : 'bg-default-100'}`}
                        onPress={() => setReviewStatus('rejected')}
                        startContent={<FaTimes />}
                        radius="lg"
                      >
                        拒绝申请
                      </Button>
                    </div>

                    {reviewStatus === 'approved' && (
                      <Input
                        label="邀请码"
                        placeholder="输入要发放的邀请码"
                        value={inviteCode}
                        onValueChange={setInviteCode}
                        variant="bordered"
                        radius="lg"
                        size="lg"
                        className="animate-in zoom-in-95 duration-200"
                        classNames={{
                          label: "font-bold text-primary",
                          inputWrapper: "border-2 focus-within:border-primary h-14"
                        }}
                      />
                    )}

                    <Textarea
                      label="审核意见"
                      placeholder="将发送给申请人的说明（如：已通过、申请理由不足等）"
                      description="💡 此内容将通过邮件发送给申请人，请礼貌用语。"
                      value={reviewOpinion}
                      onValueChange={setReviewOpinion}
                      variant="bordered"
                      radius="lg"
                      minRows={3}
                      classNames={{
                        label: "font-bold text-primary",
                        inputWrapper: "border-2",
                        description: "text-primary/70 font-medium mt-1"
                      }}
                    />

                    <Textarea
                      label="审核备注"
                      placeholder="仅审核员和管理可见的内部备注"
                      description="🔒 此内容仅管理员可见，不会发送给申请人。"
                      value={adminNote}
                      onValueChange={setAdminNote}
                      variant="bordered"
                      radius="lg"
                      minRows={2}
                      classNames={{
                        label: "font-bold",
                        inputWrapper: "border-2",
                        description: "text-default-400 mt-1"
                      }}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                      <p className="text-xs font-bold text-primary uppercase mb-2">审核意见 (已发送)</p>
                      <p className="text-sm text-default-600 italic">
                        {selectedApp?.reviewOpinion || '无意见信息'}
                      </p>
                    </div>
                    <div className="p-4 bg-default-50 dark:bg-default-800/50 rounded-xl border border-divider">
                      <p className="text-xs font-bold text-default-400 uppercase mb-2">审核备注 (内部)</p>
                      <p className="text-sm text-default-600 italic">
                        {selectedApp?.adminNote || '无备注信息'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              variant="light"
              color="primary"
              onPress={handleCloseDetail}
              radius="lg"
              className="font-bold h-12 px-6"
            >
              关闭
            </Button>
            {role !== 'commenter' && selectedApp?.status === 'pending' && !applicationDetail?.readOnly && (
              <Button
                color={reviewStatus === 'approved' ? 'primary' : 'danger'}
                onPress={submitReview}
                isLoading={submitting}
                radius="lg"
                className="font-bold h-12 px-8 shadow-lg"
              >
                确认提交审核
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 批量审核 Modal */}
      <Modal isOpen={batchReviewModal.isOpen} onOpenChange={batchReviewModal.onOpenChange}>
        <ModalContent>
          <ModalHeader>批量审核 ({selectedKeys === 'all' ? total : selectedKeys.size} 条)</ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <Textarea
                label="审核回复 (用户可见)"
                placeholder="请输入发送给用户的审核意见"
                value={reviewOpinion}
                onValueChange={setReviewOpinion}
              />
              <Textarea
                label="内部备注 (仅管理员可见)"
                placeholder="请输入内部备注"
                value={adminNote}
                onValueChange={setAdminNote}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={batchReviewModal.onClose}>取消</Button>
            <Button color="danger" onPress={() => handleBatchReview('rejected')} isLoading={submitting}>批量拒绝</Button>
            <Button color="success" onPress={() => handleBatchReview('approved')} isLoading={submitting}>批量通过</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 批量删除 Modal */}
      <Modal isOpen={batchDeleteModal.isOpen} onOpenChange={batchDeleteModal.onOpenChange}>
        <ModalContent>
          <ModalHeader>确认批量删除</ModalHeader>
          <ModalBody>
            <p>确定要删除选中的 {selectedKeys === 'all' ? total : selectedKeys.size} 条申请吗？此操作不可撤销。</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={batchDeleteModal.onClose}>取消</Button>
            <Button color="danger" onPress={handleBatchDelete} isLoading={submitting}>确认删除</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 删除确认弹窗 */}
      <Modal 
        isOpen={deleteModal.isOpen} 
        onClose={deleteModal.onClose}
        placement="center"
        backdrop="blur"
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">确认删除</ModalHeader>
          <ModalBody>
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center">
                <FaTrash size={28} className="text-danger" />
              </div>
              <div className="space-y-2">
                <p className="font-bold text-lg">您确定要删除此申请吗？</p>
                <p className="text-default-500 text-sm">
                  删除后将无法恢复，关联的邀请码记录（如果有）也将被一并删除。
                  <br />
                  <span className="font-bold text-danger">申请邮箱: {appToDelete?.email}</span>
                </p>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={deleteModal.onClose}>
              取消
            </Button>
            <Button 
              color="danger" 
              onPress={handleDelete}
              isLoading={submitting}
              className="font-bold"
            >
              确认删除
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
