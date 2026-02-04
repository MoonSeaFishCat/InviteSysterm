import { useState, useEffect } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Chip,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Textarea,
  Select,
  SelectItem,
  Progress,
} from "@heroui/react";
import api from '../../api/client';
import toast from 'react-hot-toast';
import { FaPlus, FaClock, FaCheckCircle, FaTimesCircle, FaEye, FaHistory, FaEnvelope } from 'react-icons/fa';

export default function Applications() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [reason, setReason] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [selectedApp, setSelectedApp] = useState<any>(null);

  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isDetailOpen, onOpen: onDetailOpen, onClose: onDetailClose } = useDisclosure();

  // 检查是否可以提交新申请
  const canSubmitNew = () => {
    // 检查是否有审核通过的申请
    const hasApproved = applications.some(app => app.status === 'approved');
    if (hasApproved) {
      return { canSubmit: false, reason: '贪婪的人类！您已经获得过邀请码了，不能重复申请哦 😊' };
    }

    // 检查是否有待审核的申请
    const hasPending = applications.some(app => app.status === 'pending');
    if (hasPending) {
      return { canSubmit: false, reason: '您有正在审核中的申请，请耐心等待审核结果 ⏳' };
    }

    return { canSubmit: true, reason: '' };
  };

  const submitCheck = canSubmitNew();

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const res = await api.get('/user/applications');
      setApplications(res.data.data || []);
    } catch (error: any) {
      toast.error('获取申请列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    // 再次检查是否可以提交
    const check = canSubmitNew();
    if (!check.canSubmit) {
      toast.error(check.reason);
      onClose();
      return;
    }

    if (!reason.trim()) {
      toast.error('请填写申请理由');
      return;
    }

    if (reason.length < 50) {
      toast.error('申请理由不能少于 50 个字，请认真填写');
      return;
    }

    setSubmitLoading(true);
    try {
      const { StarMoonSecurity } = await import('../../utils/security');
      const { getDeviceId } = await import('../../utils/device');

      const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
      const nonce = Math.floor(Math.random() * 1000000);
      const fingerprint = getDeviceId();
      const payload = { email: userInfo.email, reason };

      const encrypted = await StarMoonSecurity.encryptData(payload, fingerprint, nonce);
      const res = await api.post('/user/application/submit', {
        encrypted,
        fingerprint,
        nonce
      });

      if (res.data.success) {
        toast.success('申请提交成功');
        setReason('');
        onClose();
        fetchApplications();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || '提交失败');
    } finally {
      setSubmitLoading(false);
    }
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'pending':
        return <Chip startContent={<FaClock />} color="warning" variant="flat">审核中</Chip>;
      case 'approved':
        return <Chip startContent={<FaCheckCircle />} color="success" variant="flat">已通过</Chip>;
      case 'rejected':
        return <Chip startContent={<FaTimesCircle />} color="danger" variant="flat">已拒绝</Chip>;
      default:
        return <Chip variant="flat">{status}</Chip>;
    }
  };

  const getStatusProgress = (status: string) => {
    switch (status) {
      case 'pending':
        return { value: 50, color: 'warning' as const, label: '等待审核中' };
      case 'approved':
        return { value: 100, color: 'success' as const, label: '审核通过' };
      case 'rejected':
        return { value: 100, color: 'danger' as const, label: '审核未通过' };
      default:
        return { value: 0, color: 'default' as const, label: '未知状态' };
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('zh-CN');
  };

  const filteredApps = applications.filter(app => {
    if (statusFilter === 'all') return true;
    return app.status === statusFilter;
  });

  const handleViewDetail = (app: any) => {
    setSelectedApp(app);
    onDetailOpen();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">申请管理</h2>
          <p className="text-default-500 text-sm mt-1">查看和管理您的邀请码申请</p>
        </div>
        {submitCheck.canSubmit ? (
          <Button
            color="primary"
            startContent={<FaPlus />}
            onPress={onOpen}
          >
            提交申请
          </Button>
        ) : (
          <Button
            color="default"
            variant="flat"
            isDisabled
            startContent={<FaTimesCircle />}
          >
            无法提交
          </Button>
        )}
      </div>

      {/* 提示信息 */}
      {!submitCheck.canSubmit && (
        <Card className="bg-warning/10 border-2 border-warning/30">
          <CardBody className="py-3">
            <p className="text-sm text-warning-700 dark:text-warning-500 flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              <span>{submitCheck.reason}</span>
            </p>
          </CardBody>
        </Card>
      )}

      <div className="flex gap-4">
        <Select
          placeholder="状态筛选"
          className="max-w-xs"
          selectedKeys={statusFilter ? [statusFilter] : []}
          onSelectionChange={(keys) => {
            const selected = Array.from(keys)[0] as string;
            setStatusFilter(selected || 'all');
          }}
        >
          <SelectItem key="all">全部</SelectItem>
          <SelectItem key="pending">审核中</SelectItem>
          <SelectItem key="approved">已通过</SelectItem>
          <SelectItem key="rejected">已拒绝</SelectItem>
        </Select>
      </div>

      <Table aria-label="申请列表">
        <TableHeader>
          <TableColumn>申请时间</TableColumn>
          <TableColumn>状态</TableColumn>
          <TableColumn>进度</TableColumn>
          <TableColumn>操作</TableColumn>
        </TableHeader>
        <TableBody
          items={filteredApps}
          isLoading={loading}
          emptyContent="暂无申请记录"
        >
          {(app) => {
            const progress = getStatusProgress(app.status);
            return (
              <TableRow key={app.id}>
                <TableCell>{formatDate(app.created_at)}</TableCell>
                <TableCell>{getStatusChip(app.status)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress
                      value={progress.value}
                      color={progress.color}
                      size="sm"
                      className="max-w-md"
                    />
                    <span className="text-xs text-default-500 whitespace-nowrap">
                      {progress.label}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="flat"
                    startContent={<FaEye />}
                    onPress={() => handleViewDetail(app)}
                  >
                    查看详情
                  </Button>
                </TableCell>
              </TableRow>
            );
          }}
        </TableBody>
      </Table>

      {/* 提交申请模态框 */}
      <Modal isOpen={isOpen} onClose={onClose} size="2xl">
        <ModalContent>
          <ModalHeader>提交邀请码申请</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="p-4 bg-primary/10 rounded-lg">
                <p className="text-sm text-default-700">
                  ✨ 申请理由至少需要 <span className="font-bold text-primary">50个字</span>
                </p>
                <p className="text-sm text-default-500 mt-2">
                  请认真描述您申请邀请码的原因，这将有助于审核人员更好地了解您的需求。
                </p>
              </div>
              
              <Textarea
                label="申请理由"
                placeholder="请详细说明您申请邀请码的理由..."
                value={reason}
                onValueChange={setReason}
                minRows={8}
                description={`已输入 ${reason.length} 个字符`}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onClose}>
              取消
            </Button>
            <Button
              color="primary"
              isLoading={submitLoading}
              onPress={handleSubmit}
            >
              提交申请
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 申请详情模态框 */}
      <Modal isOpen={isDetailOpen} onClose={onDetailClose} size="2xl">
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <FaHistory />
            申请详情
          </ModalHeader>
          <ModalBody>
            {selectedApp && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <h3 className="font-bold">基本信息</h3>
                  </CardHeader>
                  <CardBody className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-default-500">申请时间：</span>
                      <span>{formatDate(selectedApp.created_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-default-500">当前状态：</span>
                      {getStatusChip(selectedApp.status)}
                    </div>
                    {selectedApp.updated_at && (
                      <div className="flex justify-between">
                        <span className="text-default-500">更新时间：</span>
                        <span>{formatDate(selectedApp.updated_at)}</span>
                      </div>
                    )}
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader>
                    <h3 className="font-bold">申请理由</h3>
                  </CardHeader>
                  <CardBody>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {selectedApp.reason}
                    </p>
                  </CardBody>
                </Card>

                {selectedApp.review_opinion && (
                  <Card>
                    <CardHeader>
                      <h3 className="font-bold">审核意见</h3>
                    </CardHeader>
                    <CardBody>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {selectedApp.review_opinion}
                      </p>
                    </CardBody>
                  </Card>
                )}

                {selectedApp.status === 'approved' && (
                  <Card className="bg-success/10 border-2 border-success/20">
                    <CardHeader className="border-b border-success/20">
                      <div className="flex items-center gap-2">
                        <FaCheckCircle className="text-success" />
                        <h3 className="font-bold text-success">🎉 申请已批准</h3>
                      </div>
                    </CardHeader>
                    <CardBody className="space-y-4">
                      <div className="bg-white dark:bg-default-100 rounded-lg p-4 border border-success/30 text-center">
                        <div className="flex flex-col items-center gap-3 py-4">
                          <div className="w-12 h-12 bg-success/20 rounded-full flex items-center justify-center">
                            <FaEnvelope className="text-success text-xl" />
                          </div>
                          <div className="space-y-1">
                            <p className="font-bold text-default-800">邀请码已发送</p>
                            <p className="text-sm text-default-500">
                              您的邀请码已发送至邮箱 <span className="font-mono text-primary">{selectedApp.email}</span>
                            </p>
                          </div>
                          <p className="text-xs text-default-400 mt-2">
                            请注意查收垃圾邮件，如长时间未收到请联系管理员
                          </p>
                        </div>
                      </div>
                      <div className="bg-warning/10 rounded-lg p-3 border border-warning/30">
                        <p className="text-xs text-warning-600 dark:text-warning-500 flex items-start gap-2">
                          <span className="flex-shrink-0">🔒</span>
                          <span>
                            <strong>安全提示：</strong>平台不存储您的邀请码。为了您的安全，请务必妥善保管邮件中的邀请链接，不要泄露给他人。
                          </span>
                        </p>
                      </div>
                    </CardBody>
                  </Card>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onPress={onDetailClose}>
              关闭
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
