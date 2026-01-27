"use client";

import React, { useState, useEffect } from "react";
import { 
  Table, 
  TableHeader, 
  TableColumn, 
  TableBody, 
  TableRow, 
  TableCell,
  User,
  Chip,
  Tooltip,
  Button,
  Card,
  CardBody,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Textarea
} from "@heroui/react";
import { 
  Check, 
  X, 
  Eye, 
  LayoutDashboard, 
  Users, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Search,
  Heart
} from "lucide-react";
import { toast, Toaster } from "react-hot-toast";

export default function AdminPage() {
  const [apps, setApps] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  
  // Review Modal State
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [reviewStatus, setReviewStatus] = useState<"approved" | "rejected">("approved");
  const [manualCode, setManualCode] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [appsRes, statsRes] = await Promise.all([
      fetch("/api/admin/applications"),
      fetch("/api/stats")
    ]);
    const appsData = await appsRes.json();
    const statsData = await statsRes.json();
    setApps(appsData);
    setStats(statsData);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openReviewModal = (app: any, status: "approved" | "rejected") => {
    setSelectedApp(app);
    setReviewStatus(status);
    setManualCode("");
    setAdminNote("");
    onOpen();
  };

  const handleReviewSubmit = async (onClose: () => void) => {
    if (reviewStatus === "approved" && !manualCode) {
      toast.error("请输入邀请码");
      return;
    }
    
    setSubmitting(true);
    const res = await fetch("/api/admin/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appId: selectedApp.id,
        status: reviewStatus,
        data: {
          code: manualCode,
          note: adminNote
        }
      }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (data.success) {
      toast.success("审核成功，已发送邮件通知");
      onClose();
      fetchData();
    } else {
      toast.error(data.message || "审核操作失败");
    }
  };

  const filteredApps = apps.filter(app => 
    app.email.toLowerCase().includes(filter.toLowerCase()) ||
    app.reason.toLowerCase().includes(filter.toLowerCase())
  );

  if (loading && !apps.length) {
    return <div className="p-8 text-center text-gray-500">加载中...</div>;
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <Toaster position="top-center" />
      
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-700">管理后台</h1>
          <p className="text-gray-500">查看和处理邀请码申请</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="flat" 
            color="primary" 
            onClick={fetchData}
            startContent={<Clock className="w-4 h-4" />}
          >
            刷新数据
          </Button>
        </div>
      </header>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard 
          title="待审核" 
          value={stats?.pending || 0} 
          icon={<Clock className="text-orange-500" />} 
          color="orange"
        />
        <StatCard 
          title="已审核" 
          value={stats?.processed || 0} 
          icon={<CheckCircle2 className="text-blue-500" />} 
          color="blue"
        />
        <StatCard 
          title="已通过" 
          value={stats?.approved || 0} 
          icon={<Heart className="text-green-500" />} 
          color="green"
        />
      </div>

      {/* Review Modal */}
      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>
                {reviewStatus === "approved" ? "通过申请" : "拒绝申请"} - {selectedApp?.email}
              </ModalHeader>
              <ModalBody className="gap-4">
                {reviewStatus === "approved" && (
                  <Input
                    label="邀请码"
                    placeholder="请输入要发送的邀请码"
                    value={manualCode}
                    onValueChange={setManualCode}
                    variant="bordered"
                  />
                )}
                <Textarea
                  label={reviewStatus === "approved" ? "备注 (可选)" : "拒绝理由"}
                  placeholder={reviewStatus === "approved" ? "将作为邮件备注发送" : "请说明拒绝原因"}
                  value={adminNote}
                  onValueChange={setAdminNote}
                  variant="bordered"
                />
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onClick={onClose}>取消</Button>
                <Button 
                  color={reviewStatus === "approved" ? "success" : "danger"} 
                  onClick={() => handleReviewSubmit(onClose)} 
                  isLoading={submitting}
                >
                  确认{reviewStatus === "approved" ? "通过" : "拒绝"}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Application Management */}
      <Card className="border-none shadow-sm">
        <CardBody className="p-0">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-700 flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4" />
              申请列表
            </h2>
            <div className="w-full max-w-xs">
              <Input
                placeholder="搜索邮箱或理由..."
                size="sm"
                startContent={<Search className="w-4 h-4 text-gray-400" />}
                value={filter}
                onValueChange={setFilter}
              />
            </div>
          </div>
          
          <Table aria-label="申请列表" removeWrapper className="min-w-full">
            <TableHeader>
              <TableColumn>申请人</TableColumn>
              <TableColumn>理由</TableColumn>
              <TableColumn>状态</TableColumn>
              <TableColumn>提交时间</TableColumn>
              <TableColumn>操作</TableColumn>
            </TableHeader>
            <TableBody emptyContent="暂无申请数据">
              {filteredApps.map((app) => (
                <TableRow key={app.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{app.email}</span>
                      <span className="text-xs text-gray-400">IP: {app.ip}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Tooltip content={app.reason}>
                      <p className="text-sm text-gray-600 max-w-[200px] truncate cursor-help">
                        {app.reason}
                      </p>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      color={
                        app.status === "approved" ? "success" : 
                        app.status === "rejected" ? "danger" : "warning"
                      }
                      variant="flat"
                      size="sm"
                    >
                      {app.status === "approved" ? "已通过" : 
                       app.status === "rejected" ? "已拒绝" : "待审核"}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-500">
                      {new Date(app.createdAt).toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {app.status === "pending" && (
                        <>
                          <Button 
                            isIconOnly 
                            size="sm" 
                            color="success" 
                            variant="flat"
                            onClick={() => openReviewModal(app, "approved")}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button 
                            isIconOnly 
                            size="sm" 
                            color="danger" 
                            variant="flat"
                            onClick={() => openReviewModal(app, "rejected")}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}

function StatCard({ title, value, icon, color }: any) {
  const colorMap: any = {
    blue: "bg-blue-50 border-blue-100",
    orange: "bg-orange-50 border-orange-100",
    green: "bg-green-50 border-green-100",
    red: "bg-red-50 border-red-100",
    purple: "bg-purple-50 border-purple-100",
  };

  return (
    <Card className={`border-none shadow-sm ${colorMap[color]} border`}>
      <CardBody className="flex flex-row items-center gap-4 p-4">
        <div className={`p-3 rounded-xl bg-white/50`}>
          {icon}
        </div>
        <div className="flex flex-col">
          <span className="text-sm text-gray-500">{title}</span>
          <span className="text-2xl font-bold text-gray-700">{value}</span>
        </div>
      </CardBody>
    </Card>
  );
}
