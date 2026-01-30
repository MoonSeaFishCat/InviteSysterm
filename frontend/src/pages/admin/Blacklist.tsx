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
  Textarea,
} from "@heroui/react";
import api from '../../api/client';
import toast from 'react-hot-toast';
import { FaSearch, FaPlus, FaTrash, FaEdit } from 'react-icons/fa';

interface BlacklistItem {
  id: number;
  type: string;
  value: string;
  reason: string;
  created_by: number;
  created_by_username: string;
  created_at: number;
  updated_at: number;
}

export default function Blacklist() {
  const [blacklist, setBlacklist] = useState<BlacklistItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [selectedItem, setSelectedItem] = useState<BlacklistItem | null>(null);
  const [formData, setFormData] = useState({
    type: 'email',
    value: '',
    reason: '',
  });

  const { isOpen: isAddOpen, onOpen: onAddOpen, onClose: onAddClose } = useDisclosure();
  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();

  useEffect(() => {
    fetchBlacklist();
  }, [page, typeFilter]);

  const fetchBlacklist = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/blacklist', {
        params: { page, pageSize, type: typeFilter, search },
      });
      setBlacklist(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (error: any) {
      toast.error('获取黑名单失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchBlacklist();
  };

  const handleAdd = async () => {
    if (!formData.type || !formData.value) {
      toast.error('请填写完整信息');
      return;
    }

    try {
      await api.post('/admin/blacklist', formData);
      toast.success('已添加到黑名单');
      onAddClose();
      setFormData({ type: 'email', value: '', reason: '' });
      fetchBlacklist();
    } catch (error: any) {
      toast.error(error.response?.data?.message || '添加失败');
    }
  };

  const handleEdit = async () => {
    if (!selectedItem) return;

    try {
      await api.put(`/admin/blacklist/${selectedItem.id}`, {
        reason: formData.reason,
      });
      toast.success('黑名单已更新');
      onEditClose();
      fetchBlacklist();
    } catch (error: any) {
      toast.error(error.response?.data?.message || '更新失败');
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;

    try {
      await api.delete(`/admin/blacklist/${selectedItem.id}`);
      toast.success('已从黑名单移除');
      onDeleteClose();
      fetchBlacklist();
    } catch (error: any) {
      toast.error(error.response?.data?.message || '删除失败');
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'email':
        return '邮箱';
      case 'device':
        return '设备';
      case 'ip':
        return 'IP';
      default:
        return type;
    }
  };

  const getTypeColor = (type: string): "default" | "primary" | "secondary" | "success" | "warning" | "danger" => {
    switch (type) {
      case 'email':
        return 'primary';
      case 'device':
        return 'secondary';
      case 'ip':
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('zh-CN');
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">黑名单管理</h1>
        <Button
          color="primary"
          startContent={<FaPlus />}
          onPress={onAddOpen}
        >
          添加黑名单
        </Button>
      </div>

      <div className="flex gap-4 mb-6">
        <Input
          placeholder="搜索值或原因"
          value={search}
          onValueChange={setSearch}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          className="max-w-xs"
          startContent={<FaSearch />}
        />
        <Select
          placeholder="类型筛选"
          className="max-w-xs"
          selectedKeys={typeFilter ? [typeFilter] : []}
          onSelectionChange={(keys) => {
            const selected = Array.from(keys)[0] as string;
            setTypeFilter(selected || '');
          }}
        >
          <SelectItem key="">全部</SelectItem>
          <SelectItem key="email">邮箱</SelectItem>
          <SelectItem key="device">设备指纹</SelectItem>
          <SelectItem key="ip">IP地址</SelectItem>
        </Select>
        <Button color="primary" onPress={handleSearch}>
          搜索
        </Button>
      </div>

      <Table aria-label="黑名单列表">
        <TableHeader>
          <TableColumn>ID</TableColumn>
          <TableColumn>类型</TableColumn>
          <TableColumn>值</TableColumn>
          <TableColumn>原因</TableColumn>
          <TableColumn>操作人</TableColumn>
          <TableColumn>添加时间</TableColumn>
          <TableColumn>操作</TableColumn>
        </TableHeader>
        <TableBody
          items={blacklist}
          isLoading={loading}
          emptyContent="暂无黑名单"
        >
          {(item) => (
            <TableRow key={item.id}>
              <TableCell>{item.id}</TableCell>
              <TableCell>
                <Chip color={getTypeColor(item.type)} size="sm">
                  {getTypeLabel(item.type)}
                </Chip>
              </TableCell>
              <TableCell>
                <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                  {item.value}
                </code>
              </TableCell>
              <TableCell>{item.reason || '-'}</TableCell>
              <TableCell>{item.created_by_username}</TableCell>
              <TableCell>{formatDate(item.created_at)}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="flat"
                    color="primary"
                    onPress={() => {
                      setSelectedItem(item);
                      setFormData({ ...formData, reason: item.reason });
                      onEditOpen();
                    }}
                  >
                    <FaEdit />
                  </Button>
                  <Button
                    size="sm"
                    variant="flat"
                    color="danger"
                    onPress={() => {
                      setSelectedItem(item);
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

      {/* 添加黑名单模态框 */}
      <Modal isOpen={isAddOpen} onClose={onAddClose}>
        <ModalContent>
          <ModalHeader>添加黑名单</ModalHeader>
          <ModalBody>
            <Select
              label="类型"
              selectedKeys={[formData.type]}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string;
                setFormData({ ...formData, type: selected });
              }}
            >
              <SelectItem key="email">邮箱</SelectItem>
              <SelectItem key="device">设备指纹</SelectItem>
              <SelectItem key="ip">IP地址</SelectItem>
            </Select>
            <Input
              label="值"
              placeholder={
                formData.type === 'email'
                  ? '例如: user@example.com'
                  : formData.type === 'device'
                  ? '例如: device-fingerprint-123'
                  : '例如: 192.168.1.1'
              }
              value={formData.value}
              onValueChange={(v) => setFormData({ ...formData, value: v })}
            />
            <Textarea
              label="原因（可选）"
              placeholder="说明拉黑原因"
              value={formData.reason}
              onValueChange={(v) => setFormData({ ...formData, reason: v })}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onAddClose}>
              取消
            </Button>
            <Button color="primary" onPress={handleAdd}>
              添加
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 编辑黑名单模态框 */}
      <Modal isOpen={isEditOpen} onClose={onEditClose}>
        <ModalContent>
          <ModalHeader>编辑黑名单原因</ModalHeader>
          <ModalBody>
            <Textarea
              label="原因"
              placeholder="说明拉黑原因"
              value={formData.reason}
              onValueChange={(v) => setFormData({ ...formData, reason: v })}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onEditClose}>
              取消
            </Button>
            <Button color="primary" onPress={handleEdit}>
              保存
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 删除确认模态框 */}
      <Modal isOpen={isDeleteOpen} onClose={onDeleteClose}>
        <ModalContent>
          <ModalHeader>确认删除</ModalHeader>
          <ModalBody>
            <p>确定要从黑名单中移除该项吗？</p>
            <div className="mt-2 p-3 bg-gray-100 rounded">
              <p className="text-sm">
                <span className="font-bold">类型:</span> {getTypeLabel(selectedItem?.type || '')}
              </p>
              <p className="text-sm">
                <span className="font-bold">值:</span> {selectedItem?.value}
              </p>
            </div>
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
    </div>
  );
}
