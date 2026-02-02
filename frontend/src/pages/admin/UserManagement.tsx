import { useState, useEffect } from 'react';
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Input,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Select,
  SelectItem,
  Pagination,
  Card,
  CardBody,
  Divider,
  Avatar,
  Checkbox,
} from "@heroui/react";
import api from '../../api/client';
import toast from 'react-hot-toast';
import { FaSearch, FaBan, FaCheck, FaTrash, FaKey, FaEye, FaUser, FaEnvelope, FaClock, FaShieldAlt, FaTicketAlt, FaFileAlt, FaComments } from 'react-icons/fa';

interface User {
  id: number;
  email: string;
  nickname: string;
  status: string;
  created_at: number;
  updated_at: number;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  
  const { isOpen: isResetOpen, onOpen: onResetOpen, onClose: onResetClose } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const { isOpen: isDetailOpen, onOpen: onDetailOpen, onClose: onDetailClose } = useDisclosure();
  
  const [userDetail, setUserDetail] = useState<any>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchUsers();
    setSelectedUserIds(new Set()); // 切换页面或筛选时清空选择
  }, [page, statusFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/all-users', {
        params: { page, pageSize, status: statusFilter, search },
      });
      setUsers(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (error: any) {
      toast.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedUserIds.size === 0) {
      toast.error("请先选择要删除的用户");
      return;
    }
    if (!confirm(`确定要批量删除这 ${selectedUserIds.size} 个用户吗？`)) return;
    try {
      const res = await api.post('/admin/all-users/batch-delete', {
        userIds: Array.from(selectedUserIds)
      });
      toast.success(res.data.message || "批量删除成功");
      setSelectedUserIds(new Set());
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "批量删除失败");
    }
  };

  const handleBatchUpdateStatus = async (status: string) => {
    if (selectedUserIds.size === 0) {
      toast.error("请先选择要更新状态的用户");
      return;
    }
    const actionText = status === 'active' ? '解封' : '封禁';
    if (!confirm(`确定要批量${actionText}这 ${selectedUserIds.size} 个用户吗？`)) return;
    try {
      const res = await api.post('/admin/all-users/batch-status', {
        userIds: Array.from(selectedUserIds),
        status: status
      });
      toast.success(res.data.message || `批量${actionText}成功`);
      setSelectedUserIds(new Set());
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || `批量${actionText}失败`);
    }
  };

  const toggleSelectUser = (id: number) => {
    const newSet = new Set(selectedUserIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedUserIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedUserIds.size === users.length && users.length > 0) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(users.map(u => u.id)));
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchUsers();
  };

  const handleStatusChange = async (user: User, newStatus: string) => {
    try {
      await api.put(`/admin/all-users/${user.id}/status`, { status: newStatus });
      toast.success('用户状态已更新');
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || '操作失败');
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('密码至少6个字符');
      return;
    }
    try {
      await api.post(`/admin/all-users/${selectedUser?.id}/reset-password`, {
        newPassword,
      });
      toast.success('密码已重置');
      onResetClose();
      setNewPassword('');
    } catch (error: any) {
      toast.error(error.response?.data?.message || '重置失败');
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/admin/all-users/${selectedUser?.id}`);
      toast.success('用户已删除');
      onDeleteClose();
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || '删除失败');
    }
  };

  const handleViewDetail = async (user: User) => {
    setSelectedUser(user);
    try {
      const res = await api.get(`/admin/all-users/${user.id}`);
      setUserDetail(res.data);
      onDetailOpen();
    } catch (error: any) {
      toast.error('获取详情失败');
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('zh-CN');
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">用户管理</h1>
        <div className="flex gap-2">
          {selectedUserIds.size > 0 && (
            <>
              <Button
                color="success"
                variant="flat"
                startContent={<FaCheck />}
                onPress={() => handleBatchUpdateStatus('active')}
                radius="lg"
                className="font-bold shadow-md"
              >
                批量解封 ({selectedUserIds.size})
              </Button>
              <Button
                color="warning"
                variant="flat"
                startContent={<FaBan />}
                onPress={() => handleBatchUpdateStatus('banned')}
                radius="lg"
                className="font-bold shadow-md"
              >
                批量封禁 ({selectedUserIds.size})
              </Button>
              <Button
                color="danger"
                variant="flat"
                startContent={<FaTrash />}
                onPress={handleBatchDelete}
                radius="lg"
                className="font-bold shadow-md"
              >
                批量删除 ({selectedUserIds.size})
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <Input
          placeholder="搜索邮箱或昵称"
          value={search}
          onValueChange={setSearch}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          className="max-w-xs"
          startContent={<FaSearch />}
        />
        <Select
          placeholder="状态筛选"
          className="max-w-xs"
          selectedKeys={statusFilter ? [statusFilter] : []}
          onSelectionChange={(keys) => {
            const selected = Array.from(keys)[0] as string;
            setStatusFilter(selected || '');
          }}
        >
          <SelectItem key="">全部</SelectItem>
          <SelectItem key="active">正常</SelectItem>
          <SelectItem key="banned">封禁</SelectItem>
        </Select>
        <Button color="primary" onPress={handleSearch}>
          搜索
        </Button>
      </div>

      <Table aria-label="用户列表">
        <TableHeader>
          <TableColumn>
            <Checkbox
              isSelected={selectedUserIds.size === users.length && users.length > 0}
              onValueChange={toggleSelectAll}
              size="sm"
            />
          </TableColumn>
          <TableColumn>ID</TableColumn>
          <TableColumn>邮箱</TableColumn>
          <TableColumn>昵称</TableColumn>
          <TableColumn>状态</TableColumn>
          <TableColumn>注册时间</TableColumn>
          <TableColumn>操作</TableColumn>
        </TableHeader>
        <TableBody
          items={users}
          isLoading={loading}
          emptyContent="暂无用户"
        >
          {(user) => (
            <TableRow key={user.id}>
              <TableCell>
                <Checkbox
                  isSelected={selectedUserIds.has(user.id)}
                  onValueChange={() => toggleSelectUser(user.id)}
                  size="sm"
                />
              </TableCell>
              <TableCell>{user.id}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>{user.nickname}</TableCell>
              <TableCell>
                <Chip
                  color={user.status === 'active' ? 'success' : 'danger'}
                  size="sm"
                >
                  {user.status === 'active' ? '正常' : '封禁'}
                </Chip>
              </TableCell>
              <TableCell>{formatDate(user.created_at)}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="flat"
                    color="primary"
                    onPress={() => handleViewDetail(user)}
                  >
                    <FaEye />
                  </Button>
                  {user.status === 'active' ? (
                    <Button
                      size="sm"
                      variant="flat"
                      color="warning"
                      onPress={() => handleStatusChange(user, 'banned')}
                    >
                      <FaBan />
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="flat"
                      color="success"
                      onPress={() => handleStatusChange(user, 'active')}
                    >
                      <FaCheck />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="flat"
                    color="secondary"
                    onPress={() => {
                      setSelectedUser(user);
                      onResetOpen();
                    }}
                  >
                    <FaKey />
                  </Button>
                  <Button
                    size="sm"
                    variant="flat"
                    color="danger"
                    onPress={() => {
                      setSelectedUser(user);
                      onDeleteOpen();
                    }}
                  >
                    <FaTrash />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex justify-center mt-6">
        <Pagination
          total={Math.ceil(total / pageSize)}
          page={page}
          onChange={setPage}
        />
      </div>

      {/* 重置密码模态框 */}
      <Modal isOpen={isResetOpen} onClose={onResetClose}>
        <ModalContent>
          <ModalHeader>重置密码</ModalHeader>
          <ModalBody>
            <p className="mb-4">为用户 {selectedUser?.email} 重置密码</p>
            <Input
              label="新密码"
              type="password"
              value={newPassword}
              onValueChange={setNewPassword}
              placeholder="至少6个字符"
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onResetClose}>
              取消
            </Button>
            <Button color="primary" onPress={handleResetPassword}>
              确认重置
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 删除确认模态框 */}
      <Modal isOpen={isDeleteOpen} onClose={onDeleteClose}>
        <ModalContent>
          <ModalHeader>确认删除</ModalHeader>
          <ModalBody>
            <p>确定要删除用户 {selectedUser?.email} 吗？</p>
            <p className="text-danger text-sm mt-2">此操作不可撤销！</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onDeleteClose}>
              取消
            </Button>
            <Button color="danger" onPress={handleDelete}>
              确认删除
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 详情模态框 */}
      <Modal isOpen={isDetailOpen} onClose={onDetailClose} size="3xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <Avatar
                icon={<FaUser />}
                classNames={{
                  base: "bg-gradient-to-br from-indigo-500 to-pink-500",
                  icon: "text-white",
                }}
                size="lg"
              />
              <div>
                <h2 className="text-xl font-bold">用户详情</h2>
                <p className="text-sm text-gray-500">{userDetail?.user?.email}</p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody>
            {userDetail && (
              <div className="space-y-6">
                {/* 基本信息卡片 */}
                <Card>
                  <CardBody>
                    <div className="flex items-center gap-2 mb-4">
                      <FaUser className="text-primary" />
                      <h3 className="text-lg font-bold">基本信息</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-500 mb-1">用户 ID</p>
                          <p className="font-semibold">#{userDetail.user.id}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 mb-1 flex items-center gap-1">
                            <FaEnvelope className="text-xs" /> 邮箱地址
                          </p>
                          <p className="font-semibold break-all">{userDetail.user.email}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 mb-1">昵称</p>
                          <p className="font-semibold">{userDetail.user.nickname || '未设置'}</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-500 mb-1 flex items-center gap-1">
                            <FaShieldAlt className="text-xs" /> 账号状态
                          </p>
                          <Chip
                            color={userDetail.user.status === 'active' ? 'success' : 'danger'}
                            variant="flat"
                            size="sm"
                          >
                            {userDetail.user.status === 'active' ? '✓ 正常' : '✗ 封禁'}
                          </Chip>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 mb-1 flex items-center gap-1">
                            <FaClock className="text-xs" /> 注册时间
                          </p>
                          <p className="font-semibold text-sm">{formatDate(userDetail.user.created_at)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 mb-1 flex items-center gap-1">
                            <FaClock className="text-xs" /> 最后更新
                          </p>
                          <p className="font-semibold text-sm">{formatDate(userDetail.user.updated_at)}</p>
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>

                {/* 申请记录 */}
                {userDetail.applications && userDetail.applications.length > 0 && (
                  <Card>
                    <CardBody>
                      <div className="flex items-center gap-2 mb-4">
                        <FaFileAlt className="text-warning" />
                        <h3 className="text-lg font-bold">申请记录</h3>
                        <Chip size="sm" variant="flat">{userDetail.applications.length}</Chip>
                      </div>
                      <div className="space-y-3">
                        {userDetail.applications.map((app: any, index: number) => (
                          <div key={app.id}>
                            {index > 0 && <Divider className="my-3" />}
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Chip
                                    size="sm"
                                    color={
                                      app.status === 'approved' ? 'success' :
                                      app.status === 'rejected' ? 'danger' :
                                      'warning'
                                    }
                                    variant="flat"
                                  >
                                    {app.status === 'approved' ? '✓ 已通过' :
                                     app.status === 'rejected' ? '✗ 已拒绝' :
                                     '⏳ 待审核'}
                                  </Chip>
                                  <span className="text-xs text-gray-500">申请 ID: #{app.id}</span>
                                </div>
                                <div className="space-y-1 text-sm">
                                  <p className="text-gray-600">
                                    <span className="font-semibold">申请理由：</span>
                                    {app.reason || '无'}
                                  </p>
                                  {app.admin_note && (
                                    <p className="text-gray-600">
                                      <span className="font-semibold">管理员备注：</span>
                                      {app.admin_note}
                                    </p>
                                  )}
                                  {app.review_opinion && (
                                    <p className="text-gray-600">
                                      <span className="font-semibold">审核意见：</span>
                                      {app.review_opinion}
                                    </p>
                                  )}
                                  <div className="flex gap-4 text-xs text-gray-500 mt-2">
                                    <span>📅 {formatDate(app.created_at)}</span>
                                    <span>🌐 IP: {app.ip}</span>
                                    {app.device_id && <span>🖥️ 设备: {app.device_id.substring(0, 8)}...</span>}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardBody>
                  </Card>
                )}

                {/* 工单记录 */}
                {userDetail.tickets && userDetail.tickets.length > 0 && (
                  <Card>
                    <CardBody>
                      <div className="flex items-center gap-2 mb-4">
                        <FaTicketAlt className="text-secondary" />
                        <h3 className="text-lg font-bold">工单记录</h3>
                        <Chip size="sm" variant="flat">{userDetail.tickets.length}</Chip>
                      </div>
                      <div className="space-y-3">
                        {userDetail.tickets.map((ticket: any, index: number) => (
                          <div key={ticket.id}>
                            {index > 0 && <Divider className="my-3" />}
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Chip
                                    size="sm"
                                    color={
                                      ticket.status === 'closed' ? 'default' :
                                      ticket.status === 'replied' ? 'success' :
                                      'warning'
                                    }
                                    variant="flat"
                                  >
                                    {ticket.status === 'closed' ? '已关闭' :
                                     ticket.status === 'replied' ? '已回复' :
                                     '待处理'}
                                  </Chip>
                                  <span className="text-xs text-gray-500">工单 ID: #{ticket.id}</span>
                                </div>
                                <p className="font-semibold mb-1">{ticket.subject}</p>
                                <p className="text-sm text-gray-600 line-clamp-2">{ticket.content}</p>
                                <p className="text-xs text-gray-500 mt-2">📅 {formatDate(ticket.created_at)}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardBody>
                  </Card>
                )}

                {/* 站内信统计 */}
                {userDetail.messages_count !== undefined && (
                  <Card>
                    <CardBody>
                      <div className="flex items-center gap-2 mb-4">
                        <FaComments className="text-primary" />
                        <h3 className="text-lg font-bold">站内信统计</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
                          <p className="text-3xl font-bold text-primary">{userDetail.messages_count || 0}</p>
                          <p className="text-sm text-gray-600 mt-1">总消息数</p>
                        </div>
                        <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg">
                          <p className="text-3xl font-bold text-success">{userDetail.unread_messages_count || 0}</p>
                          <p className="text-sm text-gray-600 mt-1">未读消息</p>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                )}

                {/* 空状态提示 */}
                {(!userDetail.applications || userDetail.applications.length === 0) &&
                 (!userDetail.tickets || userDetail.tickets.length === 0) && (
                  <Card>
                    <CardBody>
                      <div className="text-center py-8 text-gray-500">
                        <p>该用户暂无申请记录和工单记录</p>
                      </div>
                    </CardBody>
                  </Card>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button color="primary" variant="light" onPress={onDetailClose}>
              关闭
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
