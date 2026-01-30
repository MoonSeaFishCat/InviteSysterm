import { useState, useEffect, useMemo } from 'react';
import { Card, CardBody, CardHeader, Tabs, Tab, Button, Chip, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Input, Textarea, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Select, SelectItem } from "@heroui/react";
import api from '../api/client';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { FaUserCircle, FaTicketAlt, FaEnvelope, FaPaperPlane, FaPlus, FaClock, FaCheckCircle, FaTimesCircle, FaSearch, FaCheckDouble } from 'react-icons/fa';

export default function UserCenter() {
  const [userInfo, setUserInfo] = useState<any>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const { isOpen: isTicketOpen, onOpenChange: onTicketOpenChange } = useDisclosure();
  const { isOpen: isMsgOpen, onOpen: onMsgOpen, onOpenChange: onMsgOpenChange } = useDisclosure();
  
  // 申请表单状态
  const [reason, setReason] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  // 工单表单状态
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketContent, setTicketContent] = useState('');
  const [ticketLoading, setTicketLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [ticketMessages, setTicketMessages] = useState<any[]>([]);
  const [replyContent, setReplyContent] = useState('');
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState('all');

  // 站内信状态
  const [selectedMsg, setSelectedMsg] = useState<any>(null);
  const [msgLoading, setMsgLoading] = useState(false);

  // 申请列表状态
  const [appStatusFilter, setAppStatusFilter] = useState('all');

  // 个人信息编辑状态
  const [newNickname, setNewNickname] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [updateLoading, setUpdateLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('user_token');
    if (!token) {
      navigate('/login');
      return;
    }
    fetchData();
  }, [navigate]);

  useEffect(() => {
    if (userInfo) {
      setNewNickname(userInfo.nickname || '');
    }
  }, [userInfo]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [profileRes, appsRes, ticketsRes, messagesRes] = await Promise.all([
        api.get('/user/profile'),
        api.get('/user/applications'),
        api.get('/user/tickets'),
        api.get('/user/messages')
      ]);
      
      setUserInfo(profileRes.data.data);
      setApplications(appsRes.data.data || []);
      setTickets(ticketsRes.data.data || []);
      setMessages(messagesRes.data.data || []);
    } catch (error: any) {
      if (error.response?.status === 401) {
        localStorage.removeItem('user_token');
        navigate('/login');
      }
      toast.error("加载数据失败");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitApplication = async () => {
    if (!reason.trim()) {
      toast.error("请填写申请理由");
      return;
    }
    
    if (reason.length < 50) {
      toast.error("申请理由不能少于 50 个字，请认真填写");
      return;
    }

    setSubmitLoading(true);
    try {
      const { StarMoonSecurity } = await import('../utils/security');
      const { getDeviceId } = await import('../utils/device');
      
      const nonce = Math.floor(Math.random() * 1000000);
      const fingerprint = getDeviceId();
      const payload = { email: userInfo.email, reason }; 
      
      const encrypted = await StarMoonSecurity.encryptData(payload, fingerprint, nonce);
      const res = await api.post('/user/application/submit', { 
        encrypted,
        fingerprint,
        nonce
      });
      
      if (res.data.success) {
        toast.success("申请提交成功");
        setReason('');
        onOpenChange();
        fetchData();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "提交失败");
    } finally {
      setSubmitLoading(false);
    }
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'pending': return <Chip startContent={<FaClock />} color="warning" variant="flat">审核中</Chip>;
      case 'approved': return <Chip startContent={<FaCheckCircle />} color="success" variant="flat">已通过</Chip>;
      case 'rejected': return <Chip startContent={<FaTimesCircle />} color="danger" variant="flat">已拒绝</Chip>;
      case 'open': return <Chip color="primary" variant="flat">处理中</Chip>;
      case 'replied': return <Chip color="success" variant="flat">已回复</Chip>;
      case 'closed': return <Chip color="default" variant="flat">已关闭</Chip>;
      default: return <Chip variant="flat">{status}</Chip>;
    }
  };

  const handleCreateTicket = async () => {
    if (!ticketSubject.trim() || !ticketContent.trim()) {
      toast.error("请填写工单主题和内容");
      return;
    }
    setTicketLoading(true);
    try {
      await api.post('/user/tickets', { subject: ticketSubject, content: ticketContent });
      toast.success("工单已提交");
      setTicketSubject('');
      setTicketContent('');
      onTicketOpenChange();
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "提交失败");
    } finally {
      setTicketLoading(false);
    }
  };

  const handleViewTicket = async (ticket: any) => {
    setSelectedTicket(ticket);
    try {
      const res = await api.get(`/user/tickets/${ticket.id}/messages`);
      setTicketMessages(res.data.data);
    } catch (error) {
      toast.error("加载详情失败");
    }
  };

  const handleReplyTicket = async () => {
    if (!replyContent.trim()) return;
    try {
      await api.post(`/user/tickets/${selectedTicket.id}/reply`, { content: replyContent });
      setReplyContent('');
      const res = await api.get(`/user/tickets/${selectedTicket.id}/messages`);
      setTicketMessages(res.data.data);
      fetchData();
    } catch (error) {
      toast.error("回复失败");
    }
  };

  const handleViewMsg = async (msg: any) => {
    setSelectedMsg(msg);
    onMsgOpen();
    if (!msg.is_read) {
      try {
        await api.post(`/user/messages/${msg.id}/read`);
        fetchData();
      } catch (error) {
        console.error("标记已读失败", error);
      }
    }
  };

  const handleReadAllMsgs = async () => {
    setMsgLoading(true);
    try {
      await api.post('/user/messages/read-all');
      toast.success("全部标记为已读");
      fetchData();
    } catch (error) {
      toast.error("操作失败");
    } finally {
      setMsgLoading(false);
    }
  };

  const filteredApplications = useMemo(() => {
    if (appStatusFilter === 'all') return applications;
    return applications.filter(app => app.status === appStatusFilter);
  }, [applications, appStatusFilter]);

  const filteredTickets = useMemo(() => {
    return tickets.filter(ticket => {
      const matchesSearch = ticket.subject.toLowerCase().includes(ticketSearch.toLowerCase());
      const matchesStatus = ticketStatusFilter === 'all' || ticket.status === ticketStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [tickets, ticketSearch, ticketStatusFilter]);

  const handleUpdateProfile = async () => {
    if (!newNickname.trim() && !newPassword.trim()) {
      toast.error("请输入要修改的内容");
      return;
    }
    
    setUpdateLoading(true);
    try {
      await api.post('/user/profile', { 
        nickname: newNickname.trim() || undefined,
        password: newPassword.trim() || undefined
      });
      toast.success("资料更新成功");
      setNewPassword('');
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "更新失败");
    } finally {
      setUpdateLoading(false);
    }
  };

  if (loading && !userInfo) {
    return <div className="flex justify-center items-center h-[60vh]">加载中...</div>;
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-6xl">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* 左侧用户信息 */}
        <div className="md:col-span-1">
          <Card className="shadow-sm border border-divider">
            <CardBody className="flex flex-col items-center py-8 gap-4">
              <div className="p-1 rounded-full border-2 border-primary">
                <FaUserCircle size={80} className="text-default-400" />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold">{userInfo?.nickname}</h2>
                <p className="text-sm text-default-500">{userInfo?.email}</p>
              </div>
              <Chip color={userInfo?.status === 'active' ? 'success' : 'danger'} variant="dot">
                {userInfo?.status === 'active' ? '账号正常' : '账号禁用'}
              </Chip>
              <div className="w-full border-t border-divider my-2"></div>
              <div className="w-full px-4 flex flex-col gap-2">
                <div className="flex justify-between text-sm">
                  <span className="text-default-500">注册时间</span>
                  <span>{new Date(userInfo?.created_at * 1000).toLocaleDateString()}</span>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* 右侧主内容区 */}
        <div className="md:col-span-3">
          <Tabs 
            aria-label="User Center Tabs" 
            color="primary" 
            variant="underlined"
            classNames={{
              tabList: "gap-6 w-full relative rounded-none p-0 border-b border-divider",
              cursor: "w-full bg-primary",
              tab: "max-w-fit px-0 h-12",
              tabContent: "group-data-[selected=true]:text-primary font-bold"
            }}
          >
            <Tab
              key="profile"
              title={
                <div className="flex items-center space-x-2">
                  <FaUserCircle />
                  <span>个人资料</span>
                </div>
              }
            >
              <Card className="mt-4 shadow-sm border border-divider">
                <CardHeader className="px-6 py-4 border-b border-divider">
                  <h3 className="text-lg font-bold">资料设置</h3>
                </CardHeader>
                <CardBody className="p-8 max-w-lg">
                  <div className="flex flex-col gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-default-600">电子邮箱</label>
                      <Input value={userInfo?.email} isDisabled variant="bordered" />
                      <p className="text-tiny text-default-400">邮箱暂不支持修改</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-default-600">用户昵称</label>
                      <Input 
                        placeholder="输入新昵称" 
                        variant="bordered"
                        value={newNickname}
                        onValueChange={setNewNickname}
                        autoComplete="nickname"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-default-600">修改密码</label>
                      <Input 
                        type="password" 
                        placeholder="不修改请留空" 
                        variant="bordered"
                        value={newPassword}
                        onValueChange={setNewPassword}
                        autoComplete="new-password"
                      />
                      <p className="text-tiny text-default-400">密码长度不少于 6 位</p>
                    </div>
                    <Button 
                      color="primary" 
                      className="font-bold mt-4" 
                      onPress={handleUpdateProfile}
                      isLoading={updateLoading}
                    >
                      保存修改
                    </Button>
                  </div>
                </CardBody>
              </Card>
            </Tab>

            <Tab
              key="applications"
              title={
                <div className="flex items-center space-x-2">
                  <FaPaperPlane />
                  <span>我的申请</span>
                </div>
              }
            >
              <Card className="mt-4 shadow-sm border border-divider">
                <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-6 py-4 gap-4">
                  <div>
                    <h3 className="text-lg font-bold">申请记录</h3>
                    <p className="text-tiny text-default-400">共 {applications.length} 条申请</p>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Select 
                      size="sm" 
                      className="w-32" 
                      selectedKeys={[appStatusFilter]}
                      onSelectionChange={(keys) => setAppStatusFilter(Array.from(keys)[0] as string)}
                      aria-label="Filter status"
                    >
                      <SelectItem key="all">全部状态</SelectItem>
                      <SelectItem key="pending">审核中</SelectItem>
                      <SelectItem key="approved">已通过</SelectItem>
                      <SelectItem key="rejected">已拒绝</SelectItem>
                    </Select>
                    <Button 
                      color="primary" 
                      size="sm" 
                      startContent={<FaPlus />}
                      onPress={onOpen}
                      isDisabled={applications.some(app => app.status === 'pending')}
                    >
                      提交新申请
                    </Button>
                  </div>
                </CardHeader>
                <CardBody className="px-0">
                  <Table aria-label="Applications table" removeWrapper>
                    <TableHeader>
                      <TableColumn>申请时间</TableColumn>
                      <TableColumn>申请理由</TableColumn>
                      <TableColumn>状态</TableColumn>
                      <TableColumn>邀请码 / 处理结果</TableColumn>
                    </TableHeader>
                    <TableBody emptyContent="暂无申请记录">
                      {filteredApplications.map((app) => (
                        <TableRow key={app.id}>
                          <TableCell>{new Date(app.created_at * 1000).toLocaleString()}</TableCell>
                          <TableCell className="max-w-xs truncate">{app.reason}</TableCell>
                          <TableCell>{getStatusChip(app.status)}</TableCell>
                          <TableCell>
                            {app.status === 'approved' && app.invitation_code ? (
                              <div className="flex flex-col gap-1">
                                <code className="bg-success-100 text-success-700 px-2 py-1 rounded font-mono text-sm w-fit">
                                  {app.invitation_code}
                                </code>
                                {app.review_opinion && <span className="text-tiny text-default-400">{app.review_opinion}</span>}
                              </div>
                            ) : (
                              app.review_opinion || '-'
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardBody>
              </Card>
            </Tab>

            <Tab
              key="tickets"
              title={
                <div className="flex items-center space-x-2">
                  <FaTicketAlt />
                  <span>工单系统</span>
                </div>
              }
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                <div className="md:col-span-1">
                  <Card className="shadow-sm border border-divider">
                    <CardHeader className="flex flex-col gap-3 px-6 py-4">
                      <div className="flex justify-between items-center w-full">
                        <h3 className="font-bold">我的工单</h3>
                        <Button size="sm" color="primary" isIconOnly radius="full" onPress={onTicketOpenChange}><FaPlus size={12} /></Button>
                      </div>
                      <div className="flex flex-col gap-2 w-full">
                        <Input 
                          size="sm"
                          placeholder="搜索工单..."
                          startContent={<FaSearch className="text-default-400" />}
                          value={ticketSearch}
                          onValueChange={setTicketSearch}
                        />
                        <Select 
                          size="sm" 
                          selectedKeys={[ticketStatusFilter]}
                          onSelectionChange={(keys) => setTicketStatusFilter(Array.from(keys)[0] as string)}
                          aria-label="Filter status"
                        >
                          <SelectItem key="all">全部状态</SelectItem>
                          <SelectItem key="open">处理中</SelectItem>
                          <SelectItem key="replied">已回复</SelectItem>
                          <SelectItem key="closed">已关闭</SelectItem>
                        </Select>
                      </div>
                    </CardHeader>
                    <CardBody className="p-0">
                      <div className="flex flex-col max-h-[500px] overflow-y-auto">
                        {filteredTickets.length === 0 ? (
                          <div className="py-8 text-center text-default-400 text-sm">暂无匹配工单</div>
                        ) : (
                          filteredTickets.map((ticket) => (
                            <div 
                              key={ticket.id}
                              className={`p-4 border-b border-divider cursor-pointer transition-colors hover:bg-default-50 ${selectedTicket?.id === ticket.id ? 'bg-primary/5 border-l-4 border-l-primary' : ''}`}
                              onClick={() => handleViewTicket(ticket)}
                            >
                              <div className="flex justify-between items-start mb-1">
                                <span className="font-bold text-sm truncate max-w-[120px]">{ticket.subject}</span>
                                {getStatusChip(ticket.status)}
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
                    <Card className="shadow-sm border border-divider h-full min-h-[400px]">
                      <CardHeader className="border-b border-divider px-6 py-4 flex justify-between items-center">
                        <h3 className="font-bold">{selectedTicket.subject}</h3>
                        {getStatusChip(selectedTicket.status)}
                      </CardHeader>
                      <CardBody className="flex flex-col gap-4 p-6 overflow-y-auto max-h-[400px]">
                        {ticketMessages.map((msg) => (
                          <div key={msg.id} className={`flex flex-col ${msg.sender_type === 'user' ? 'items-end' : 'items-start'}`}>
                            <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.sender_type === 'user' ? 'bg-primary text-white rounded-tr-none' : 'bg-default-100 rounded-tl-none'}`}>
                              {msg.content}
                            </div>
                            <span className="text-tiny text-default-400 mt-1">
                              {msg.sender_type === 'admin' ? '客服' : '我'} · {new Date(msg.created_at * 1000).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </CardBody>
                      <div className="p-4 border-t border-divider flex gap-2">
                        <Input 
                          placeholder={selectedTicket.status === 'closed' ? "该工单已关闭" : "输入回复内容..."}
                          value={replyContent} 
                          onValueChange={setReplyContent}
                          onKeyDown={(e) => e.key === 'Enter' && handleReplyTicket()}
                          isDisabled={selectedTicket.status === 'closed'}
                        />
                        <Button 
                          color="primary" 
                          isIconOnly 
                          onPress={handleReplyTicket}
                          isDisabled={selectedTicket.status === 'closed'}
                        >
                          <FaPaperPlane size={14} />
                        </Button>
                      </div>
                    </Card>
                  ) : (
                    <Card className="shadow-sm border border-divider h-full flex items-center justify-center p-12 text-default-400">
                      <div className="text-center">
                        <FaTicketAlt size={48} className="mx-auto mb-4 opacity-20" />
                        <p>选择一个工单查看详情</p>
                      </div>
                    </Card>
                  )}
                </div>
              </div>
            </Tab>

            <Tab
              key="messages"
              title={
                <div className="flex items-center space-x-2">
                  <FaEnvelope />
                  <span>站内通知</span>
                  {messages.some(m => !m.is_read) && (
                    <div className="w-2 h-2 bg-danger rounded-full animate-pulse"></div>
                  )}
                </div>
              }
            >
              <Card className="mt-4 shadow-sm border border-divider">
                <CardHeader className="flex justify-between items-center px-6 py-4 border-b border-divider">
                  <h3 className="font-bold">消息中心</h3>
                  <Button 
                    size="sm" 
                    variant="flat" 
                    color="primary" 
                    startContent={<FaCheckDouble />}
                    onPress={handleReadAllMsgs}
                    isLoading={msgLoading}
                    isDisabled={!messages.some(m => !m.is_read)}
                  >
                    全部已读
                  </Button>
                </CardHeader>
                <CardBody className="p-0">
                  <div className="flex flex-col divide-y divide-divider">
                    {messages.length === 0 ? (
                      <div className="py-20 text-center text-default-400">
                        <FaEnvelope size={48} className="mx-auto mb-4 opacity-10" />
                        <p>暂无新通知</p>
                      </div>
                    ) : (
                      messages.map((msg) => (
                        <div 
                          key={msg.id} 
                          className={`p-6 cursor-pointer transition-colors hover:bg-default-50 flex justify-between items-center ${!msg.is_read ? 'bg-primary/5' : ''}`}
                          onClick={() => handleViewMsg(msg)}
                        >
                          <div className="flex gap-4 items-center">
                            <div className={`p-2 rounded-full ${!msg.is_read ? 'bg-primary/20 text-primary' : 'bg-default-100 text-default-400'}`}>
                              <FaEnvelope size={16} />
                            </div>
                            <div>
                              <h4 className={`text-sm ${!msg.is_read ? 'font-bold' : ''}`}>{msg.title}</h4>
                              <p className="text-tiny text-default-400 mt-1">{new Date(msg.created_at * 1000).toLocaleString()}</p>
                            </div>
                          </div>
                          {!msg.is_read && <Chip size="sm" color="primary" variant="flat">未读</Chip>}
                        </div>
                      ))
                    )}
                  </div>
                </CardBody>
              </Card>
            </Tab>
          </Tabs>
        </div>
      </div>

      {/* 提交申请 Modal */}
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} backdrop="blur">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">提交邀请码申请</ModalHeader>
              <ModalBody>
                <div className="flex flex-col gap-4">
                  <Input
                    label="联系邮箱"
                    value={userInfo?.email}
                    isDisabled
                    variant="bordered"
                  />
                  <Textarea
                    label="申请理由"
                    placeholder="请详细说明您申请邀请码的原因..."
                    value={reason}
                    onValueChange={setReason}
                    variant="bordered"
                    minRows={4}
                  />
                  <p className="text-tiny text-default-400">
                    提示：请确保理由充分，审核员将根据理由决定是否发放邀请码。
                  </p>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  取消
                </Button>
                <Button color="primary" onPress={handleSubmitApplication} isLoading={submitLoading}>
                  提交申请
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* 提交工单 Modal */}
      <Modal isOpen={isTicketOpen} onOpenChange={onTicketOpenChange} backdrop="blur">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">发起新工单</ModalHeader>
              <ModalBody>
                <div className="flex flex-col gap-4">
                  <Input
                    label="工单主题"
                    placeholder="请输入工单主题"
                    value={ticketSubject}
                    onValueChange={setTicketSubject}
                    variant="bordered"
                  />
                  <Textarea
                    label="详细内容"
                    placeholder="请详细描述您的问题..."
                    value={ticketContent}
                    onValueChange={setTicketContent}
                    variant="bordered"
                    minRows={4}
                  />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  取消
                </Button>
                <Button color="primary" onPress={handleCreateTicket} isLoading={ticketLoading}>
                  提交工单
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* 站内信内容 Modal */}
      <Modal isOpen={isMsgOpen} onOpenChange={onMsgOpenChange} backdrop="blur">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">{selectedMsg?.title}</ModalHeader>
              <ModalBody>
                <div className="py-2 text-sm whitespace-pre-wrap">
                  {selectedMsg?.content}
                </div>
                <div className="text-tiny text-default-400 mt-4">
                  发送时间：{selectedMsg && new Date(selectedMsg.created_at * 1000).toLocaleString()}
                </div>
              </ModalBody>
              <ModalFooter>
                <Button color="primary" onPress={onClose}>
                  确定
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
