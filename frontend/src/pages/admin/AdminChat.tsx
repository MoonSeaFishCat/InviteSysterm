import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Avatar,
  Chip,
  Divider,
  ScrollShadow,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Textarea
} from "@heroui/react";
import { 
  FaComments, 
  FaPaperPlane, 
  FaUserShield, 
  FaUserEdit, 
  FaThumbtack, 
  FaStar, 
  FaEllipsisV,
  FaQuoteRight,
  FaTimes,
  FaUsers
} from 'react-icons/fa';
import api from '../../api/client';
import toast from 'react-hot-toast';
import type { ChatMessage } from '../../types';

export default function AdminChat() {
  const location = useLocation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [quoteMessage, setQuoteMessage] = useState<ChatMessage | null>(null);
  const [chatType, setChatType] = useState<'global' | 'audit'>('global');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    try {
      const url = '/admin/chat/global';
      const params: any = {};
      if (chatType === 'audit') {
        params.room = 'audit';
      }
      const res = await api.get(url, { params });
      if (res.data.success) {
        const newMessages = res.data.data || [];
        setMessages(newMessages);
        if (newMessages.length > 0) {
          setTimeout(scrollToBottom, 100);
        }
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

    // 处理跳转过来的请求
    if (location.state) {
      const { chatType } = location.state;
      if (chatType) setChatType(chatType);
    }
  }, [location.state]);

  useEffect(() => {
    fetchMessages();
    
    // 每10秒自动刷新消息
    const interval = setInterval(() => {
      fetchMessages();
    }, 10000);
    return () => clearInterval(interval);
  }, [chatType]);

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
      const url = '/admin/chat/global';
      const data: any = { message: newMessage };
      if (quoteMessage) data.quote_id = quoteMessage.id;
      if (chatType === 'audit') {
        data.room = 'audit';
      }

      const res = await api.post(url, data);
      if (res.data.success) {
        setMessages([...messages, res.data.data]);
        setNewMessage('');
        setQuoteMessage(null);
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

  const handleQuoteMessage = (msg: ChatMessage) => {
    setQuoteMessage(msg);
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
          {chatType === 'global' ? <FaComments className="text-primary" /> : 
           <FaUserShield className="text-success" />}
          {chatType === 'global' ? '全站大厅' : '审核团队专属聊天室'}
        </h2>
        <div className="flex gap-2">
          <Button 
            size="sm" 
            color={chatType === 'global' ? 'primary' : 'default'}
            variant={chatType === 'global' ? 'solid' : 'flat'}
            onPress={() => setChatType('global')}
          >
            全局聊天室
          </Button>
          <Button 
            size="sm" 
            color={chatType === 'audit' ? 'primary' : 'default'}
            variant={chatType === 'audit' ? 'solid' : 'flat'}
            onPress={() => setChatType('audit')}
            startContent={<FaUserShield className="text-xs" />}
          >
            审核团队专属
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
        {/* 右侧聊天窗口 */}
        <div className="lg:col-span-4 flex flex-col gap-6 h-full overflow-hidden">

          <Card className="shadow-lg border-none flex-grow overflow-hidden flex flex-col">
            <CardHeader className="flex justify-between items-center px-6 py-4 bg-default-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  {chatType === 'global' ? <FaUsers size={20} /> : <FaComments size={20} />}
                </div>
                <div>
                  <h3 className="text-sm font-bold">
                    {chatType === 'global' ? '全局聊天室' : '审核团队专属聊天室'}
                  </h3>
                  <p className="text-tiny text-default-400">
                    {chatType === 'global' ? '全站所有人可见' : '仅管理员可见'}
                  </p>
                </div>
              </div>
            </CardHeader>
            <Divider />
            <CardBody className="p-0 flex flex-col h-full relative overflow-hidden">
          <ScrollShadow className="flex-1 p-6 space-y-4" hideScrollBar>
            {loading ? (
              <div className="text-center text-default-400 py-10">加载中...</div>
            ) : !messages || messages.length === 0 ? (
              <div className="text-center text-default-400 py-10">
                暂无消息，开始聊天吧！
              </div>
            ) : (
              messages.map((msg) => {
                // 在管理员端：
                // 全局模式下根据是否是当前用户决定显示在左侧还是右侧
                const isCurrentUser = currentUser && Number(currentUser.id) === Number(msg.senderId) && msg.senderType === 'admin';
                const showOnRight = isCurrentUser;

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${showOnRight ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <Avatar
                      icon={msg.senderType === 'user' ? <FaUsers /> : (msg.senderRole === 'super' ? <FaUserShield /> : <FaUserEdit />)}
                      className={
                        msg.senderType === 'user'
                          ? 'bg-gradient-to-br from-gray-400 to-gray-500'
                          : msg.senderRole === 'super' 
                            ? 'bg-gradient-to-br from-purple-500 to-pink-500' 
                            : msg.senderRole === 'reviewer'
                              ? 'bg-gradient-to-br from-blue-500 to-cyan-500'
                              : 'bg-gradient-to-br from-green-500 to-emerald-500'
                      }
                      size="sm"
                    />
                    <div className={`flex flex-col gap-1 max-w-[70%] ${showOnRight ? 'items-end' : 'items-start'}`}>
                      <div className={`flex items-center gap-2 flex-wrap ${showOnRight ? 'flex-row-reverse' : 'flex-row'}`}>
                        <span className="text-sm font-semibold">{msg.senderUsername}</span>
                        {msg.senderType === 'admin' && (
                          <Chip size="sm" variant="flat" color={msg.senderRole === 'super' ? 'secondary' : 'primary'} className="h-4 px-1 text-[8px]">
                            {msg.senderRole === 'super' ? '超级管理员' : '审核员'}
                          </Chip>
                        )}
                        {msg.senderType === 'user' && (
                          <Chip size="sm" variant="flat" color="default" className="h-4 px-1 text-[8px]">
                            用户
                          </Chip>
                        )}
                    <span className="text-[10px] text-default-400">
                      {new Date(msg.createdAt).toLocaleString()}
                    </span>
                  </div>
                  
                  {msg.quoteContent && (
                    <div className="bg-default-100 p-2 rounded-lg text-xs text-default-500 border-l-4 border-primary mb-1 italic max-w-full">
                      <div className="flex items-center gap-1 opacity-70 mb-1">
                        <FaQuoteRight size={8} />
                        <span>引用自 {msg.quoteUsername || '未知用户'}</span>
                      </div>
                      <p className="truncate">{msg.quoteContent}</p>
                    </div>
                  )}

                  <div className={`relative group p-3 rounded-2xl shadow-sm ${
                    showOnRight 
                      ? 'bg-primary text-primary-foreground rounded-tr-none' 
                      : 'bg-default-100 text-default-900 rounded-tl-none'
                  } ${msg.isPinned ? 'border-2 border-warning' : ''} ${msg.isFeatured ? 'border-2 border-secondary' : ''}`}>
                    <div className="whitespace-pre-wrap break-words">{msg.message}</div>
                    {(msg.isPinned || msg.isFeatured) && (
                      <div className="flex gap-1 mt-1">
                        {msg.isPinned && <FaThumbtack className="text-warning text-[10px]" />}
                        {msg.isFeatured && <FaStar className="text-secondary text-[10px]" />}
                      </div>
                    )}

                    <div className={`absolute ${showOnRight ? '-left-8' : '-right-8'} top-0 opacity-0 group-hover:opacity-100 transition-opacity`}>
                      <Dropdown>
                        <DropdownTrigger>
                          <Button isIconOnly size="sm" variant="light" className="min-w-fit h-fit p-1">
                            <FaEllipsisV size={12} className="text-default-400" />
                          </Button>
                        </DropdownTrigger>
                        <DropdownMenu aria-label="消息操作">
                          <DropdownItem 
                            key="quote" 
                            startContent={<FaQuoteRight size={12} />}
                            onPress={() => handleQuoteMessage(msg)}
                          >
                            回复
                          </DropdownItem>
                          {currentUser?.role === 'super' ? (
                            <DropdownItem 
                              key="pin" 
                              startContent={<FaThumbtack size={12} />}
                              onPress={() => handlePinMessage(msg.id, msg.isPinned)}
                            >
                              {msg.isPinned ? '取消置顶' : '置顶'}
                            </DropdownItem>
                          ) : null}
                          {currentUser?.role === 'super' ? (
                            <DropdownItem 
                              key="feature" 
                              startContent={<FaStar size={12} />}
                              onPress={() => handleFeatureMessage(msg.id, msg.isFeatured)}
                            >
                              {msg.isFeatured ? '取消加精' : '加精'}
                            </DropdownItem>
                          ) : null}
                          {currentUser?.role === 'super' || isCurrentUser ? (
                            <DropdownItem 
                              key="delete" 
                              color="danger" 
                              className="text-danger"
                              startContent={<FaTimes size={12} />}
                              onPress={() => handleDeleteMessage(msg.id)}
                            >
                              删除
                            </DropdownItem>
                          ) : null}
                        </DropdownMenu>
                      </Dropdown>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
            )}
            <div ref={messagesEndRef} />
          </ScrollShadow>
          
          <Divider />
          
          <div className="p-4 bg-default-50 flex flex-col gap-2">
            {quoteMessage && (
              <div className="flex justify-between items-center bg-default-200 p-2 rounded-lg text-sm">
                <span className="truncate flex-1 italic text-default-600">
                  引用: {quoteMessage.message}
                </span>
                <Button size="sm" variant="light" isIconOnly onPress={() => setQuoteMessage(null)}>
                  <FaTimes />
                </Button>
              </div>
            )}
            <div className="flex gap-2 items-end">
              <Textarea
                value={newMessage}
                onValueChange={setNewMessage}
                placeholder={
                  chatType === 'global' ? "发送全站广播（所有人可见）..." : 
                  "发送审核团队内部消息..."
                }
                onKeyDown={handleKeyPress}
                minRows={1}
                maxRows={4}
                className="flex-1"
                isDisabled={sending}
                variant="bordered"
              />
              <Button
                color="primary"
                isIconOnly
                onPress={handleSendMessage}
                isLoading={sending}
                className="h-10 w-10 min-w-10"
              >
                <FaPaperPlane />
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  </div>
</div>
  );
}
