import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Card,
  CardBody,
  Avatar,
  Chip,
  Progress,
  Skeleton,
  Tooltip
} from "@heroui/react";
import { FaTrophy, FaMedal, FaUserShield, FaUserEdit, FaComments } from 'react-icons/fa';
import api from '../../api/client';
import toast from 'react-hot-toast';
import type { AuditorRanking } from '../../types';

export default function AuditorRankingPage() {
  const navigate = useNavigate();
  const [rankings, setRankings] = useState<AuditorRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<any>(null);

  const fetchMe = async () => {
    try {
      const res = await api.get('/admin/me');
      if (res.data.success) {
        setMe(res.data.data);
      }
    } catch (error) {}
  };

  const fetchRankings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/auditor/ranking');
      if (res.data.success) {
        setRankings(res.data.data || []);
      }
    } catch (error) {
      toast.error("加载排行榜失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRankings();
    fetchMe();
  }, []);

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0: return <FaTrophy className="text-warning" size={24} />;
      case 1: return <FaMedal className="text-default-400" size={22} />;
      case 2: return <FaMedal className="text-orange-400" size={20} />;
      default: return <span className="text-lg font-bold text-default-400 w-6 text-center">{index + 1}</span>;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <FaTrophy className="text-warning" />
          审核员贡献排行
        </h2>
        <Chip color="primary" variant="flat">
          激励每一位审核员
        </Chip>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* 前三名特写卡片 */}
        {loading ? (
          [1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-2xl" />)
        ) : (
          rankings.slice(0, 3).map((auditor, index) => (
            <Card key={auditor.id} className={`border-none shadow-lg overflow-hidden ${
              index === 0 ? 'bg-gradient-to-br from-warning-500/20 to-warning-600/10 scale-105' : 'bg-default-100/50'
            }`}>
              <CardBody className="flex flex-col items-center justify-center py-8 gap-3 relative">
                <div className="absolute top-4 right-4">
                  {getRankIcon(index)}
                </div>
                <Avatar
                  size="lg"
                  name={auditor.username}
                  icon={auditor.role === 'super' ? <FaUserShield /> : <FaUserEdit />}
                  className={auditor.role === 'super' ? 'bg-secondary' : 'bg-primary'}
                />
                <div className="text-center">
                  <div className="font-bold text-xl">{auditor.username}</div>
                  <div className="text-xs text-default-500 mt-1 uppercase tracking-wider">{auditor.role}</div>
                </div>
                <div className="flex flex-col items-center mt-2">
                  <span className="text-2xl font-black text-primary">{auditor.auditCount}</span>
                  <span className="text-[10px] text-default-400 uppercase">累计审核</span>
                </div>
              </CardBody>
            </Card>
          ))
        )}
      </div>

      <Card className="shadow-lg border-none">
        <CardBody className="p-0">
          <Table aria-label="审核员排行榜" shadow="none" removeWrapper>
            <TableHeader>
              <TableColumn width={100}>排名</TableColumn>
              <TableColumn>审核员</TableColumn>
              <TableColumn>角色</TableColumn>
              <TableColumn align="center">审核总数</TableColumn>
              <TableColumn>最后审核时间</TableColumn>
              <TableColumn align="center">操作</TableColumn>
            </TableHeader>
            <TableBody emptyContent={loading ? "加载中..." : "暂无数据"}>
              {rankings.map((auditor, index) => (
                <TableRow key={auditor.id} className="hover:bg-default-50 transition-colors">
                  <TableCell>
                    <div className="flex justify-center items-center">
                      {getRankIcon(index)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar size="sm" name={auditor.username} />
                      <span className="font-semibold">{auditor.username}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" variant="flat" color={auditor.role === 'super' ? 'secondary' : 'primary'}>
                      {auditor.role === 'super' ? '超级管理员' : '审核员'}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-bold">{auditor.auditCount}</span>
                      <Progress 
                        size="sm" 
                        value={auditor.auditCount} 
                        maxValue={rankings[0]?.auditCount || 100} 
                        color="primary"
                        className="max-w-[100px]"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-default-500">
                    {auditor.lastAuditAt ? new Date(auditor.lastAuditAt).toLocaleString() : '从未审核'}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center">
                      {me?.id !== auditor.id && (
                        <Tooltip content="发送私信">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="primary"
                            onPress={() => navigate('/admin/dashboard/chat', { 
                              state: { 
                                receiverId: auditor.id, 
                                receiverType: 'admin',
                                chatType: 'private'
                              } 
                            })}
                          >
                            <FaComments size={18} />
                          </Button>
                        </Tooltip>
                      )}
                    </div>
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
