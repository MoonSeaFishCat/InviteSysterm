import { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Chip,
  Spinner,
  useDisclosure,
  Badge
} from "@heroui/react";
import { FaEnvelope, FaEnvelopeOpen, FaBell, FaCheckCircle } from 'react-icons/fa';
import apiClient from '../../api/client';

interface Message {
  id: number;
  title: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export default function Messages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const unreadCount = messages.filter(m => !m.is_read).length;

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/user/messages');
      if (response.data.success) {
        setMessages(response.data.data || []);
      }
    } catch (error) {
      console.error('获取消息失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const handleReadMessage = async (message: Message) => {
    setSelectedMessage(message);
    onOpen();

    if (!message.is_read) {
      try {
        await apiClient.post(`/user/messages/${message.id}/read`);
        setMessages(messages.map(m =>
          m.id === message.id ? { ...m, is_read: true } : m
        ));
      } catch (error) {
        console.error('标记已读失败:', error);
      }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const response = await apiClient.post('/user/messages/read-all');
      if (response.data.success) {
        setMessages(messages.map(m => ({ ...m, is_read: true })));
      }
    } catch (error: any) {
      alert(error.response?.data?.message || '操作失败');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <Card className="w-full">
        <CardHeader className="flex justify-between items-center px-6 py-4">
          <div className="flex items-center gap-3">
            <h3 className="text-2xl font-bold">站内信</h3>
            {unreadCount > 0 && (
              <Badge content={unreadCount} color="danger" size="sm">
                <Chip color="danger" variant="flat" size="sm">
                  {unreadCount} 条未读
                </Chip>
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              size="sm"
              variant="flat"
              color="primary"
              startContent={<FaCheckCircle />}
              onPress={handleMarkAllRead}
            >
              全部标记已读
            </Button>
          )}
        </CardHeader>
        <CardBody className="px-6 py-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner size="lg" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-default-500">
              <FaBell className="mx-auto text-5xl mb-4 opacity-20" />
              <p>暂无消息</p>
              <p className="text-sm mt-2">系统通知将在这里显示</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map(message => (
                <Card
                  key={message.id}
                  isPressable
                  isHoverable
                  onPress={() => handleReadMessage(message)}
                  className={`w-full transition-all ${message.is_read ? 'bg-default-50 hover:bg-default-100' : 'bg-primary-50/30 border-l-4 border-primary hover:bg-primary-50/50'}`}
                >
                  <CardBody className="p-4">
                    <div className="flex items-start gap-3 w-full">
                      <div className="mt-1 flex-shrink-0">
                        {message.is_read ? (
                          <FaEnvelopeOpen className="text-default-400 text-lg" />
                        ) : (
                          <FaEnvelope className="text-primary text-lg" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className={`font-semibold text-base truncate ${!message.is_read ? 'text-primary' : 'text-default-900'}`}>
                            {message.title}
                          </h4>
                          {!message.is_read && (
                            <Chip size="sm" color="danger" variant="dot" className="flex-shrink-0">
                              新
                            </Chip>
                          )}
                        </div>
                        <p className="text-sm text-default-600 line-clamp-2 mb-2">
                          {message.content}
                        </p>
                        <div className="text-xs text-default-400">
                          {new Date(message.created_at).toLocaleString('zh-CN')}
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* 消息详情模态框 */}
      <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
        <ModalContent>
          {selectedMessage && (
            <>
              <ModalHeader className="border-b border-divider">
                <div className="flex items-center gap-2">
                  <FaEnvelope className="text-primary" />
                  <span className="flex-1">{selectedMessage.title}</span>
                  {!selectedMessage.is_read && (
                    <Chip size="sm" color="primary" variant="flat">
                      新消息
                    </Chip>
                  )}
                </div>
              </ModalHeader>
              <ModalBody className="py-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs text-default-500 pb-3 border-b border-divider">
                    <FaBell className="text-default-400" />
                    <span>接收时间: {new Date(selectedMessage.created_at).toLocaleString('zh-CN')}</span>
                  </div>
                  <div className="bg-default-50 rounded-lg p-4">
                    <p className="whitespace-pre-wrap text-default-700 leading-relaxed">
                      {selectedMessage.content}
                    </p>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter className="border-t border-divider">
                <Button color="primary" onPress={onClose} className="w-full sm:w-auto">
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
