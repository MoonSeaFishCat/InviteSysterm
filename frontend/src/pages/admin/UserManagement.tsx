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
} from "@heroui/react";
import api from '../../api/client';
import toast from 'react-hot-toast';
import { FaSearch, FaBan, FaCheck, FaTrash, FaKey, FaEye } from 'react-icons/fa';

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

  useEffect(() => {
    fetchUsers();
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
      <Modal isOpen={isDetailOpen} onClose={onDetailClose} size="2xl">
        <ModalContent>
          <ModalHeader>用户详情</ModalHeader>
          <ModalBody>
            {userDetail && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold mb-2">基本信息</h3>
                  <p>ID: {userDetail.user.id}</p>
                  <p>邮箱: {userDetail.user.email}</p>
                  <p>昵称: {userDetail.user.nickname}</p>
                  <p>状态: {userDetail.user.status === 'active' ? '正常' : '封禁'}</p>
                  <p>注册时间: {formatDate(userDetail.user.created_at)}</p>
                </div>
                
                {userDetail.applications && userDetail.applications.length > 0 && (
                  <div>
                    <h3 className="font-bold mb-2">申请记录</h3>
                    <div className="space-y-2">
                      {userDetail.applications.map((app: any) => (
                        <div key={app.id} className="p-3 border rounded">
                          <p>状态: {app.status}</p>
                          <p>时间: {formatDate(app.created_at)}</p>
                          <p>IP: {app.ip}</p>
                        </div>
                      ))}
                    </div>
                  </div>
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
