import { useState, useEffect } from 'react';
import {
  Card,
  CardBody,
  Button,
  Avatar,
  Chip,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/react";
import { 
  FaComments, 
  FaReply,
  FaClock,
} from 'react-icons/fa';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function PendingChat() {
  const [pendingMessages, setPendingMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchPendingMessages = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/chat/pending');
      if (res.data.success) {
        setPendingMessages(res.data.data || []);
      }
    } catch (error) {
      toast.error("获取待回复私信失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingMessages();
  }, []);

  const handleReply = (msg: any) => {
    // 跳转到交流空间并开启私信模式
    navigate(`/admin/dashboard?tab=chat&chatType=private&receiverId=${msg.sender_id}&receiverType=${msg.sender_type || 'user'}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <FaComments className="text-primary" />
          待回复私信
        </h2>
        <Button 
          size="sm" 
          variant="flat" 
          color="primary" 
          onPress={fetchPendingMessages}
          isLoading={loading}
        >
          刷新列表
        </Button>
      </div>

      <Card className="shadow-lg border-none">
        <CardBody className="p-0">
          <Table aria-label="待回复私信列表" shadow="none" removeWrapper>
            <TableHeader>
              <TableColumn>发送者</TableColumn>
              <TableColumn>最后消息</TableColumn>
              <TableColumn>发送时间</TableColumn>
              <TableColumn align="center">操作</TableColumn>
            </TableHeader>
            <TableBody emptyContent={loading ? "加载中..." : "暂无待回复私信"}>
              {pendingMessages.map((msg) => (
                <TableRow key={msg.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar 
                        name={msg.sender_username} 
                        size="sm"
                        className={msg.sender_type === 'admin' ? 'bg-secondary' : 'bg-primary'}
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold">{msg.sender_username}</span>
                        <Chip size="sm" variant="flat" color={msg.sender_type === 'admin' ? 'secondary' : 'primary'} className="h-4 px-1 text-[8px]">
                          {msg.sender_type === 'admin' ? '管理员' : '用户'}
                        </Chip>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-default-500 max-w-md truncate">
                      {msg.message}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-xs text-default-400">
                      <FaClock size={10} />
                      {new Date(msg.created_at).toLocaleString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button 
                      size="sm" 
                      color="primary" 
                      variant="flat" 
                      startContent={<FaReply />}
                      onPress={() => handleReply(msg)}
                    >
                      回复
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
