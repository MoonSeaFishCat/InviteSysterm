import { useState, useEffect } from 'react';
import { 
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, 
  Chip, Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, 
  useDisclosure, Textarea, Input, Spinner, Select, SelectItem, Pagination,
  Tooltip
} from "@heroui/react";
import { FaCheck, FaTimes, FaInfoCircle, FaSync, FaSearch, FaCopy, FaEnvelope, FaCalendarAlt, FaGlobe, FaFingerprint, FaTrash } from 'react-icons/fa';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { storage } from '../../utils/storage';

interface Application {
  id: number;
  email: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  deviceId: string;
  ip: string;
  createdAt: string;
  adminNote?: string;
  reviewOpinion?: string;
  adminUsername?: string;
}

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
  
  const {isOpen, onOpen, onClose} = useDisclosure();
  const deleteModal = useDisclosure();
  const batchReviewModal = useDisclosure();
  const batchDeleteModal = useDisclosure();
  const [appToDelete, setAppToDelete] = useState<Application | null>(null);

  // Get user role
  const user = storage.get('admin_user') || {};
  const role = user.role || 'reviewer';

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

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchApps();
    }, 300);
    return () => clearTimeout(timer);
  }, [statusFilter, searchQuery, page, pageSize]);

  const handleOpenDetail = (app: Application) => {
    setSelectedApp(app);
    setReviewStatus('approved');
    setInviteCode('');
    setAdminNote(app.adminNote || '');
    setReviewOpinion(app.reviewOpinion || '');
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
          note: adminNote,
          opinion: reviewOpinion
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

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-content1 p-6 rounded-large shadow-sm border border-divider">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight">申请管理</h1>
          <p className="text-sm text-default-500">查看并审核新成员的加入申请</p>
        </div>
        
        <div className="flex flex-wrap gap-3 w-full md:w-auto items-center">
          <div className="flex gap-2 mr-2">
            <Button 
              size="sm" 
              color="primary" 
              variant="flat"
              isDisabled={selectedKeys === "all" || selectedKeys.size === 0}
              onPress={() => {
                setReviewOpinion('');
                setAdminNote('');
                batchReviewModal.onOpen();
              }}
              className="h-12 px-4 rounded-large font-bold"
            >
              批量审核
            </Button>
            <Button 
              size="sm" 
              color="danger" 
              variant="flat"
              isDisabled={selectedKeys === "all" || selectedKeys.size === 0}
              onPress={batchDeleteModal.onOpen}
              className="h-12 px-4 rounded-large font-bold"
            >
              批量删除
            </Button>
          </div>
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
