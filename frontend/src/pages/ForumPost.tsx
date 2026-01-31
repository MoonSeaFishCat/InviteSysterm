import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  CardBody,
  Button,
  Chip,
  Spinner,
  Avatar,
  Divider,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Input,
} from "@heroui/react";
import api from '../api/client';
import toast from 'react-hot-toast';
import { FaArrowLeft, FaUser, FaShieldAlt, FaClock, FaReply, FaThumbtack, FaTrash, FaEllipsisV, FaEdit } from 'react-icons/fa';
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
  user_id?: number;
  admin_id?: number;
}

interface ForumReply {
  id: number;
  content: string;
  created_at: number;
  author: string;
  is_admin: boolean;
  parent_reply_id?: number;
  children?: ForumReply[];
}

export default function ForumPost() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<ForumPost | null>(null);
  const [replies, setReplies] = useState<ForumReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<number | null>(null); // 正在回复的回复ID

  // 编辑模态框
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  // 检查是否是管理员或帖子作者
  const userInfo = localStorage.getItem('user_info');
  const adminToken = localStorage.getItem('admin_token');
  const isAdmin = !!adminToken;
  const currentUserId = userInfo ? JSON.parse(userInfo).id : null;

  useEffect(() => {
    fetchPost();
  }, [id]);

  const fetchPost = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/forum/posts/${id}`);
      if (res.data.success) {
        setPost(res.data.post);
        // 构建嵌套回复结构
        const repliesData = res.data.replies || [];
        const repliesMap = new Map<number, ForumReply>();
        const rootReplies: ForumReply[] = [];

        // 第一遍：创建所有回复对象
        repliesData.forEach((reply: any) => {
          repliesMap.set(reply.id, { ...reply, children: [] });
        });

        // 第二遍：构建树形结构
        repliesData.forEach((reply: any) => {
          const replyObj = repliesMap.get(reply.id)!;
          if (reply.parent_reply_id) {
            const parent = repliesMap.get(reply.parent_reply_id);
            if (parent) {
              parent.children!.push(replyObj);
            } else {
              rootReplies.push(replyObj);
            }
          } else {
            rootReplies.push(replyObj);
          }
        });

        setReplies(rootReplies);
      }
    } catch (error: any) {
      toast.error('获取帖子详情失败');
      navigate('/forum');
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async () => {
    if (!replyContent.trim()) {
      toast.error('请输入回复内容');
      return;
    }

    if (replyContent.length < 5) {
      toast.error('回复内容至少需要5个字');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = { content: replyContent };
      if (replyingTo) {
        payload.parent_reply_id = replyingTo;
      }

      // 先尝试用户接口
      let res;
      try {
        res = await api.post(`/user/forum/posts/${id}/reply`, payload);
      } catch (userError: any) {
        // 如果用户接口失败，尝试管理员接口
        if (userError.response?.status === 401) {
          try {
            res = await api.post(`/admin/forum/posts/${id}/reply`, payload);
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
        toast.success('回复成功');
        setReplyContent('');
        setReplyingTo(null);
        fetchPost();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || '回复失败');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('zh-CN');
  };

  // 渲染回复（支持嵌套）
  const renderReply = (reply: ForumReply, depth: number) => {
    const marginLeft = depth > 0 ? `${depth * 2}rem` : '0';

    return (
      <div key={reply.id} style={{ marginLeft }}>
        <div className="flex gap-3">
          <Avatar
            icon={reply.is_admin ? <FaShieldAlt /> : <FaUser />}
            className={reply.is_admin ? 'bg-gradient-to-br from-purple-500 to-pink-500' : 'bg-gradient-to-br from-blue-500 to-cyan-500'}
            size="sm"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={`font-semibold text-sm ${reply.is_admin ? 'text-purple-500' : 'text-default-700'}`}>
                {reply.author}
              </span>
              {reply.is_admin && (
                <Chip size="sm" color="secondary" variant="flat">管理员</Chip>
              )}
              <span className="text-xs text-default-400">
                {formatDate(reply.created_at)}
              </span>
            </div>
            <div className="mb-2">
              <MarkdownRenderer content={reply.content} className="text-sm" />
            </div>
            <Button
              size="sm"
              variant="light"
              color="primary"
              startContent={<FaReply />}
              onPress={() => {
                setReplyingTo(reply.id);
                setReplyContent(`@${reply.author} `);
              }}
            >
              回复
            </Button>
          </div>
        </div>

        {/* 嵌套回复 */}
        {reply.children && reply.children.length > 0 && (
          <div className="mt-3 space-y-3">
            {reply.children.map((childReply) => renderReply(childReply, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const handlePinPost = async () => {
    if (!confirm(post?.is_pinned ? '确定要取消置顶吗？' : '确定要置顶这个帖子吗？')) {
      return;
    }

    try {
      const res = await api.post(`/admin/forum/posts/${id}/pin`, { is_pinned: !post?.is_pinned });
      if (res.data.success) {
        toast.success(post?.is_pinned ? '取消置顶成功' : '置顶成功');
        fetchPost();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || '操作失败');
    }
  };

  const handleDeletePost = async () => {
    if (!confirm('确定要删除这个帖子吗？删除后无法恢复！')) {
      return;
    }

    try {
      const apiPath = isAdmin ? `/admin/forum/posts/${id}` : `/user/forum/posts/${id}`;
      const res = await api.delete(apiPath);
      if (res.data.success) {
        toast.success('删除成功');
        navigate('/forum');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || '删除失败');
    }
  };

  const handleEditPost = () => {
    if (!post) return;
    setEditTitle(post.title);
    setEditContent(post.content);
    onOpen();
  };

  const handleUpdatePost = async () => {
    if (editTitle.trim().length < 5) {
      toast.error('标题至少需要5个字');
      return;
    }

    if (editContent.trim().length < 10) {
      toast.error('内容至少需要10个字');
      return;
    }

    setSubmitting(true);
    try {
      const apiPath = isAdmin ? `/admin/forum/posts/${id}` : `/user/forum/posts/${id}`;
      const res = await api.put(apiPath, {
        title: editTitle,
        content: editContent,
      });

      if (res.data.success) {
        toast.success('更新成功');
        onClose();
        fetchPost();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || '更新失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-8 px-4">
        <div className="max-w-4xl mx-auto flex justify-center py-12">
          <Spinner size="lg" color="primary" />
        </div>
      </div>
    );
  }

  if (!post) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 返回按钮 */}
        <div className="flex justify-between items-center">
          <Button
            variant="light"
            startContent={<FaArrowLeft />}
            onPress={() => navigate('/forum')}
          >
            返回列表
          </Button>

          {/* 管理员操作菜单 */}
          {isAdmin && (
            <Dropdown>
              <DropdownTrigger>
                <Button
                  variant="flat"
                  color="default"
                  startContent={<FaEllipsisV />}
                >
                  管理操作
                </Button>
              </DropdownTrigger>
              <DropdownMenu aria-label="管理员操作">
                <DropdownItem
                  key="edit"
                  startContent={<FaEdit />}
                  onPress={handleEditPost}
                >
                  编辑帖子
                </DropdownItem>
                <DropdownItem
                  key="pin"
                  startContent={<FaThumbtack />}
                  onPress={handlePinPost}
                >
                  {post.is_pinned ? '取消置顶' : '置顶帖子'}
                </DropdownItem>
                <DropdownItem
                  key="delete"
                  className="text-danger"
                  color="danger"
                  startContent={<FaTrash />}
                  onPress={handleDeletePost}
                >
                  删除帖子
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          )}

          {/* 用户编辑和删除自己的帖子 */}
          {!isAdmin && post.user_id === currentUserId && (
            <div className="flex gap-2">
              <Button
                size="sm"
                color="primary"
                variant="flat"
                startContent={<FaEdit />}
                onPress={handleEditPost}
              >
                编辑
              </Button>
              <Button
                size="sm"
                color="danger"
                variant="flat"
                startContent={<FaTrash />}
                onPress={handleDeletePost}
              >
                删除
              </Button>
            </div>
          )}
        </div>

        {/* 帖子内容 */}
        <Card>
          <CardBody className="p-6">
            {/* 标题 */}
            <div className="flex items-center gap-2 mb-4">
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
              <h1 className="text-2xl font-black text-default-900 dark:text-default-100">
                {post.title}
              </h1>
            </div>

            {/* 作者信息 */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Avatar
                  icon={post.is_admin ? <FaShieldAlt /> : <FaUser />}
                  className={post.is_admin ? 'bg-gradient-to-br from-purple-500 to-pink-500' : 'bg-gradient-to-br from-blue-500 to-cyan-500'}
                  size="sm"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${post.is_admin ? 'text-purple-500' : 'text-default-700'}`}>
                      {post.author}
                    </span>
                    {post.is_admin && (
                      <Chip size="sm" color="secondary" variant="flat">管理员</Chip>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-default-400 mt-1">
                    <FaClock />
                    <span>{formatDate(post.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* 用户删除自己的帖子 */}
              {!isAdmin && post.user_id === currentUserId && (
                <Button
                  size="sm"
                  color="danger"
                  variant="flat"
                  startContent={<FaTrash />}
                  onPress={handleDeletePost}
                >
                  删除
                </Button>
              )}
            </div>

            <Divider className="my-4" />

            {/* 帖子内容 */}
            <MarkdownRenderer content={post.content} />
          </CardBody>
        </Card>

        {/* 回复列表 */}
        <Card>
          <CardBody className="p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <FaReply />
              全部回复 ({replies.length})
            </h2>

            {replies.length === 0 ? (
              <p className="text-center text-default-400 py-8">暂无回复，快来抢沙发吧！</p>
            ) : (
              <div className="space-y-4">
                {replies.map((reply, index) => (
                  <div key={reply.id}>
                    {index > 0 && <Divider className="my-4" />}
                    {renderReply(reply, 0)}
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* 回复输入框 */}
        <Card>
          <CardBody className="p-6">
            <h3 className="text-md font-bold mb-4">
              {replyingTo ? '回复评论' : '发表回复'}
              {replyingTo && (
                <Button
                  size="sm"
                  variant="light"
                  color="danger"
                  className="ml-2"
                  onPress={() => {
                    setReplyingTo(null);
                    setReplyContent('');
                  }}
                >
                  取消回复
                </Button>
              )}
            </h3>
            <div className="space-y-4">
              <MonacoEditor
                value={replyContent}
                onChange={setReplyContent}
                height="200px"
                language="markdown"
                placeholder={replyingTo ? "请输入回复内容（至少5个字），支持 Markdown 格式..." : "请输入回复内容（至少5个字），支持 Markdown 格式..."}
              />
              <div className="flex justify-end">
                <Button
                  color="primary"
                  onPress={handleReply}
                  isLoading={submitting}
                  startContent={<FaReply />}
                  className="font-bold"
                >
                  发表回复
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* 编辑帖子模态框 */}
      <Modal isOpen={isOpen} onClose={onClose} size="2xl">
        <ModalContent>
          <ModalHeader>编辑帖子</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Input
                label="标题"
                placeholder="请输入帖子标题（至少5个字）"
                value={editTitle}
                onValueChange={setEditTitle}
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
                  value={editContent}
                  onChange={setEditContent}
                  height="400px"
                  language="markdown"
                  placeholder="请输入帖子内容（至少10个字），支持 Markdown 格式..."
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onClose}>
              取消
            </Button>
            <Button
              color="primary"
              onPress={handleUpdatePost}
              isLoading={submitting}
              className="font-bold"
            >
              保存
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

