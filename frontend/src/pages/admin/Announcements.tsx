import { useState, useEffect } from 'react';
import { 
  Button, Card, CardBody, Spinner, 
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Switch, Textarea, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure
} from "@heroui/react";
import { FaBullhorn, FaPlus, FaTrash } from 'react-icons/fa';
import api from '../../api/client';
import toast from 'react-hot-toast';

interface Announcement {
  id: number;
  content: string;
  is_active: number;
  created_at: number;
}

export default function Announcements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {isOpen, onOpen, onClose} = useDisclosure();

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/announcements');
      setAnnouncements(Array.isArray(res.data) ? res.data : []);
    } catch (error: any) {
      toast.error("无法加载公告");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleAdd = async () => {
    if (!newContent.trim()) {
      toast.error("请输入公告内容");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post('/admin/announcements', { content: newContent });
      toast.success("公告已发布");
      setNewContent('');
      onClose();
      fetchAnnouncements();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "发布失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除该公告吗？")) return;
    try {
      await api.delete(`/admin/announcements/${id}`);
      toast.success("已删除");
      fetchAnnouncements();
    } catch (error: any) {
      toast.error("删除失败");
    }
  };

  const handleToggle = async (id: number, currentStatus: number) => {
    try {
      await api.post(`/admin/announcements/${id}/toggle`, { is_active: currentStatus === 0 });
      toast.success("状态已更新");
      fetchAnnouncements();
    } catch (error: any) {
      toast.error("操作失败");
    }
  };

  const formatDate = (dateVal: any) => {
    if (!dateVal) return '';
    try {
      let date: Date;
      if (typeof dateVal === 'number') {
        date = new Date(dateVal * 1000);
      } else {
        date = new Date(dateVal);
        if (isNaN(date.getTime())) {
          const num = Number(dateVal);
          if (!isNaN(num)) {
            date = new Date(num * 1000);
          } else {
            return 'Invalid Date';
          }
        }
      }
      return date.toLocaleString();
    } catch (e) {
      return 'Invalid Date';
    }
  };

  if (loading) return <div className="flex justify-center p-10"><Spinner size="lg" /></div>;

  return (
    <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-content1 p-8 rounded-large shadow-sm border border-divider">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <FaBullhorn className="text-primary" />
            系统公告
          </h1>
          <p className="text-sm text-default-500">管理面向所有用户的系统通知与公告</p>
        </div>
        <Button 
          color="primary" 
          radius="lg"
          className="font-bold h-12 px-8 shadow-lg shadow-primary/20"
          startContent={<FaPlus />} 
          onPress={onOpen}
        >
          发布公告
        </Button>
      </div>

      <Card className="shadow-sm border border-divider">
        <CardBody className="p-0">
          <Table 
            aria-label="公告列表"
            classNames={{
              wrapper: "shadow-none bg-transparent",
              th: "bg-default-100 text-default-600 font-bold py-4",
              td: "py-4"
            }}
          >
            <TableHeader>
              <TableColumn>内容</TableColumn>
              <TableColumn width={150}>发布时间</TableColumn>
              <TableColumn width={100}>状态</TableColumn>
              <TableColumn width={120} align="center">操作</TableColumn>
            </TableHeader>
            <TableBody emptyContent="暂无公告">
              {announcements.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="whitespace-pre-wrap text-sm">{item.content}</div>
                  </TableCell>
                  <TableCell>
                    <span className="text-tiny text-default-500 font-medium">
                      {formatDate(item.created_at)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Switch 
                      size="sm"
                      isSelected={item.is_active === 1}
                      onValueChange={() => handleToggle(item.id, item.is_active)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button 
                      isIconOnly 
                      color="danger" 
                      variant="light" 
                      size="sm"
                      onPress={() => handleDelete(item.id)}
                    >
                      <FaTrash size={14} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        backdrop="blur"
        radius="lg"
        classNames={{
          header: "border-b border-divider/50 px-8 py-6",
          body: "px-8 py-6",
          footer: "border-t border-divider/50 px-8 py-4"
        }}
      >
        <ModalContent>
          <ModalHeader>
            <h3 className="text-xl font-black">发布新公告</h3>
          </ModalHeader>
          <ModalBody>
            <Textarea
              label="公告内容"
              placeholder="请输入公告的具体内容..."
              variant="bordered"
              radius="lg"
              minRows={4}
              value={newContent}
              onValueChange={setNewContent}
              classNames={{
                input: "text-sm"
              }}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" color="primary" onPress={onClose} radius="lg" className="font-bold">取消</Button>
            <Button 
              color="primary" 
              onPress={handleAdd} 
              isLoading={isSubmitting}
              radius="lg"
              className="font-bold shadow-lg"
            >
              立即发布
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
