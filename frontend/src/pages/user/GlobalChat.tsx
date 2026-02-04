import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  DropdownItem
} from "@heroui/react";
import { FaPaperPlane, FaBullhorn, FaQuoteLeft, FaEllipsisV, FaReply, FaTrash, FaChevronLeft, FaUserShield, FaUserEdit } from 'react-icons/fa';
import api from '../../api/client';
import toast from 'react-hot-toast';
import type { ChatMessage } from '../../types';

export default function GlobalChat() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [quoteMessage, setQuoteMessage] = useState<ChatMessage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    try {
      const res = await api.get('/user/chat/global');
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
    fetchMessages();
    const interval = setInterval(fetchMessages, 10000); // 10秒轮询
    return () => clearInterval(interval);
  }, []);

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
      
      const res = await api.post('/user/chat/global', data);
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
    if(!confirm('确定删除此消息吗？')) return;
    try {
      // 假设全局消息删除接口也是同一个，或者后端需要处理
      // 实际上目前后端可能没有提供用户删除自己全局消息的接口，
      // 这里先预留，如果报错则提示权限不足
      await api.delete(`/admin/chat/global/${id}`); // 这通常需要管理员权限
      setMessages(messages.filter(m => m.id !== id));
      toast.success('删除成功');
    } catch(e) {
      toast.error('权限不足');
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
                <FaBullhorn size={20} />
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight">全局聊天室</h3>
                <p className="text-xs text-white/70">全站所有人可见，请文明交流</p>
              </div>
            </div>
          </div>
          <Chip size="sm" variant="flat" className="bg-white/20 text-white border-none">
            全员公开
          </Chip>
        </CardHeader>

        <CardBody className="p-0 flex-1 overflow-hidden bg-default-50/50">
          <ScrollShadow ref={scrollRef} className="h-full p-6 space-y-6">
            {messages.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-default-400 gap-2">
                <FaBullhorn size={48} className="opacity-10" />
                <p>暂无消息，来抢个沙发吧</p>
              </div>
            )}
            
            {messages.map((msg) => {
              // 这里假设用户信息在 localStorage
              const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
              const isMe = msg.senderType === 'user' && msg.senderId === userInfo.id;
              const isAdmin = msg.senderType === 'admin';

              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className={`flex gap-3 max-w-[80%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className="cursor-pointer hover:opacity-80 transition-opacity">
                      <Avatar
                        size="sm"
                        name={msg.senderUsername}
                        icon={isAdmin ? <FaUserShield /> : <FaUserEdit />}
                        className={isMe ? 'bg-primary' : isAdmin ? 'bg-secondary' : 'bg-default-300'}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className={`flex items-center gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        <span className="text-xs font-bold text-default-600">{msg.senderUsername}</span>
                        {isAdmin && (
                          <Chip size="sm" color="secondary" variant="flat" className="h-4 text-[10px]">
                            {msg.senderRole === 'super' ? '超级管理员' : '审核员'}
                          </Chip>
                        )}
                        <span className="text-[10px] text-default-400">{new Date(msg.createdAt).toLocaleTimeString()}</span>
                      </div>

                      <div className={`relative group p-3 rounded-2xl text-sm shadow-sm ${
                        isMe 
                          ? 'bg-primary text-white rounded-tr-none' 
                          : isAdmin
                            ? 'bg-secondary/10 text-default-800 rounded-tl-none border border-secondary/20'
                            : 'bg-white text-default-800 rounded-tl-none border border-default-100'
                      }`}>
                        {msg.quoteContent && (
                          <div className={`mb-2 p-2 rounded text-xs border-l-2 flex flex-col gap-1 ${
                            isMe ? 'bg-black/10 border-white/30' : 'bg-default-100 border-default-300'
                          }`}>
                            <div className="flex items-center gap-1 opacity-70">
                              <FaQuoteLeft size={8} />
                              <span>引用内容</span>
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
                <FaChevronLeft className="rotate-90 text-default-400" />
              </Button>
            </div>
          )}
          
          <div className="flex gap-2 w-full">
            <Input
              fullWidth
              placeholder="在这里畅所欲言..."
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
