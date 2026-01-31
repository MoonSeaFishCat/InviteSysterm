import { useState, useEffect } from 'react';
import {
  Card,
  CardBody,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Chip,
  Spinner,
  Pagination,
} from "@heroui/react";
import api from '../../api/client';
import toast from 'react-hot-toast';
import { FaThumbtack, FaTrash, FaEye, FaComments } from 'react-icons/fa';

interface ForumPost {
  id: number;
  title: string;
  content: string;
  is_pinned: boolean;
  created_at: number;
  author: string;
  is_admin: boolean;
  reply_count: number;
}

export default function ForumManagement() {
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    fetchPosts();
  }, [page]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/forum/posts?page=${page}&page_size=${pageSize}`);
      setPosts(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (error: any) {
      toast.error('获取帖子列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePin = async (id: number, isPinned: boolean) => {
    try {
      const res = await api.post(`/admin/forum/posts/${id}/pin`, { is_pinned: !isPinned });
      if (res.data.success) {
        toast.success(isPinned ? '取消置顶成功' : '置顶成功');
        fetchPosts();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || '操作失败');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个帖子吗？删除后无法恢复！')) {
      return;
    }

    try {
      const res = await api.delete(`/admin/forum/posts/${id}`);
      if (res.data.success) {
        toast.success('删除成功');
        fetchPosts();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || '删除失败');
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('zh-CN');
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">问答专区管理</h1>
          <p className="text-sm text-default-500 mt-1">管理所有帖子和回复</p>
        </div>
        <Button
          color="primary"
          startContent={<FaComments />}
          onPress={() => window.open('/forum', '_blank')}
        >
          查看前台
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-primary/10">
                <FaComments className="text-2xl text-primary" />
              </div>
              <div>
                <p className="text-sm text-default-500">总帖子数</p>
                <p className="text-2xl font-bold">{total}</p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-warning/10">
                <FaThumbtack className="text-2xl text-warning" />
              </div>
              <div>
                <p className="text-sm text-default-500">置顶帖子</p>
                <p className="text-2xl font-bold">{posts.filter(p => p.is_pinned).length}</p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-success/10">
                <FaComments className="text-2xl text-success" />
              </div>
              <div>
                <p className="text-sm text-default-500">总回复数</p>
                <p className="text-2xl font-bold">{posts.reduce((sum, p) => sum + p.reply_count, 0)}</p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>



      {/* 帖子列表 */}
      <Card>
        <CardBody>
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" color="primary" />
            </div>
          ) : (
            <>
              <Table aria-label="帖子列表">
                <TableHeader>
                  <TableColumn>标题</TableColumn>
                  <TableColumn>作者</TableColumn>
                  <TableColumn>回复数</TableColumn>
                  <TableColumn>发布时间</TableColumn>
                  <TableColumn>状态</TableColumn>
                  <TableColumn>操作</TableColumn>
                </TableHeader>
                <TableBody>
                  {posts.map((post) => (
                    <TableRow key={post.id}>
                      <TableCell>
                        <div className="max-w-md">
                          <p className="font-semibold truncate">{post.title}</p>
                          <p className="text-xs text-default-400 truncate">{post.content}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{post.author}</span>
                          {post.is_admin && (
                            <Chip size="sm" color="secondary" variant="flat">管理员</Chip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Chip size="sm" variant="flat">{post.reply_count}</Chip>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{formatDate(post.created_at)}</span>
                      </TableCell>
                      <TableCell>
                        {post.is_pinned && (
                          <Chip size="sm" color="warning" variant="flat" startContent={<FaThumbtack />}>
                            置顶
                          </Chip>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="flat"
                            startContent={<FaEye />}
                            onPress={() => window.open(`/forum/${post.id}`, '_blank')}
                          >
                            查看
                          </Button>
                          <Button
                            size="sm"
                            color={post.is_pinned ? 'default' : 'warning'}
                            variant="flat"
                            startContent={<FaThumbtack />}
                            onPress={() => handlePin(post.id, post.is_pinned)}
                          >
                            {post.is_pinned ? '取消置顶' : '置顶'}
                          </Button>
                          <Button
                            size="sm"
                            color="danger"
                            variant="flat"
                            startContent={<FaTrash />}
                            onPress={() => handleDelete(post.id)}
                          >
                            删除
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* 分页 */}
              {total > pageSize && (
                <div className="flex justify-center mt-4">
                  <Pagination
                    total={Math.ceil(total / pageSize)}
                    page={page}
                    onChange={setPage}
                    showControls
                    color="primary"
                  />
                </div>
              )}
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
