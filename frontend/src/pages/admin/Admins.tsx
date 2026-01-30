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
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Select,
  SelectItem,
  Chip,
  Tooltip,
  Checkbox
} from "@heroui/react";
import { FaPlus, FaTrash, FaEdit, FaUserShield, FaUserEdit, FaLock, FaCheckSquare } from 'react-icons/fa';
import { SiLinux } from 'react-icons/si';
import api from '../../api/client';
import toast from 'react-hot-toast';

interface Admin {
  id: number;
  username: string;
  role: 'super' | 'reviewer';
  permissions?: string;
  linuxdoId?: string;
  createdAt: string;
  updatedAt: string;
}

const PERMISSIONS = [
  { key: 'applications', label: '申请管理' },
  { key: 'tickets', label: '工单管理' },
  { key: 'messages', label: '站内信管理' },
  { key: 'announcements', label: '公告管理' },
  { key: 'settings', label: '系统设置' },
  { key: 'admins', label: '管理员管理' },
];

export default function Admins() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const { isOpen: isBatchOpen, onOpen: onBatchOpen, onOpenChange: onBatchOpenChange } = useDisclosure();
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [selectedAdminIds, setSelectedAdminIds] = useState<Set<number>>(new Set());

  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'super' | 'reviewer'>('reviewer');
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [batchPermissions, setBatchPermissions] = useState<Set<string>>(new Set());

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/admins');
      setAdmins(res.data);
    } catch (error) {
      toast.error("加载管理员列表失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setRole('reviewer');
    setSelectedPermissions(new Set());
    setSelectedAdmin(null);
  };

  const handleAddOpen = () => {
    setModalMode('add');
    resetForm();
    onOpen();
  };

  const handleEditOpen = (admin: Admin) => {
    setModalMode('edit');
    setSelectedAdmin(admin);
    setUsername(admin.username);
    setPassword('');
    setRole(admin.role);
    if (admin.permissions === 'all') {
      setSelectedPermissions(new Set(PERMISSIONS.map(p => p.key)));
    } else {
      setSelectedPermissions(new Set(admin.permissions?.split(',').filter(p => p) || []));
    }
    onOpen();
  };

  const handleSubmit = async () => {
    const permissionsStr = role === 'super' ? 'all' : Array.from(selectedPermissions).join(',');
    
    if (modalMode === 'add') {
      if (!username || !password || !role) {
        toast.error("请填写完整信息");
        return;
      }
      try {
        await api.post('/admin/admins', { 
          username, 
          password, 
          role,
          permissions: permissionsStr
        });
        toast.success("添加成功");
        onOpenChange();
        fetchAdmins();
      } catch (error: any) {
        toast.error(error.response?.data?.message || "添加失败");
      }
    } else {
      try {
        await api.put(`/admin/admins/${selectedAdmin?.id}`, { 
          password: password || undefined, 
          role,
          permissions: permissionsStr
        });
        toast.success("更新成功");
        onOpenChange();
        fetchAdmins();
      } catch (error: any) {
        toast.error(error.response?.data?.message || "更新失败");
      }
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除该管理员吗？")) return;
    try {
      await api.delete(`/admin/admins/${id}`);
      toast.success("删除成功");
      fetchAdmins();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "删除失败");
    }
  };

  const handleBatchPermissionsOpen = () => {
    if (selectedAdminIds.size === 0) {
      toast.error("请先选择要设置权限的管理员");
      return;
    }
    setBatchPermissions(new Set());
    onBatchOpen();
  };

  const handleBatchPermissionsSubmit = async () => {
    if (batchPermissions.size === 0) {
      toast.error("请至少选择一个权限");
      return;
    }

    try {
      const permissionsStr = Array.from(batchPermissions).join(',');
      const res = await api.post('/admin/admins/batch-update-permissions', {
        adminIds: Array.from(selectedAdminIds),
        permissions: permissionsStr
      });

      toast.success(res.data.message || "批量设置权限成功");
      setSelectedAdminIds(new Set());
      onBatchOpenChange();
      fetchAdmins();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "批量设置权限失败");
    }
  };

  const toggleSelectAdmin = (id: number) => {
    const newSet = new Set(selectedAdminIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedAdminIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedAdminIds.size === admins.filter(a => a.role !== 'super').length) {
      setSelectedAdminIds(new Set());
    } else {
      setSelectedAdminIds(new Set(admins.filter(a => a.role !== 'super').map(a => a.id)));
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? '未知' : date.toLocaleString();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <FaUserShield className="text-primary" />
          管理员管理
        </h2>
        <div className="flex gap-2">
          {selectedAdminIds.size > 0 && (
            <Button
              color="secondary"
              startContent={<FaCheckSquare />}
              onPress={handleBatchPermissionsOpen}
              radius="lg"
              className="font-bold shadow-md"
            >
              批量设置权限 ({selectedAdminIds.size})
            </Button>
          )}
          <Button
            color="primary"
            startContent={<FaPlus />}
            onPress={handleAddOpen}
            radius="lg"
            className="font-bold shadow-md"
          >
            新增管理员
          </Button>
        </div>
      </div>

      <Table aria-label="Admins table" className="shadow-sm border border-divider rounded-xl">
        <TableHeader>
          <TableColumn>
            <Checkbox
              isSelected={selectedAdminIds.size === admins.filter(a => a.role !== 'super').length && admins.filter(a => a.role !== 'super').length > 0}
              onValueChange={toggleSelectAll}
              size="sm"
            />
          </TableColumn>
          <TableColumn>用户名</TableColumn>
          <TableColumn>角色</TableColumn>
          <TableColumn>权限</TableColumn>
          <TableColumn>Linux DO</TableColumn>
          <TableColumn>创建时间</TableColumn>
          <TableColumn align="center">操作</TableColumn>
        </TableHeader>
        <TableBody
          loadingContent={"加载中..."}
          isLoading={loading}
          emptyContent={"暂无管理员"}
        >
          {admins.map((admin) => (
            <TableRow key={admin.id}>
              <TableCell>
                {admin.role !== 'super' ? (
                  <Checkbox
                    isSelected={selectedAdminIds.has(admin.id)}
                    onValueChange={() => toggleSelectAdmin(admin.id)}
                    size="sm"
                  />
                ) : (
                  <span className="text-default-300 text-xs">-</span>
                )}
              </TableCell>
              <TableCell className="font-medium">{admin.username}</TableCell>
              <TableCell>
                <Chip
                  color={admin.role === 'super' ? "danger" : "primary"}
                  variant="flat"
                  size="sm"
                  className="font-bold"
                >
                  {admin.role === 'super' ? "超级管理员" : "审核员"}
                </Chip>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {admin.role === 'super' || admin.permissions === 'all' ? (
                    <Chip size="sm" variant="dot" color="success">全部权限</Chip>
                  ) : (
                    admin.permissions?.split(',').filter(p => p).map(p => {
                      const label = PERMISSIONS.find(perm => perm.key === p)?.label || p;
                      return <Chip key={p} size="sm" variant="flat" color="default">{label}</Chip>;
                    })
                  )}
                  {(!admin.permissions && admin.role !== 'super') && (
                    <span className="text-default-400 text-xs">无权限</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {admin.linuxdoId ? (
                  <Chip size="sm" color="success" variant="flat" startContent={<SiLinux size={12} />}>
                    已绑定 ({admin.linuxdoId})
                  </Chip>
                ) : (
                  <span className="text-default-400 text-sm">未绑定</span>
                )}
              </TableCell>
              <TableCell className="text-default-500">{formatDate(admin.createdAt)}</TableCell>
              <TableCell>
                <div className="flex justify-center gap-2">
                  <Tooltip content="编辑">
                    <Button 
                      isIconOnly 
                      size="sm" 
                      variant="light" 
                      onPress={() => handleEditOpen(admin)}
                    >
                      <FaEdit className="text-default-400 hover:text-primary transition-colors" />
                    </Button>
                  </Tooltip>
                  <Tooltip content="删除" color="danger">
                    <Button 
                      isIconOnly 
                      size="sm" 
                      variant="light" 
                      onPress={() => handleDelete(admin.id)}
                    >
                      <FaTrash className="text-default-400 hover:text-danger transition-colors" />
                    </Button>
                  </Tooltip>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Modal isOpen={isOpen} onOpenChange={onOpenChange} backdrop="blur">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex gap-2 items-center">
                {modalMode === 'add' ? <FaPlus /> : <FaUserEdit />}
                {modalMode === 'add' ? "新增管理员" : "编辑管理员"}
              </ModalHeader>
              <ModalBody className="gap-4">
                <Input
                  label="用户名"
                  placeholder="请输入用户名"
                  value={username}
                  onValueChange={setUsername}
                  isDisabled={modalMode === 'edit'}
                  variant="bordered"
                  radius="lg"
                  autoComplete="username"
                  startContent={<FaUserShield className="text-default-400" />}
                />
                <Input
                  label={modalMode === 'edit' ? "新密码 (留空不修改)" : "密码"}
                  placeholder="请输入密码"
                  type="password"
                  value={password}
                  onValueChange={setPassword}
                  variant="bordered"
                  radius="lg"
                  autoComplete="new-password"
                  startContent={<FaLock className="text-default-400" />}
                />
                <Select
                  label="角色"
                  placeholder="选择角色"
                  selectedKeys={[role]}
                  onSelectionChange={(keys) => setRole(Array.from(keys)[0] as any)}
                  variant="bordered"
                  radius="lg"
                >
                  <SelectItem key="super" textValue="超级管理员">超级管理员</SelectItem>
                  <SelectItem key="reviewer" textValue="审核员">审核员</SelectItem>
                </Select>

                {role === 'reviewer' && (
                  <Select
                    label="权限设置"
                    placeholder="为审核员分配权限"
                    selectionMode="multiple"
                    selectedKeys={selectedPermissions}
                    onSelectionChange={(keys) => setSelectedPermissions(new Set(Array.from(keys) as string[]))}
                    variant="bordered"
                    radius="lg"
                  >
                    {PERMISSIONS.map((p) => (
                      <SelectItem key={p.key} textValue={p.label}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </Select>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose} radius="lg">
                  取消
                </Button>
                <Button color="primary" onPress={handleSubmit} radius="lg" className="font-bold shadow-md">
                  确定
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* 批量设置权限模态框 */}
      <Modal isOpen={isBatchOpen} onOpenChange={onBatchOpenChange} backdrop="blur">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex gap-2 items-center">
                <FaCheckSquare />
                批量设置权限
              </ModalHeader>
              <ModalBody className="gap-4">
                <p className="text-sm text-default-500">
                  已选择 <span className="font-bold text-primary">{selectedAdminIds.size}</span> 个审核员
                </p>
                <Select
                  label="权限设置"
                  placeholder="为审核员分配权限"
                  selectionMode="multiple"
                  selectedKeys={batchPermissions}
                  onSelectionChange={(keys) => setBatchPermissions(new Set(Array.from(keys) as string[]))}
                  variant="bordered"
                  radius="lg"
                >
                  {PERMISSIONS.map((p) => (
                    <SelectItem key={p.key} textValue={p.label}>
                      {p.label}
                    </SelectItem>
                  ))}
                </Select>
                <p className="text-xs text-warning">
                  ⚠️ 注意：此操作将覆盖所选审核员的现有权限设置
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose} radius="lg">
                  取消
                </Button>
                <Button color="primary" onPress={handleBatchPermissionsSubmit} radius="lg" className="font-bold shadow-md">
                  确定
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
