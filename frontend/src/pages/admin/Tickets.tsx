import { useState, useEffect, useMemo } from 'react';
import { Card, CardBody, CardHeader, Button, Chip, Input, Select, SelectItem } from "@heroui/react";
import api from '../../api/client';
import toast from 'react-hot-toast';
import { FaTicketAlt, FaPaperPlane, FaBan, FaSearch, FaTrash, FaRedo } from 'react-icons/fa';

export default function Tickets() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [ticketMessages, setTicketMessages] = useState<any[]>([]);
  const [replyContent, setReplyContent] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  
  // 搜索和筛选状态
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/tickets');
      setTickets(res.data.data || []);
    } catch (error) {
      toast.error("获取工单列表失败");
    } finally {
      setLoading(false);
    }
  };

  // 过滤逻辑
  const filteredTickets = useMemo(() => {
    return tickets.filter(ticket => {
      const matchesSearch = 
        ticket.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ticket.nickname && ticket.nickname.toLowerCase().includes(searchQuery.toLowerCase())) ||
        ticket.subject.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [tickets, searchQuery, statusFilter]);

  const handleViewTicket = async (ticket: any) => {
    setSelectedTicket(ticket);
    try {
      const res = await api.get(`/admin/tickets/${ticket.id}/messages`);
      setTicketMessages(res.data.data || []);
    } catch (error) {
      toast.error("加载详情失败");
    }
  };

  const handleReply = async () => {
    if (!replyContent.trim()) return;
    setReplyLoading(true);
    try {
      await api.post(`/admin/tickets/${selectedTicket.id}/reply`, { content: replyContent });
      toast.success("回复成功");
      setReplyContent('');
      // 刷新消息列表
      const res = await api.get(`/admin/tickets/${selectedTicket.id}/messages`);
      setTicketMessages(res.data.data || []);
      fetchTickets();
    } catch (error) {
      toast.error("回复失败");
    } finally {
      setReplyLoading(false);
    }
  };

  const handleCloseTicket = async () => {
    try {
      await api.post(`/admin/tickets/${selectedTicket.id}/close`);
      toast.success("工单已关闭");
      fetchTickets();
      setSelectedTicket({ ...selectedTicket, status: 'closed' });
    } catch (error) {
      toast.error("操作失败");
    }
  };

  const handleReopenTicket = async () => {
    try {
      await api.post(`/admin/tickets/${selectedTicket.id}/reopen`);
      toast.success("工单已重新打开");
      fetchTickets();
      setSelectedTicket({ ...selectedTicket, status: 'open' });
    } catch (error) {
      toast.error("操作失败");
    }
  };

  const handleDeleteTicket = async () => {
    if (!confirm('确定要删除这个工单吗？删除后无法恢复！')) {
      return;
    }
    try {
      await api.delete(`/admin/tickets/${selectedTicket.id}`);
      toast.success("工单已删除");
      setSelectedTicket(null);
      setTicketMessages([]);
      fetchTickets();
    } catch (error) {
      toast.error("删除失败");
    }
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'open': return <Chip color="primary" variant="flat" size="sm">待处理</Chip>;
      case 'replied': return <Chip color="success" variant="flat" size="sm">已回复</Chip>;
      case 'closed': return <Chip color="default" variant="flat" size="sm">已关闭</Chip>;
      default: return <Chip variant="flat" size="sm">{status}</Chip>;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 搜索和筛选栏 */}
      <Card className="shadow-sm border border-divider">
        <CardBody className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-grow">
              <Input
                label="搜索工单"
                placeholder="搜索邮箱、昵称、主题..."
                startContent={<FaSearch className="text-default-400" />}
                value={searchQuery}
                onValueChange={setSearchQuery}
                variant="bordered"
                size="sm"
              />
            </div>
            <div className="w-full md:w-48">
              <Select
                label="状态筛选"
                size="sm"
                variant="bordered"
                selectedKeys={[statusFilter]}
                onSelectionChange={(keys) => setStatusFilter(Array.from(keys)[0] as string)}
              >
                <SelectItem key="all" textValue="全部状态">全部状态</SelectItem>
                <SelectItem key="open" textValue="待处理">待处理</SelectItem>
                <SelectItem key="replied" textValue="已回复">已回复</SelectItem>
                <SelectItem key="closed" textValue="已关闭">已关闭</SelectItem>
              </Select>
            </div>
            <Button 
              color="primary" 
              variant="flat" 
              size="lg"
              className="h-[48px]"
              onPress={fetchTickets}
            >
              刷新
            </Button>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Card className="shadow-sm border border-divider">
            <CardHeader className="px-6 py-4 border-b border-divider">
              <h3 className="font-bold flex items-center gap-2">
                <FaTicketAlt className="text-primary" /> 工单列表 ({filteredTickets.length})
              </h3>
            </CardHeader>
            <CardBody className="p-0">
              <div className="flex flex-col max-h-[600px] overflow-y-auto divide-y divide-divider">
                {loading ? (
                  <div className="p-8 text-center text-default-400">加载中...</div>
                ) : filteredTickets.length === 0 ? (
                  <div className="p-8 text-center text-default-400">暂无工单</div>
                ) : (
                  filteredTickets.map((ticket) => (
                    <div 
                      key={ticket.id}
                      className={`p-4 cursor-pointer transition-colors hover:bg-default-50 ${selectedTicket?.id === ticket.id ? 'bg-primary/5 border-l-4 border-l-primary' : ''}`}
                      onClick={() => handleViewTicket(ticket)}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-sm truncate max-w-[150px]">{ticket.subject}</span>
                        {getStatusChip(ticket.status)}
                      </div>
                      <div className="text-tiny text-default-600 mb-1">
                        {ticket.nickname ? `${ticket.nickname} (${ticket.email})` : ticket.email}
                      </div>
                      <div className="text-tiny text-default-400">
                        {new Date(ticket.updated_at * 1000).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="md:col-span-2">
          {selectedTicket ? (
            <Card className="shadow-sm border border-divider h-full min-h-[500px] flex flex-col">
              <CardHeader className="border-b border-divider px-6 py-4 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg">{selectedTicket.subject}</h3>
                  <p className="text-tiny text-default-400">
                    来自：{selectedTicket.nickname ? `${selectedTicket.nickname} (${selectedTicket.email})` : selectedTicket.email}
                  </p>
                </div>
                <div className="flex gap-2">
                  {selectedTicket.status === 'closed' ? (
                    <Button size="sm" color="success" variant="flat" startContent={<FaRedo />} onPress={handleReopenTicket}>
                      重新打开
                    </Button>
                  ) : (
                    <Button size="sm" color="warning" variant="flat" startContent={<FaBan />} onPress={handleCloseTicket}>
                      关闭工单
                    </Button>
                  )}
                  <Button size="sm" color="danger" variant="flat" startContent={<FaTrash />} onPress={handleDeleteTicket}>
                    删除
                  </Button>
                </div>
              </CardHeader>
            <CardBody className="flex-grow p-6 overflow-y-auto max-h-[450px] flex flex-col gap-4">
              {ticketMessages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.sender_type === 'admin' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.sender_type === 'admin' ? 'bg-primary text-white rounded-tr-none' : 'bg-default-100 rounded-tl-none'}`}>
                    {msg.content}
                  </div>
                  <span className="text-tiny text-default-400 mt-1">
                    {msg.sender_type === 'admin' ? '我 (管理员)' : '用户'} · {new Date(msg.created_at * 1000).toLocaleString()}
                  </span>
                </div>
              ))}
            </CardBody>
            <div className="p-4 border-t border-divider flex gap-2">
              <Input 
                placeholder={selectedTicket.status === 'closed' ? "该工单已关闭" : "输入回复内容..."}
                isDisabled={selectedTicket.status === 'closed'}
                value={replyContent} 
                onValueChange={setReplyContent}
                onKeyDown={(e) => e.key === 'Enter' && handleReply()}
              />
              <Button 
                color="primary" 
                isIconOnly 
                isDisabled={selectedTicket.status === 'closed'}
                isLoading={replyLoading}
                onPress={handleReply}
              >
                <FaPaperPlane size={14} />
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="shadow-sm border border-divider h-full flex items-center justify-center p-20 text-default-400">
            <div className="text-center">
              <FaTicketAlt size={64} className="mx-auto mb-4 opacity-10" />
              <p className="text-lg">请从左侧选择一个工单进行处理</p>
            </div>
          </Card>
        )}
        </div>
      </div>
    </div>
  );
}
