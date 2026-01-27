"use client";

import React, { useState, useEffect } from "react";
import { 
  Table, 
  TableHeader, 
  TableColumn, 
  TableBody, 
  TableRow, 
  TableCell,
  Chip,
  Card,
  CardBody,
  Input,
  Pagination
} from "@heroui/react";
import { 
  ClipboardList, 
  Search, 
  Clock, 
  CheckCircle2, 
  XCircle 
} from "lucide-react";
import { Toaster } from "react-hot-toast";

export default function LogsPage() {
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

  const fetchData = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/applications");
    const data = await res.json();
    setApps(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredApps = apps.filter(app => 
    app.email.toLowerCase().includes(filter.toLowerCase()) ||
    app.reason.toLowerCase().includes(filter.toLowerCase()) ||
    app.ip.includes(filter) ||
    app.deviceId.includes(filter)
  );

  const items = React.useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredApps.slice(start, end);
  }, [page, filteredApps]);

  const statusColorMap: Record<string, any> = {
    approved: "success",
    rejected: "danger",
    pending: "warning",
  };

  const statusTextMap: Record<string, string> = {
    approved: "已通过",
    rejected: "已拒绝",
    pending: "待审核",
  };

  return (
    <div className="max-w-7xl mx-auto">
      <Toaster position="top-center" />
      
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-700 flex items-center gap-2">
            <ClipboardList className="text-pink-400" />
            申请日志
          </h1>
          <p className="text-gray-500">查看所有申请的历史记录与详细信息</p>
        </div>
      </header>

      <Card className="border-none shadow-sm mb-6">
        <CardBody className="p-4">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
            <Input
              placeholder="搜索邮箱、原因、IP或设备指纹..."
              size="sm"
              variant="bordered"
              className="w-full max-w-md"
              startContent={<Search className="text-gray-400 w-4 h-4" />}
              value={filter}
              onValueChange={setFilter}
            />
            <div className="flex gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-orange-400" /> 待处理: {apps.filter(a => a.status === 'pending').length}
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-green-400" /> 已通过: {apps.filter(a => a.status === 'approved').length}
              </span>
              <span className="flex items-center gap-1">
                <XCircle className="w-3 h-3 text-red-400" /> 已拒绝: {apps.filter(a => a.status === 'rejected').length}
              </span>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card className="border-none shadow-sm overflow-hidden">
        <Table 
          aria-label="申请日志表格"
          bottomContent={
            filteredApps.length > rowsPerPage ? (
              <div className="flex w-full justify-center py-4">
                <Pagination
                  isCompact
                  showControls
                  showShadow
                  color="primary"
                  page={page}
                  total={Math.ceil(filteredApps.length / rowsPerPage)}
                  onChange={setPage}
                />
              </div>
            ) : null
          }
          classNames={{
            wrapper: "p-0 shadow-none",
            th: "bg-gray-50 text-gray-600 font-semibold py-4",
            td: "py-4",
          }}
        >
          <TableHeader>
            <TableColumn>申请人</TableColumn>
            <TableColumn>状态</TableColumn>
            <TableColumn>申请时间</TableColumn>
            <TableColumn>IP 地址</TableColumn>
            <TableColumn>设备指纹</TableColumn>
          </TableHeader>
          <TableBody 
            emptyContent={loading ? "加载中..." : "暂无申请记录"}
            items={items}
            loadingContent={"加载中..."}
            isLoading={loading}
          >
            {(item) => (
              <TableRow key={item.id} className="border-b border-gray-50 last:border-0">
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-700">{item.email}</span>
                    <span className="text-xs text-gray-400 line-clamp-1 max-w-[200px]">{item.reason}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Chip 
                    size="sm" 
                    variant="flat" 
                    color={statusColorMap[item.status]}
                  >
                    {statusTextMap[item.status]}
                  </Chip>
                </TableCell>
                <TableCell className="text-sm text-gray-500">
                  {new Date(item.createdAt).toLocaleString()}
                </TableCell>
                <TableCell className="text-sm text-gray-500">
                  {item.ip}
                </TableCell>
                <TableCell className="text-xs text-gray-400 font-mono">
                  {item.deviceId.substring(0, 16)}...
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
