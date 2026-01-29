import { useState, useEffect, useMemo } from 'react';
import {
  Button,
  Input,
  Textarea,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Tooltip,
  Tabs,
  Tab
} from "@heroui/react";
import { FaEnvelope, FaPaperPlane, FaSearch, FaUser, FaHistory, FaCheckCircle, FaClock } from 'react-icons/fa';
import api from '../../api/client';
import toast from 'react-hot-toast';

export default function Messages() {
  const [users, setUsers] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [selectedUserKeys, setSelectedUserKeys] = useState<any>(new Set());
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isBatch, setIsBatch] = useState(false);
  const [sendToAll, setSendToAll] = useState(false);
  const [msgTitle, setMsgTitle] = useState('');
  const [msgContent, setMsgContent] = useState('');
  const [sendLoading, setSendLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchHistory();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data.data || []);
    } catch (error) {
      toast.error("获取用户列表失败");
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get('/admin/messages/history');
      setHistory(res.data.data || []);
    } catch (error) {
      console.error("Failed to fetch history", error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(user => 
      user.email.toLowerCase().includes(search.toLowerCase()) || 
      (user.nickname && user.nickname.toLowerCase().includes(search.toLowerCase()))
    );
  }, [users, search]);

  const filteredHistory = useMemo(() => {
    return history.filter(msg => 
      msg.email.toLowerCase().includes(historySearch.toLowerCase()) || 
      (msg.nickname && msg.nickname.toLowerCase().includes(historySearch.toLowerCase())) ||
      msg.title.toLowerCase().includes(historySearch.toLowerCase()) ||
      msg.content.toLowerCase().includes(historySearch.toLowerCase())
    );
  }, [history, historySearch]);

  const handleOpenSend = (user: any) => {
    setSelectedUser(user);
    setIsBatch(false);
    setSendToAll(false);
    setMsgTitle('');
    setMsgContent('');
    onOpen();
  };

  const handleOpenBatchSend = () => {
    if (selectedUserKeys === "all") {
      setSendToAll(true);
      setIsBatch(true);
    } else if (selectedUserKeys.size > 0) {
      setSendToAll(false);
      setIsBatch(true);
    } else {
      toast.error("请选择用户");
      return;
    }
    setSelectedUser(null);
    setMsgTitle('');
    setMsgContent('');
    onOpen();
  };

  const handleOpenSendToAll = () => {
    setSendToAll(true);
    setIsBatch(true);
    setSelectedUser(null);
    setMsgTitle('');
    setMsgContent('');
    onOpen();
  };

  const handleSendMessage = async () => {
    if (!msgTitle.trim() || !msgContent.trim()) {
      toast.error("请填写完整标题和内容");
      return;
    }

    setSendLoading(true);
    try {
      if (isBatch) {
        await api.post('/admin/messages/batch-send', {
          user_ids: sendToAll ? [] : Array.from(selectedUserKeys).map(id => Number(id)),
          send_to_all: sendToAll,
          title: msgTitle,
          content: msgContent
        });
      } else {
        await api.post('/admin/messages/send', {
          user_id: selectedUser.id,
          title: msgTitle,
          content: msgContent
        });
      }
      toast.success("发送成功");
      onOpenChange();
      fetchHistory();
      setSelectedUserKeys(new Set());
    } catch (error: any) {
      toast.error(error.response?.data?.message || "发送失败");
    } finally {
      setSendLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <FaEnvelope className="text-primary" />
        消息中心
      </h2>

      <Tabs 
        aria-label="Message Center Options" 
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
          key="send"
          title={
            <div className="flex items-center space-x-2">
              <FaPaperPlane />
              <span>发送消息</span>
            </div>
          }
        >
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col md:flex-row justify-between items-end gap-4">
              <div className="flex gap-2">
                <Button 
                  color="primary" 
                  variant="flat"
                  startContent={<FaPaperPlane />}
                  onPress={handleOpenBatchSend}
                  isDisabled={selectedUserKeys !== "all" && selectedUserKeys.size === 0}
                >
                  批量发送 ({selectedUserKeys === "all" ? users.length : selectedUserKeys.size})
                </Button>
                <Button 
                  color="secondary" 
                  variant="flat"
                  startContent={<FaEnvelope />}
                  onPress={handleOpenSendToAll}
                >
                  全员群发
                </Button>
              </div>
              <div className="w-72">
                <Input
                  placeholder="搜索用户 (邮箱/昵称)"
                  startContent={<FaSearch className="text-default-400" />}
                  value={search}
                  onValueChange={setSearch}
                  variant="bordered"
                  radius="lg"
                  size="sm"
                />
              </div>
            </div>

            <Table 
              aria-label="Users table" 
              className="shadow-sm border border-divider rounded-xl"
              selectionMode="multiple"
              selectedKeys={selectedUserKeys}
              onSelectionChange={setSelectedUserKeys}
            >
              <TableHeader>
                <TableColumn>用户</TableColumn>
                <TableColumn>邮箱</TableColumn>
                <TableColumn>状态</TableColumn>
                <TableColumn>注册时间</TableColumn>
                <TableColumn align="center">操作</TableColumn>
              </TableHeader>
              <TableBody 
                loadingContent={"加载中..."} 
                isLoading={loading}
                emptyContent={"暂无用户"}
              >
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <FaUser size={14} className="text-primary" />
                        </div>
                        <span className="font-medium">{user.nickname || '未设置昵称'}</span>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Chip 
                        color={user.status === 'active' ? "success" : "danger"} 
                        variant="flat" 
                        size="sm"
                        className="font-bold"
                      >
                        {user.status === 'active' ? "正常" : "禁用"}
                      </Chip>
                    </TableCell>
                    <TableCell className="text-default-500">
                      {new Date(user.created_at * 1000).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center">
                        <Tooltip content="发送消息">
                          <Button 
                            isIconOnly 
                            size="sm" 
                            variant="light" 
                            color="primary"
                            onPress={() => handleOpenSend(user)}
                          >
                            <FaPaperPlane className="hover:scale-110 transition-transform" />
                          </Button>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Tab>

        <Tab
          key="history"
          title={
            <div className="flex items-center space-x-2">
              <FaHistory />
              <span>发送记录</span>
            </div>
          }
        >
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex justify-end">
              <div className="w-72">
                <Input
                  placeholder="搜索记录 (标题/内容/用户)"
                  startContent={<FaSearch className="text-default-400" />}
                  value={historySearch}
                  onValueChange={setHistorySearch}
                  variant="bordered"
                  radius="lg"
                  size="sm"
                />
              </div>
            </div>

            <Table aria-label="History table" className="shadow-sm border border-divider rounded-xl">
              <TableHeader>
                <TableColumn>接收用户</TableColumn>
                <TableColumn>标题</TableColumn>
                <TableColumn width={300}>内容</TableColumn>
                <TableColumn>状态</TableColumn>
                <TableColumn>发送时间</TableColumn>
              </TableHeader>
              <TableBody 
                loadingContent={"加载中..."} 
                isLoading={historyLoading}
                emptyContent={"暂无发送记录"}
              >
                {filteredHistory.map((msg) => (
                  <TableRow key={msg.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{msg.nickname || '未设置昵称'}</span>
                        <span className="text-tiny text-default-400">{msg.email}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{msg.title}</TableCell>
                    <TableCell>
                      <p className="truncate text-sm text-default-600 max-w-[300px]" title={msg.content}>
                        {msg.content}
                      </p>
                    </TableCell>
                    <TableCell>
                      {msg.is_read ? (
                        <Chip size="sm" color="success" variant="flat" startContent={<FaCheckCircle />}>已读</Chip>
                      ) : (
                        <Chip size="sm" color="warning" variant="flat" startContent={<FaClock />}>未读</Chip>
                      )}
                    </TableCell>
                    <TableCell className="text-default-500">
                      {new Date(msg.created_at * 1000).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Tab>
      </Tabs>

      <Modal isOpen={isOpen} onOpenChange={onOpenChange} backdrop="blur">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <FaPaperPlane className="text-primary" />
                  <span>{sendToAll ? '发送站内信 (全员群发)' : (isBatch ? `发送站内信 (已选 ${selectedUserKeys === 'all' ? users.length : selectedUserKeys.size} 人)` : `发送站内信 - ${selectedUser?.nickname || selectedUser?.email}`)}</span>
                </div>
              </ModalHeader>
              <ModalBody className="gap-4">
                <Input
                  label="消息标题"
                  placeholder="请输入消息标题"
                  value={msgTitle}
                  onValueChange={setMsgTitle}
                  variant="bordered"
                  radius="lg"
                />
                <Textarea
                  label="消息内容"
                  placeholder="请输入消息详细内容..."
                  value={msgContent}
                  onValueChange={setMsgContent}
                  variant="bordered"
                  radius="lg"
                  minRows={4}
                />
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  取消
                </Button>
                <Button 
                  color="primary" 
                  onPress={handleSendMessage}
                  isLoading={sendLoading}
                  startContent={!sendLoading && <FaPaperPlane size={14} />}
                  className="font-bold"
                >
                  确认发送
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
