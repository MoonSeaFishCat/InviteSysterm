import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardBody,
  Button,
  Chip,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Spinner,
  Avatar,
  Pagination,
} from "@heroui/react";
import api from '../api/client';
import toast from 'react-hot-toast';
import { FaPlus, FaSearch, FaComments, FaUser, FaShieldAlt, FaThumbtack, FaClock } from 'react-icons/fa';
import MonacoEditor from '../components/MonacoEditor';
import MarkdownRenderer from '../components/MarkdownRenderer';

interface ForumPost {
  id: number;
  title: string;
  content: string;
  is_pinned: boolean;
  created_at: number;
  updated_at: number;
  author: string;
  is_admin: boolean;
  reply_count: number;
}

export default function Forum() {
  const navigate = useNavigate();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
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

  const handleCreatePost = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error('请填写标题和内容');
      return;
    }

    if (title.length < 5) {
      toast.error('标题至少需要5个字');
      return;
    }

    if (content.length < 10) {
      toast.error('内容至少需要10个字');
      return;
    }

    setSubmitting(true);
    try {
      // 先尝试用户接口
      let res;
      try {
        res = await api.post('/user/forum/posts', { title, content });
      } catch (userError: any) {
        // 如果用户接口失败，尝试管理员接口
        if (userError.response?.status === 401) {
          try {
            res = await api.post('/admin/forum/posts', { title, content });
          } catch (adminError: any) {
            // 两个接口都失败了
            if (adminError.response?.status === 401) {
              toast.error('请先登录');
              navigate('/login');
              return;
            }
            throw adminError;
          }
        } else {
          throw userError;
        }
      }

      if (res && res.data.success) {
        toast.success('发布成功');
        setTitle('');
        setContent('');
        onClose();
        fetchPosts();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || '发布失败');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('zh-CN');
  };

  const filteredPosts = posts.filter(post =>
    post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              问答专区
            </h1>
            <p className="text-default-500 text-sm mt-1">分享经验，交流问题</p>
          </div>
          <Button
            color="primary"
            startContent={<FaPlus />}
            onPress={onOpen}
            className="font-bold"
          >
            发布帖子
          </Button>
        </div>

        {/* 搜索栏 */}
        <Card>
          <CardBody>
            <Input
              placeholder="搜索帖子..."
              startContent={<FaSearch className="text-default-400" />}
              value={searchQuery}
              onValueChange={setSearchQuery}
              variant="bordered"
              radius="lg"
            />
          </CardBody>
        </Card>

        {/* 帖子列表 */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" color="primary" />
          </div>
        ) : filteredPosts.length === 0 ? (
          <Card>
            <CardBody className="text-center py-12">
              <p className="text-default-400">暂无帖子</p>
            </CardBody>
          </Card>
        ) : (
          filteredPosts.map((post) => (
          <Card
            key={post.id}
            isPressable
            onPress={() => navigate(`/forum/${post.id}`)}
            className="hover:shadow-lg transition-shadow"
          >
            <CardBody className="p-6">
              <div className="flex items-start gap-4">
                {/* 左侧头像 */}
                <Avatar
                  icon={post.is_admin ? <FaShieldAlt /> : <FaUser />}
                  className={post.is_admin ? 'bg-gradient-to-br from-purple-500 to-pink-500' : 'bg-gradient-to-br from-blue-500 to-cyan-500'}
                />

                {/* 右侧内容 */}
                <div className="flex-1 min-w-0">
                  {/* 标题行 */}
                  <div className="flex items-center gap-2 mb-2">
                    {post.is_pinned && (
                      <Chip
                        size="sm"
                        color="warning"
                        variant="flat"
                        startContent={<FaThumbtack className="text-xs" />}
                      >
                        置顶
                      </Chip>
                    )}
                    <h3 className="text-lg font-bold text-default-900 dark:text-default-100 truncate">
                      {post.title}
                    </h3>
                  </div>

                  {/* 内容预览 */}
                  <div className="text-sm line-clamp-2 mb-3">
                    <MarkdownRenderer content={post.content} />
                  </div>

                  {/* 底部信息 */}
                  <div className="flex items-center gap-4 text-xs text-default-400">
                    <div className="flex items-center gap-1">
                      {post.is_admin ? <FaShieldAlt className="text-purple-500" /> : <FaUser />}
                      <span className={post.is_admin ? 'text-purple-500 font-semibold' : ''}>
                        {post.author}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <FaClock />
                      <span>{formatDate(post.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <FaComments />
                      <span>{post.reply_count} 回复</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        )))}

        {/* 分页 */}
        {!loading && total > pageSize && (
          <div className="flex justify-center mt-6">
            <Pagination
              total={Math.ceil(total / pageSize)}
              page={page}
              onChange={setPage}
              showControls
              color="primary"
            />
          </div>
        )}
      </div>

      {/* 发布帖子模态框 */}
      <Modal isOpen={isOpen} onClose={onClose} size="2xl">
        <ModalContent>
          <ModalHeader>发布新帖子</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Input
                label="标题"
                placeholder="请输入帖子标题（至少5个字）"
                value={title}
                onValueChange={setTitle}
                variant="bordered"
                radius="lg"
                classNames={{
                  label: "font-bold text-primary",
                  inputWrapper: "border-2"
                }}
              />

              <div>
                <label className="block text-sm font-bold text-primary mb-2">内容</label>
                <MonacoEditor
                  value={content}
                  onChange={setContent}
                  height="400px"
                  language="markdown"
                  placeholder="请输入帖子内容（至少10个字），支持 Markdown 格式..."
                />
              </div>

              <div className="p-3 bg-primary/10 rounded-lg">
                <p className="text-xs text-default-600">
                  💡 <span className="font-semibold">发帖提示：</span>
                  请文明发言，尊重他人。支持 Markdown 格式，可以使用代码块、列表等。
                </p>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onClose}>
              取消
            </Button>
            <Button
              color="primary"
              onPress={handleCreatePost}
              isLoading={submitting}
              className="font-bold"
            >
              发布
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

