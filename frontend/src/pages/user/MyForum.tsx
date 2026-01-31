import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardBody,
  Tabs,
  Tab,
  Chip,
  Spinner,
} from "@heroui/react";
import api from '../../api/client';
import toast from 'react-hot-toast';
import { FaComments, FaReply, FaThumbtack, FaClock } from 'react-icons/fa';
import MarkdownRenderer from '../../components/MarkdownRenderer';

interface ForumPost {
  id: number;
  title: string;
  content: string;
  is_pinned: boolean;
  created_at: number;
  reply_count: number;
}

interface ForumReply {
  id: number;
  post_id: number;
  post_title: string;
  content: string;
  created_at: number;
}

export default function MyForum() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('posts');
  const [myPosts, setMyPosts] = useState<ForumPost[]>([]);
  const [myReplies, setMyReplies] = useState<ForumReply[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeTab === 'posts') {
      fetchMyPosts();
    } else {
      fetchMyReplies();
    }
  }, [activeTab]);

  const fetchMyPosts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/user/forum/my-posts');
      setMyPosts(res.data.data || []);
    } catch (error: any) {
      toast.error('获取我的帖子失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchMyReplies = async () => {
    setLoading(true);
    try {
      const res = await api.get('/user/forum/my-replies');
      setMyReplies(res.data.data || []);
    } catch (error: any) {
      toast.error('获取我的回复失败');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('zh-CN');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">我的论坛</h1>
        <p className="text-sm text-default-500 mt-1">查看我的帖子和回复</p>
      </div>

      <Card>
        <CardBody>
          <Tabs
            selectedKey={activeTab}
            onSelectionChange={(key) => setActiveTab(key as string)}
            color="primary"
            variant="underlined"
          >
            <Tab
              key="posts"
              title={
                <div className="flex items-center gap-2">
                  <FaComments />
                  <span>我的帖子</span>
                  <Chip size="sm" variant="flat">{myPosts.length}</Chip>
                </div>
              }
            >
              {loading ? (
                <div className="flex justify-center py-12">
                  <Spinner size="lg" color="primary" />
                </div>
              ) : myPosts.length === 0 ? (
                <div className="text-center py-12 text-default-400">
                  暂无帖子
                </div>
              ) : (
                <div className="space-y-3 mt-4">
                  {myPosts.map((post) => (
                    <Card
                      key={post.id}
                      isPressable
                      onPress={() => navigate(`/forum/${post.id}`)}
                      className="hover:shadow-md transition-shadow"
                    >
                      <CardBody className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {post.is_pinned && (
                                <Chip size="sm" color="warning" variant="flat" startContent={<FaThumbtack />}>
                                  置顶
                                </Chip>
                              )}
                              <h3 className="font-bold text-default-900">{post.title}</h3>
                            </div>
                            <div className="text-sm line-clamp-2 mb-2">
                              <MarkdownRenderer content={post.content} />
                            </div>
                            <div className="flex items-center gap-4 text-xs text-default-400">
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
                  ))}
                </div>
              )}
            </Tab>




            <Tab
              key="replies"
              title={
                <div className="flex items-center gap-2">
                  <FaReply />
                  <span>我的回复</span>
                  <Chip size="sm" variant="flat">{myReplies.length}</Chip>
                </div>
              }
            >
              {loading ? (
                <div className="flex justify-center py-12">
                  <Spinner size="lg" color="primary" />
                </div>
              ) : myReplies.length === 0 ? (
                <div className="text-center py-12 text-default-400">
                  暂无回复
                </div>
              ) : (
                <div className="space-y-3 mt-4">
                  {myReplies.map((reply) => (
                    <Card
                      key={reply.id}
                      isPressable
                      onPress={() => navigate(`/forum/${reply.post_id}`)}
                      className="hover:shadow-md transition-shadow"
                    >
                      <CardBody className="p-4">
                        <div className="mb-2">
                          <span className="text-xs text-default-400">回复于：</span>
                          <span className="text-sm font-semibold text-primary ml-1">{reply.post_title}</span>
                        </div>
                        <div className="text-sm mb-2">
                          <MarkdownRenderer content={reply.content} />
                        </div>
                        <div className="flex items-center gap-1 text-xs text-default-400">
                          <FaClock />
                          <span>{formatDate(reply.created_at)}</span>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              )}
            </Tab>
          </Tabs>
        </CardBody>
      </Card>
    </div>
  );
}
