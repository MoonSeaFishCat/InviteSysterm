import { useState, useEffect } from 'react';
import { 
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, 
  Chip, Spinner, Card, CardHeader
} from "@heroui/react";
import { FaHistory, FaSync } from 'react-icons/fa';
import api from '../../api/client';
import toast from 'react-hot-toast';

interface AuditLog {
  id: number;
  admin_id: number;
  admin_username: string;
  action: 'approved' | 'rejected';
  application_id: number;
  target_email: string;
  details: string;
  created_at: string;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/audit-logs');
      setLogs(Array.isArray(res.data) ? res.data : []);
    } catch (error: any) {
      toast.error("无法加载审计日志");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const renderAction = (action: string) => {
    switch (action) {
      case 'approved':
        return <Chip color="success" variant="flat" size="sm">批准</Chip>;
      case 'rejected':
        return <Chip color="danger" variant="flat" size="sm">拒绝</Chip>;
      default:
        return <Chip color="default" variant="flat" size="sm">{action}</Chip>;
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-sm border border-divider">
        <CardHeader className="flex justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <FaHistory className="text-primary" size={20} />
            <h1 className="text-xl font-bold">审核日志</h1>
          </div>
          <button 
            onClick={fetchLogs}
            className="p-2 hover:bg-default-100 rounded-full transition-colors"
            title="刷新"
          >
            <FaSync className={loading ? "animate-spin" : ""} />
          </button>
        </CardHeader>
      </Card>

      <Table 
        aria-label="审计日志表格"
        classNames={{
          wrapper: "shadow-sm border border-divider",
        }}
      >
        <TableHeader>
          <TableColumn>时间</TableColumn>
          <TableColumn>审核员</TableColumn>
          <TableColumn>操作</TableColumn>
          <TableColumn>目标邮箱</TableColumn>
          <TableColumn>备注</TableColumn>
        </TableHeader>
        <TableBody 
          emptyContent={loading ? <Spinner /> : "暂无审计日志"}
          loadingContent={<Spinner />}
          loadingState={loading ? "loading" : "idle"}
        >
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{log.admin_username}</span>
                  <span className="text-tiny text-default-400">ID: {log.admin_id}</span>
                </div>
              </TableCell>
              <TableCell>{renderAction(log.action)}</TableCell>
              <TableCell>{log.target_email}</TableCell>
              <TableCell className="max-w-xs truncate">{log.details || "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
