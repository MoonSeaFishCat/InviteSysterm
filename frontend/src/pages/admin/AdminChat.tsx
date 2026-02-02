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
  DropdownSection,
  Textarea,
  Select,
  SelectItem
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
  const [chatType, setChatType] = useState<'global' | 'private'>('global');
  const [receiverId, setReceiverId] = useState<number | null>(null);
  const [receiverType, setReceiverType] = useState<'admin' | 'user'>('admin');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [admins, setAdmins] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [pendingMessages, setPendingMessages] = useState<any[]>([]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchPendingMessages = async () => {
    try {
      const res = await api.get('/admin/chat/pending');
      if (res.data.success) {
        setPendingMessages(res.data.data || []);
      }
    } catch (error) {
      console.error("获取待回复私信失败", error);
    }
  };

  const fetchMessages = async () => {
    try {
      const url = chatType === 'global' ? '/admin/chat/global' : '/admin/chat/private';
      const params: any = {};
      if (chatType === 'private' && receiverId) {
        params.receiver_id = receiverId;
        params.receiver_type = receiverType;
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

  const fetchAdmins = async () => {
    try {
      const res = await api.get('/admin/admins');
      setAdmins(res.data || []);
    } catch (error) {
      console.error("获取管理员列表失败", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users');
      if (res.data.success) {
        setUsers(res.data.data || []);
      }
    } catch (error) {
      console.error("获取用户列表失败", error);
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
    fetchAdmins();
    fetchUsers();
    fetchPendingMessages();

    // 处理跳转过来的私信请求
    if (location.state) {
      const { receiverId, receiverType, chatType } = location.state;
      if (receiverId) setReceiverId(receiverId);
      if (receiverType) setReceiverType(receiverType);
      if (chatType) setChatType(chatType);
    }
  }, [location.state]);

  useEffect(() => {
    fetchMessages();
    fetchPendingMessages();
    
    // 每10秒自动刷新消息
    const interval = setInterval(() => {
      fetchMessages();
      fetchPendingMessages();
    }, 10000);
    return () => clearInterval(interval);
  }, [chatType, receiverId]);

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
      const url = chatType === 'global' ? '/admin/chat/global' : '/admin/chat/private';
      const data: any = { message: newMessage };
      if (quoteMessage) data.quote_id = quoteMessage.id;
      if (chatType === 'private' && receiverId) {
        data.receiver_id = receiverId;
        data.receiver_type = receiverType;
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
          <FaComments className="text-primary" />
          审核员交流空间
        </h2>
        <div className="flex gap-2">
          <Button 
            size="sm" 
            color={chatType === 'global' ? 'primary' : 'default'}
            variant={chatType === 'global' ? 'solid' : 'flat'}
            onPress={() => setChatType('global')}
          >
            全站广播
          </Button>
          <Button 
            size="sm" 
            color={chatType === 'private' ? 'primary' : 'default'}
            variant={chatType === 'private' ? 'solid' : 'flat'}
            onPress={() => setChatType('private')}
            endContent={pendingMessages.length > 0 && (
              <Chip size="sm" color="danger" variant="solid" className="min-w-[18px] h-[18px] p-0 text-[10px]">
                {pendingMessages.length}
              </Chip>
            )}
          >
            私信消息
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
        {/* 左侧待回复列表 (仅在私信模式显示) */}
        {chatType === 'private' && (
          <div className="lg:col-span-1 flex flex-col gap-4 overflow-hidden h-full">
            <Card className="shadow-sm border border-divider h-full">
              <CardHeader className="flex flex-col items-start px-4 py-3 gap-1 bg-default-50">
                <p className="text-sm font-bold flex items-center gap-2">
                  <FaStar className="text-warning" />
                  待回复私信
                </p>
                <p className="text-[10px] text-default-400">点击用户即可开始回复</p>
              </CardHeader>
              <Divider />
              <CardBody className="p-0">
                <ScrollShadow className="h-full">
                  {pendingMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-default-400 p-4 text-center">
                      <FaComments size={24} className="mb-2 opacity-20" />
                      <p className="text-xs">暂无待回复私信</p>
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      {pendingMessages.map((msg) => (
                        <div 
                          key={msg.id}
                          className={`p-3 border-b border-divider cursor-pointer hover:bg-default-100 transition-colors ${receiverId === msg.sender_id ? 'bg-primary-50' : ''}`}
                          onClick={() => {
                            setReceiverId(msg.sender_id);
                            setReceiverType(msg.sender_type || 'user');
                            setChatType('private');
                          }}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-bold truncate max-w-[100px]">{msg.sender_username}</span>
                            <span className="text-[10px] text-default-400">{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          </div>
                          <p className="text-xs text-default-500 truncate">{msg.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollShadow>
              </CardBody>
            </Card>
          </div>
        )}

        {/* 右侧聊天窗口 */}
        <div className={chatType === 'private' ? "lg:col-span-3 flex flex-col gap-6 h-full overflow-hidden" : "lg:col-span-4 flex flex-col gap-6 h-full overflow-hidden"}>
          {chatType === 'private' && (
            <Card className="shadow-sm border border-divider">
              <CardBody className="flex flex-row gap-4 items-center p-3">
                <div className="flex items-center gap-2 text-sm font-bold text-default-600 min-w-fit">
                  <FaUsers className="text-primary" />
                  当前会话:
                </div>
                <Select
                  placeholder="搜索或选择私信对象"
                  size="sm"
                  className="max-w-xs"
                  selectedKeys={receiverId ? [`${receiverType}-${receiverId}`] : []}
                  onSelectionChange={(keys) => {
                    const key = Array.from(keys)[0] as string;
                    if (key) {
                      const [type, id] = key.split('-');
                      setReceiverId(Number(id));
                      setReceiverType(type as 'admin' | 'user');
                    }
                  }}
                >
                  <DropdownSection title="管理员">
                    {admins.filter(admin => admin.id !== currentUser?.id).map(admin => (
                      <SelectItem key={`admin-${admin.id}`} textValue={admin.username} startContent={<Avatar name={admin.username} size="sm" className="w-5 h-5" />}>
                        {admin.username}
                      </SelectItem>
                    ))}
                  </DropdownSection>
                  <DropdownSection title="普通用户">
                    {users.map(user => (
                      <SelectItem key={`user-${user.id}`} textValue={user.nickname || user.email} startContent={<Avatar name={user.nickname || user.email} size="sm" className="w-5 h-5" />}>
                        {user.nickname || user.email}
                      </SelectItem>
                    ))}
                  </DropdownSection>
                </Select>
                {receiverId && (
                  <Button size="sm" variant="light" color="danger" isIconOnly onPress={() => setReceiverId(null)}>
                    <FaTimes />
                  </Button>
                )}
              </CardBody>
            </Card>
          )}

          <Card className="shadow-lg border-none flex-grow overflow-hidden flex flex-col">
            <CardHeader className="flex justify-between items-center px-6 py-4 bg-default-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  {chatType === 'global' ? <FaUsers size={20} /> : <FaComments size={20} />}
                </div>
                <div>
                  <h3 className="font-bold">
                    {chatType === 'global' ? '全站广播' : (receiverId ? `与 ${receiverType === 'admin' ? '管理员' : '用户'} 会话` : '选择一个会话开始聊天')}
                  </h3>
                  <p className="text-tiny text-default-400">
                    {chatType === 'global' ? '所有管理员可见' : '仅对话双方可见'}
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
                // 如果是私信模式：
                // 1. 如果发送者是当前管理员，显示在右侧
                // 2. 如果发送者是用户，显示在左侧
                // 3. 如果发送者是其他管理员，显示在左侧
                // 全局模式下维持原样（根据是否是当前用户决定）
                const isCurrentUser = currentUser?.id === msg.senderId && msg.senderType === 'admin';
                
                const showOnRight = chatType === 'private' 
                  ? isCurrentUser 
                  : isCurrentUser;

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
                        <span>引用自 {msg.senderUsername}</span>
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
                placeholder={chatType === 'global' ? "发送全站广播..." : "发送私信..."}
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
