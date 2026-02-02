import { useState, useEffect } from 'react';
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Avatar
} from "@heroui/react";
import { FaUserCheck, FaUserTimes, FaClock, FaClipboardList, FaCheck, FaTimes } from 'react-icons/fa';
import api from '../../api/client';
import toast from 'react-hot-toast';
import type { AuditorApplication } from '../../types';

export default function AuditorApplications() {
  const [applications, setApplications] = useState<AuditorApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedApp, setSelectedApp] = useState<AuditorApplication | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const fetchApplications = async () => {
    setLoading(true);
    try {
      // 默认只获取待处理的申请
      const res = await api.get('/admin/auditor/applications?status=pending');
      if (res.data.success) {
        setApplications(res.data.data || []);
      }
    } catch (error) {
      toast.error("加载申请列表失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const handleProcess = async (status: 'approved' | 'rejected') => {
    if (!selectedApp) return;
    setProcessing(true);
    try {
      const res = await api.post('/admin/auditor/process', {
        id: selectedApp.id,
        status: status
      });
      if (res.data.success) {
        toast.success(status === 'approved' ? "已批准申请" : "已拒绝申请");
        fetchApplications();
        onClose();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "处理失败");
    } finally {
      setProcessing(false);
    }
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'pending': return <Chip color="warning" variant="flat" startContent={<FaClock size={12} />}>待处理</Chip>;
      case 'approved': return <Chip color="success" variant="flat" startContent={<FaCheck size={12} />}>已批准</Chip>;
      case 'rejected': return <Chip color="danger" variant="flat" startContent={<FaTimes size={12} />}>已拒绝</Chip>;
      default: return <Chip variant="flat">{status}</Chip>;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <FaClipboardList className="text-primary" />
          审核员申请管理
        </h2>
        <Button 
          size="sm" 
          variant="flat" 
          color="primary" 
          onPress={fetchApplications}
          isLoading={loading}
        >
          刷新
        </Button>
      </div>

      <Table aria-label="审核员申请列表" className="shadow-lg rounded-2xl overflow-hidden">
        <TableHeader>
          <TableColumn>申请人</TableColumn>
          <TableColumn>申请理由</TableColumn>
          <TableColumn>申请时间</TableColumn>
          <TableColumn>状态</TableColumn>
          <TableColumn align="center">操作</TableColumn>
        </TableHeader>
        <TableBody emptyContent={loading ? "加载中..." : "暂无待处理申请"}>
          {applications.map((app) => (
            <TableRow key={app.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Avatar size="sm" name={app.username} />
                  <span className="font-medium">{app.username}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="max-w-xs truncate" title={app.reason}>
                  {app.reason}
                </div>
              </TableCell>
              <TableCell className="text-xs text-default-500">
                {new Date(app.createdAt).toLocaleString()}
              </TableCell>
              <TableCell>
                {getStatusChip(app.status)}
              </TableCell>
              <TableCell>
                <div className="flex justify-center gap-2">
                  {app.status === 'pending' ? (
                    <Button 
                      size="sm" 
                      color="primary" 
                      variant="flat"
                      onPress={() => {
                        setSelectedApp(app);
                        onOpen();
                      }}
                    >
                      处理
                    </Button>
                  ) : (
                    <span className="text-xs text-default-400">已处理</span>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            处理审核员申请 - {selectedApp?.username}
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-bold text-default-600 block mb-1">申请理由</label>
                <div className="p-4 bg-default-100 rounded-xl text-sm italic">
                  "{selectedApp?.reason}"
                </div>
              </div>
              <p className="text-xs text-default-400">
                批准后，该用户的角色将更新为“审核员”，并获得相应的审核权限。
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onClose} isDisabled={processing}>
              取消
            </Button>
            <Button 
              color="danger" 
              variant="flat" 
              onPress={() => handleProcess('rejected')}
              isLoading={processing}
              startContent={<FaUserTimes />}
            >
              拒绝
            </Button>
            <Button 
              color="primary" 
              onPress={() => handleProcess('approved')}
              isLoading={processing}
              startContent={<FaUserCheck />}
            >
              批准
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
