import { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Input,
  Button,
  Avatar,
  Chip,
  Divider,
  ScrollShadow,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem
} from "@heroui/react";
import { FaComments, FaPaperPlane, FaTrash, FaUserShield, FaUserEdit, FaThumbtack, FaStar, FaEllipsisV } from 'react-icons/fa';
import api from '../../api/client';
import toast from 'react-hot-toast';

interface ChatMessage {
  id: number;
  adminId: number;
  adminUsername: string;
  adminRole: 'super' | 'reviewer';
  message: string;
  isPinned: boolean;
  isFeatured: boolean;
  createdAt: string;
}

export default function AdminChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    try {
      const res = await api.get('/admin/chat/messages');
      if (res.data.success) {
        setMessages(res.data.data);
        setTimeout(scrollToBottom, 100);
      }
    } catch (error) {
      toast.error("加载消息失败");
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const res = await api.get('/admin/me');
      if (res.data.success) {
        setCurrentUser(res.data.data);
      }
    } catch (error) {
      console.error("获取当前用户失败", error);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
    fetchMessages();
    
    // 每10秒自动刷新消息
    const interval = setInterval(fetchMessages, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) {
      toast.error("请输入消息内容");
      return;
    }

    if (newMessage.length > 1000) {
      toast.error("消息长度不能超过1000字符");
      return;
    }

    setSending(true);
    try {
      const res = await api.post('/admin/chat/messages', { message: newMessage });
      if (res.data.success) {
        setMessages([...messages, res.data.data]);
        setNewMessage('');
        setTimeout(scrollToBottom, 100);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "发送失败");
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (id: number) => {
    if (!confirm("确定要删除这条消息吗？")) return;

    try {
      await api.delete(`/admin/chat/messages/${id}`);
      toast.success("删除成功");
      setMessages(messages.filter(m => m.id !== id));
    } catch (error: any) {
      toast.error(error.response?.data?.message || "删除失败");
    }
  };

  const handlePinMessage = async (id: number, isPinned: boolean) => {
    try {
      if (isPinned) {
        await api.put(`/admin/chat/messages/${id}/unpin`);
        toast.success("取消置顶成功");
      } else {
        await api.put(`/admin/chat/messages/${id}/pin`);
        toast.success("置顶成功");
      }
      fetchMessages();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "操作失败");
    }
  };

  const handleFeatureMessage = async (id: number, isFeatured: boolean) => {
    try {
      if (isFeatured) {
        await api.put(`/admin/chat/messages/${id}/unfeature`);
        toast.success("取消加精成功");
      } else {
        await api.put(`/admin/chat/messages/${id}/feature`);
        toast.success("加精成功");
      }
      fetchMessages();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "操作失败");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-200px)]">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <FaComments className="text-primary" />
          审核员交流空间
        </h2>
        <Chip color="primary" variant="flat">
          {messages.length} 条消息
        </Chip>
      </div>

      <Card className="flex-1 flex flex-col shadow-lg border border-divider">
        <CardHeader className="border-b border-divider bg-default-50/50">
          <div className="flex items-center gap-2">
            <FaComments className="text-primary" />
            <span className="font-bold">实时交流</span>
            <Chip size="sm" variant="dot" color="success">在线</Chip>
          </div>
        </CardHeader>
        
        <CardBody className="flex-1 flex flex-col p-0">
          <ScrollShadow className="flex-1 p-6 space-y-4" hideScrollBar>
            {loading ? (
              <div className="text-center text-default-400 py-10">加载中...</div>
            ) : messages.length === 0 ? (
              <div className="text-center text-default-400 py-10">
                暂无消息，开始聊天吧！
              </div>
            ) : (
              messages.map((msg) => {
                const isCurrentUser = currentUser?.username === msg.adminUsername;
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <Avatar
                      icon={msg.adminRole === 'super' ? <FaUserShield /> : <FaUserEdit />}
                      className={msg.adminRole === 'super' ? 'bg-gradient-to-br from-purple-500 to-pink-500' : 'bg-gradient-to-br from-blue-500 to-cyan-500'}
                      size="sm"
                    />
                    <div className={`flex flex-col gap-1 max-w-[70%] ${isCurrentUser ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{msg.adminUsername}</span>
                        <Chip
                          size="sm"
                          color={msg.adminRole === 'super' ? 'secondary' : 'primary'}
                          variant="flat"
                        >
                          {msg.adminRole === 'super' ? '超级管理员' : '审核员'}
                        </Chip>
                        {msg.isPinned && (
                          <Chip
                            size="sm"
                            color="warning"
                            variant="flat"
                            startContent={<FaThumbtack size={10} />}
                          >
                            置顶
                          </Chip>
                        )}
                        {msg.isFeatured && (
                          <Chip
                            size="sm"
                            color="success"
                            variant="flat"
                            startContent={<FaStar size={10} />}
                          >
                            加精
                          </Chip>
                        )}
                        <span className="text-xs text-default-400">{msg.createdAt}</span>
                      </div>
                      <div className={`relative group ${isCurrentUser ? 'bg-primary text-primary-foreground' : 'bg-default-100'} rounded-2xl px-4 py-2 shadow-sm`}>
                        <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                        {currentUser?.role === 'super' && (
                          <Dropdown>
                            <DropdownTrigger>
                              <Button
                                isIconOnly
                                size="sm"
                                color="default"
                                variant="flat"
                                className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <FaEllipsisV size={12} />
                              </Button>
                            </DropdownTrigger>
                            <DropdownMenu aria-label="消息操作">
                              <DropdownItem
                                key="pin"
                                startContent={<FaThumbtack />}
                                onPress={() => handlePinMessage(msg.id, msg.isPinned)}
                              >
                                {msg.isPinned ? '取消置顶' : '置顶公告'}
                              </DropdownItem>
                              <DropdownItem
                                key="feature"
                                startContent={<FaStar />}
                                onPress={() => handleFeatureMessage(msg.id, msg.isFeatured)}
                              >
                                {msg.isFeatured ? '取消加精' : '加精消息'}
                              </DropdownItem>
                              <DropdownItem
                                key="delete"
                                color="danger"
                                startContent={<FaTrash />}
                                onPress={() => handleDeleteMessage(msg.id)}
                              >
                                删除消息
                              </DropdownItem>
                            </DropdownMenu>
                          </Dropdown>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </ScrollShadow>

          <Divider />

          <div className="p-4 bg-default-50/50">
            <div className="flex gap-2">
              <Input
                placeholder="输入消息... (Shift+Enter 换行，Enter 发送)"
                value={newMessage}
                onValueChange={setNewMessage}
                onKeyPress={handleKeyPress}
                variant="bordered"
                radius="lg"
                size="lg"
                maxLength={1000}
                classNames={{
                  inputWrapper: "border-2 focus-within:border-primary"
                }}
                endContent={
                  <span className="text-xs text-default-400">
                    {newMessage.length}/1000
                  </span>
                }
              />
              <Button
                color="primary"
                size="lg"
                isLoading={sending}
                onPress={handleSendMessage}
                isIconOnly
                className="min-w-14"
              >
                <FaPaperPlane />
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

