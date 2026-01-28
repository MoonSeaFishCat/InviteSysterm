import { useState, useEffect } from 'react';
import { 
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, 
  Chip, Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, 
  useDisclosure, Textarea, Input, Spinner, Select, SelectItem
} from "@heroui/react";
import { FaCheck, FaTimes, FaInfoCircle, FaSync, FaSearch, FaCopy, FaMagic, FaEnvelope, FaCalendarAlt, FaGlobe, FaFingerprint } from 'react-icons/fa';
import api from '../../api/client';
import toast from 'react-hot-toast';

interface Application {
  id: number;
  email: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  deviceId: string;
  ip: string;
  createdAt: string;
  adminNote?: string;
}

export default function Applications() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'approved' | 'rejected'>('approved');
  const [inviteCode, setInviteCode] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const {isOpen, onOpen, onClose} = useDisclosure();

  const fetchApps = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (searchQuery) params.search = searchQuery;
      
      const res = await api.get('/admin/applications', { params });
      setApps(Array.isArray(res.data) ? res.data : []);
    } catch (error: any) {
      toast.error("无法加载申请列表");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchApps();
    }, 300);
    return () => clearTimeout(timer);
  }, [statusFilter, searchQuery]);

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除容易混淆的字符
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setInviteCode(result);
    toast.success("已生成随机邀请码");
  };

  const handleOpenDetail = (app: Application) => {
    setSelectedApp(app);
    setReviewStatus('approved');
    setInviteCode('');
    setAdminNote(app.adminNote || '');
    onOpen();
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
          note: adminNote
        }
      });
      toast.success("审核提交成功");
      onClose();
      fetchApps();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "审核失败");
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
      case "email":
        return (
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <p className="text-bold text-sm capitalize">{app.email}</p>
              <Button 
                size="sm" 
                variant="light" 
                color="primary"
                isIconOnly 
                className="h-6 w-6 min-w-6"
                onPress={() => {
                  navigator.clipboard.writeText(app.email);
                  toast.success("邮箱已复制");
                }}
              >
                <FaCopy className="text-[12px]" />
              </Button>
            </div>
            <p className="text-bold text-tiny text-default-400">{app.ip}</p>
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
          <div className="relative flex items-center justify-end">
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
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-content1 p-6 rounded-large shadow-sm border border-divider">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight">申请管理</h1>
          <p className="text-sm text-default-500">查看并审核新成员的加入申请</p>
        </div>
        
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <Input
            isClearable
            aria-label="搜索申请"
            className="w-full sm:max-w-[280px]"
            placeholder="搜索邮箱或理由..."
            startContent={<FaSearch className="text-default-300" />}
            value={searchQuery}
            onValueChange={setSearchQuery}
            variant="flat"
            size="md"
            radius="lg"
            classNames={{
              inputWrapper: "bg-default-100/50 dark:bg-default-800/50 border-none h-12"
            }}
            onClear={() => setSearchQuery('')}
          />
          <Select
            aria-label="筛选状态"
            className="w-full sm:max-w-[160px]"
            placeholder="状态筛选"
            selectedKeys={[statusFilter]}
            onSelectionChange={(keys) => setStatusFilter(Array.from(keys)[0] as string)}
            variant="flat"
            size="md"
            radius="lg"
            classNames={{
              trigger: "bg-default-100/50 dark:bg-default-800/50 border-none h-12"
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
            className="h-12 w-12 min-w-12 rounded-large transition-transform active:scale-95"
          >
            <FaSync className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      <div className="bg-content1 rounded-large shadow-sm border border-divider overflow-hidden">
        <Table 
          aria-label="申请列表" 
          removeWrapper
          className="min-w-full"
          classNames={{
            th: "bg-default-100 text-default-500 font-bold h-12 first:pl-6 last:pr-6",
            td: "py-4 first:pl-6 last:pr-6 border-b border-divider last:border-none",
          }}
        >
          <TableHeader>
            <TableColumn key="email">申请人</TableColumn>
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
            <h3 className="text-xl font-black">申请详情</h3>
            <p className="text-xs text-default-400 font-bold uppercase tracking-wider">ID: {selectedApp?.id} • {selectedApp?.email}</p>
          </ModalHeader>
          <ModalBody className="gap-8">
            {/* 基本信息网格 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 p-3 rounded-xl bg-default-50 border border-divider/50">
                <div className="flex items-center gap-2 text-default-400">
                  <FaEnvelope className="text-xs" />
                  <p className="text-xs font-bold uppercase">申请人邮箱</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-default-700">{selectedApp?.email}</p>
                  <Button size="sm" variant="light" isIconOnly className="h-6 w-6" onPress={() => {
                    navigator.clipboard.writeText(selectedApp?.email || '');
                    toast.success("邮箱已复制");
                  }}>
                    <FaCopy className="text-default-400 text-[10px]" />
                  </Button>
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
              <div className="space-y-2 p-3 rounded-xl bg-default-50 border border-divider/50">
                <div className="flex items-center gap-2 text-default-400">
                  <FaGlobe className="text-xs" />
                  <p className="text-xs font-bold uppercase">IP 地址</p>
                </div>
                <p className="font-semibold text-default-700">{selectedApp?.ip}</p>
              </div>
              <div className="space-y-2 p-3 rounded-xl bg-default-50 border border-divider/50">
                <div className="flex items-center gap-2 text-default-400">
                  <FaFingerprint className="text-xs" />
                  <p className="text-xs font-bold uppercase">设备指纹</p>
                </div>
                <p className="font-mono text-[10px] text-default-500 break-all bg-default-100 p-1.5 rounded-lg border border-divider/30">
                  {selectedApp?.deviceId}
                </p>
              </div>
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

            {/* 审核区域 */}
            <div className="space-y-4 pt-4 border-t border-divider">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-default-600">处理申请</p>
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
                      endContent={
                        <Button
                          size="sm"
                          variant="flat"
                          color="primary"
                          onPress={generateCode}
                          startContent={<FaMagic />}
                          className="font-bold"
                        >
                          随机生成
                        </Button>
                      }
                    />
                  )}

                  <Textarea
                    label="审核备注"
                    placeholder="对该申请的内部备注或给用户的说明"
                    value={adminNote}
                    onValueChange={setAdminNote}
                    variant="bordered"
                    radius="lg"
                    minRows={3}
                    classNames={{
                      label: "font-bold",
                      inputWrapper: "border-2"
                    }}
                  />
                </div>
              ) : (
                <div className="p-4 bg-default-50 dark:bg-default-800/50 rounded-xl border border-divider">
                  <p className="text-xs font-bold text-default-400 uppercase mb-2">管理员备注</p>
                  <p className="text-sm text-default-600 italic">
                    {selectedApp?.adminNote || '无备注信息'}
                  </p>
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button 
              variant="light" 
              color="primary"
              onPress={onClose}
              radius="lg"
              className="font-bold h-12 px-6"
            >
              关闭
            </Button>
            {selectedApp?.status === 'pending' && (
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
    </div>
  );
}
