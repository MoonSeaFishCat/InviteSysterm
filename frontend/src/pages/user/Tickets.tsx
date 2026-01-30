import { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  Textarea,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Chip,
  Spinner,
  useDisclosure
} from "@heroui/react";
import { FaPlus, FaComments, FaCheckCircle, FaClock, FaPaperPlane } from 'react-icons/fa';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';

interface Ticket {
  id: number;
  subject: string;
  status: 'open' | 'closed';
  created_at: number;
  updated_at: number;
}

interface TicketMessage {
  id: number;
  sender_type: 'user' | 'admin';
  sender_id: number;
  content: string;
  created_at: number;
}

export default function Tickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);
  const [replyContent, setReplyContent] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);

  const { isOpen: isCreateOpen, onOpen: onCreateOpen, onClose: onCreateClose } = useDisclosure();
  const { isOpen: isDetailOpen, onOpen: onDetailOpen, onClose: onDetailClose } = useDisclosure();

  const [newTicket, setNewTicket] = useState({
    subject: '',
    content: ''
  });

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/user/tickets');
      if (response.data.success) {
        const ticketsData = Array.isArray(response.data.data) ? response.data.data : [];
        setTickets(ticketsData);
      }
    } catch (error) {
      console.error('获取工单失败:', error);
      toast.error('获取工单失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleCreateTicket = async () => {
    if (!newTicket.subject.trim() || !newTicket.content.trim()) {
      toast.error('请填写完整信息');
      return;
    }

    try {
      const response = await apiClient.post('/user/tickets', newTicket);
      if (response.data.success) {
        toast.success('工单提交成功');
        onCreateClose();
        setNewTicket({ subject: '', content: '' });
        fetchTickets();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || '提交失败');
    }
  };

  const handleViewDetail = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setReplyContent('');
    onDetailOpen();

    try {
      const res = await apiClient.get(`/user/tickets/${ticket.id}/messages`);
      setTicketMessages(res.data.data || []);
    } catch (error) {
      toast.error('加载详情失败');
    }
  };

  const handleReply = async () => {
    if (!replyContent.trim()) {
      toast.error('请输入回复内容');
      return;
    }

    setReplyLoading(true);
    try {
      await apiClient.post(`/user/tickets/${selectedTicket!.id}/reply`, { content: replyContent });
      toast.success('回复成功');
      setReplyContent('');
      // 刷新消息列表
      const res = await apiClient.get(`/user/tickets/${selectedTicket!.id}/messages`);
      setTicketMessages(res.data.data || []);
      // 刷新工单列表并更新当前选中的工单状态
      const ticketsRes = await apiClient.get('/user/tickets');
      if (ticketsRes.data.success) {
        const ticketsData = Array.isArray(ticketsRes.data.data) ? ticketsRes.data.data : [];
        setTickets(ticketsData);
        // 更新当前选中的工单对象
        const updatedTicket = ticketsData.find((t: Ticket) => t.id === selectedTicket!.id);
        if (updatedTicket) {
          setSelectedTicket(updatedTicket);
        }
      }
    } catch (error) {
      toast.error('回复失败');
    } finally {
      setReplyLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'open':
        return { color: 'warning' as const, label: '待处理', icon: <FaClock /> };
      case 'replied':
        return { color: 'primary' as const, label: '已回复', icon: <FaCheckCircle /> };
      case 'closed':
        return { color: 'default' as const, label: '已关闭', icon: <FaCheckCircle /> };
      default:
        return { color: 'default' as const, label: status, icon: <FaClock /> };
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex justify-between items-center">
          <h3 className="text-2xl font-bold">我的工单</h3>
          <Button
            color="primary"
            startContent={<FaPlus />}
            onPress={onCreateOpen}
          >
            新建工单
          </Button>
        </CardHeader>
        <CardBody>
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner size="lg" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-12 text-default-500">
              <FaComments className="mx-auto text-5xl mb-4 opacity-20" />
              <p>暂无工单</p>
              <p className="text-sm mt-2">遇到问题？点击右上角创建工单联系我们</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {tickets.map(ticket => {
                const statusConfig = getStatusConfig(ticket.status);
                return (
                  <Card
                    key={ticket.id}
                    isPressable
                    isHoverable
                    onPress={() => handleViewDetail(ticket)}
                    className="border border-divider hover:border-primary transition-colors"
                  >
                    <CardBody className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-lg">{ticket.subject}</h4>
                        <Chip
                          color={statusConfig.color}
                          variant="flat"
                          startContent={statusConfig.icon}
                          size="sm"
                        >
                          {statusConfig.label}
                        </Chip>
                      </div>
                      <div className="flex justify-between items-center text-sm text-default-500">
                        <span>创建时间: {new Date(ticket.created_at * 1000).toLocaleString('zh-CN')}</span>
                        <span>更新时间: {new Date(ticket.updated_at * 1000).toLocaleString('zh-CN')}</span>
                      </div>
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* 创建工单模态框 */}
      <Modal isOpen={isCreateOpen} onClose={onCreateClose} size="2xl">
        <ModalContent>
          <ModalHeader>新建工单</ModalHeader>
          <ModalBody>
            <Input
              label="标题"
              placeholder="请输入工单标题"
              value={newTicket.subject}
              onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
            />
            <Textarea
              label="内容"
              placeholder="请详细描述您遇到的问题..."
              minRows={6}
              value={newTicket.content}
              onChange={(e) => setNewTicket({ ...newTicket, content: e.target.value })}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onCreateClose}>
              取消
            </Button>
            <Button color="primary" onPress={handleCreateTicket}>
              提交
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 工单详情模态框 */}
      <Modal isOpen={isDetailOpen} onClose={onDetailClose} size="3xl" scrollBehavior="inside">
        <ModalContent>
          {selectedTicket && (
            <>
              <ModalHeader>
                <div className="flex items-center justify-between w-full pr-6">
                  <div className="flex items-center gap-2">
                    <span>{selectedTicket.subject}</span>
                    <Chip
                      color={getStatusConfig(selectedTicket.status).color}
                      size="sm"
                      variant="flat"
                    >
                      {getStatusConfig(selectedTicket.status).label}
                    </Chip>
                  </div>
                </div>
              </ModalHeader>
              <ModalBody className="p-6">
                <div className="flex flex-col gap-4 max-h-[500px] overflow-y-auto">
                  {ticketMessages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.sender_type === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[85%] p-4 rounded-2xl ${msg.sender_type === 'user' ? 'bg-primary text-white rounded-tr-none' : 'bg-default-100 text-default-900 rounded-tl-none'}`}>
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      </div>
                      <span className="text-xs text-default-400 mt-1 px-2">
                        {msg.sender_type === 'user' ? '我' : '管理员'} · {new Date(msg.created_at * 1000).toLocaleString('zh-CN')}
                      </span>
                    </div>
                  ))}
                  {ticketMessages.length === 0 && (
                    <div className="text-center py-8 text-default-400">
                      <FaClock className="mx-auto text-4xl mb-2 opacity-20" />
                      <p>暂无消息</p>
                    </div>
                  )}
                </div>
              </ModalBody>
              <ModalFooter className="border-t border-divider flex-col gap-2 p-4">
                {selectedTicket.status !== 'closed' ? (
                  <div className="flex gap-2 w-full">
                    <Input
                      placeholder="输入回复内容..."
                      value={replyContent}
                      onValueChange={setReplyContent}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleReply()}
                      className="flex-1"
                    />
                    <Button color="primary" isIconOnly isLoading={replyLoading} onPress={handleReply}>
                      <FaPaperPlane size={14} />
                    </Button>
                  </div>
                ) : (
                  <div className="w-full text-center py-2 text-default-400 text-sm">
                    该工单已关闭，无法继续回复
                  </div>
                )}
                <Button variant="light" onPress={onDetailClose} className="w-full">
                  关闭
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
