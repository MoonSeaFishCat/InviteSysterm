import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Input,
  Button,
  Avatar,
  Chip,
  ScrollShadow,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Select,
  SelectItem
} from "@heroui/react";
import { FaPaperPlane, FaUserShield, FaQuoteLeft, FaEllipsisV, FaReply, FaTrash, FaChevronLeft } from 'react-icons/fa';
import api from '../../api/client';
import toast from 'react-hot-toast';
import type { ChatMessage } from '../../types';

export default function PrivateChat() {
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [quoteMessage, setQuoteMessage] = useState<ChatMessage | null>(null);
  const [admins, setAdmins] = useState<any[]>([]);
  const [receiverId, setReceiverId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchAdmins = async () => {
    try {
      const res = await api.get('/user/admins');
      if (res.data.success) {
        setAdmins(res.data.data || []);
      }
    } catch (error) {
      console.error("获取管理员列表失败", error);
    }
  };

  const fetchMessages = async () => {
    try {
      const res = await api.get('/user/chat/private');
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

  useEffect(() => {
    fetchAdmins();
    fetchMessages();
    
    // 处理从交流空间跳转过来的情况
    if (location.state?.receiverId) {
      setReceiverId(location.state.receiverId);
    }

    const interval = setInterval(fetchMessages, 10000); // 10秒轮询
    return () => clearInterval(interval);
  }, [location.state]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
    try {
      const data: any = { message: newMessage };
      if (quoteMessage) data.quote_id = quoteMessage.id;
      if (receiverId) data.receiver_id = receiverId;
      
      const res = await api.post('/user/chat/private', data);
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

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-120px)] flex flex-col gap-4 py-4 px-4">
      <Card className="flex-1 shadow-lg border-none flex flex-col overflow-hidden">
        <CardHeader className="bg-primary text-white flex justify-between items-center px-6 py-4">
          <div className="flex items-center gap-4">
            <Button 
              isIconOnly 
              variant="light" 
              className="text-white hover:bg-white/20"
              onPress={() => navigate('/user/center')}
            >
              <FaChevronLeft size={20} />
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <FaUserShield size={20} />
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight">私信管理员</h3>
                <p className="text-xs text-white/70">仅你和管理员可见，有问题请在此留言</p>
              </div>
            </div>
          </div>
          <Chip size="sm" variant="flat" className="bg-white/20 text-white border-none">
            在线支持
          </Chip>
        </CardHeader>

        <div className="bg-white border-b border-divider px-6 py-3 flex items-center gap-4">
          <span className="text-sm font-medium text-default-600">发送给:</span>
          <Select
            placeholder="选择管理员 (可选)"
            size="sm"
            className="max-w-xs"
            selectedKeys={receiverId ? [receiverId.toString()] : []}
            onSelectionChange={(keys) => {
              const id = Array.from(keys)[0];
              if (id) {
                setReceiverId(Number(id));
              } else {
                setReceiverId(null);
              }
            }}
          >
            {admins.map((admin) => (
              <SelectItem key={admin.id.toString()} textValue={admin.username}>
                <div className="flex items-center gap-2">
                  <Avatar size="sm" name={admin.username} />
                  <span>{admin.username}</span>
                  <Chip size="sm" variant="flat" color={admin.role === 'super' ? 'secondary' : 'primary'}>
                    {admin.role === 'super' ? '超管' : '审核'}
                  </Chip>
                </div>
              </SelectItem>
            ))}
          </Select>
          {!receiverId && (
            <span className="text-xs text-default-400 italic">默认发送给全体管理员</span>
          )}
        </div>

        <CardBody className="p-0 flex-1 overflow-hidden bg-default-50/50">
          <ScrollShadow ref={scrollRef} className="h-full p-6 space-y-6">
            {messages.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-default-400 gap-2">
                <FaUserShield size={48} className="opacity-10" />
                <p>暂无对话记录，发个消息试试吧</p>
              </div>
            )}
            
            {messages.map((msg) => {
              // 在用户端：
              // 如果发送者类型是 'admin'，则显示在左侧（他人）
              // 如果发送者类型是 'user'，则显示在右侧（自己）
              const isMe = msg.senderType === 'user';
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className={`flex gap-3 max-w-[80%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    <Avatar
                      size="sm"
                      name={msg.senderUsername}
                      className={isMe ? 'bg-primary' : 'bg-secondary'}
                    />
                    <div className="flex flex-col gap-1">
                      <div className={`flex items-center gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        <span className="text-xs font-bold text-default-600">{msg.senderUsername}</span>
                        {msg.senderType === 'admin' && <Chip size="sm" color="secondary" variant="flat" className="h-4 text-[10px]">管理员</Chip>}
                        <span className="text-[10px] text-default-400">{new Date(msg.createdAt).toLocaleTimeString()}</span>
                      </div>

                      <div className={`relative group p-3 rounded-2xl text-sm shadow-sm ${
                        isMe 
                          ? 'bg-primary text-white rounded-tr-none' 
                          : 'bg-white text-default-800 rounded-tl-none border border-default-100'
                      }`}>
                        {msg.quoteContent && (
                          <div className={`mb-2 p-2 rounded text-xs border-l-2 flex flex-col gap-1 ${
                            isMe ? 'bg-black/10 border-white/30' : 'bg-default-100 border-default-300'
                          }`}>
                            <div className="flex items-center gap-1 opacity-70">
                              <FaQuoteLeft size={8} />
                              <span>引用自 {msg.senderUsername}</span>
                            </div>
                            <p className="italic truncate">{msg.quoteContent}</p>
                          </div>
                        )}
                        <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                        
                        <div className={`absolute ${isMe ? '-left-8' : '-right-8'} top-0 opacity-0 group-hover:opacity-100 transition-opacity`}>
                          <Dropdown>
                            <DropdownTrigger>
                              <Button isIconOnly size="sm" variant="light" className="min-w-fit h-fit p-1">
                                <FaEllipsisV size={12} className="text-default-400" />
                              </Button>
                            </DropdownTrigger>
                            <DropdownMenu aria-label="消息操作">
                              <DropdownItem 
                                key="quote" 
                                startContent={<FaReply size={12} />}
                                onPress={() => setQuoteMessage(msg)}
                              >
                                回复
                              </DropdownItem>
                              {isMe ? (
                                <DropdownItem 
                                  key="delete" 
                                  color="danger" 
                                  className="text-danger"
                                  startContent={<FaTrash size={12} />}
                                  onPress={async () => {
                                    if(confirm('确定删除此消息吗？')) {
                                      try {
                                        await api.delete(`/user/chat/private/${msg.id}`);
                                        setMessages(messages.filter(m => m.id !== msg.id));
                                        toast.success('删除成功');
                                      } catch(e) {
                                        toast.error('删除失败');
                                      }
                                    }
                                  }}
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
                </div>
              );
            })}
          </ScrollShadow>
        </CardBody>

        <CardFooter className="p-4 bg-white border-t border-divider flex flex-col gap-3">
          {quoteMessage && (
            <div className="w-full p-2 bg-default-100 rounded-lg flex items-center justify-between animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2 text-xs text-default-600 truncate">
                <FaQuoteLeft className="text-default-400" />
                <span className="font-bold">{quoteMessage.senderUsername}:</span>
                <span className="truncate">{quoteMessage.message}</span>
              </div>
              <Button size="sm" variant="light" isIconOnly onPress={() => setQuoteMessage(null)}>
                <FaPaperPlane className="rotate-45 text-default-400" />
              </Button>
            </div>
          )}
          
          <div className="flex gap-2 w-full">
            <Input
              fullWidth
              placeholder="输入你的问题..."
              value={newMessage}
              onValueChange={setNewMessage}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              variant="bordered"
              color="primary"
            />
            <Button
              color="primary"
              onPress={handleSendMessage}
              isLoading={sending}
              isIconOnly
              className="min-w-[48px]"
            >
              <FaPaperPlane />
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
