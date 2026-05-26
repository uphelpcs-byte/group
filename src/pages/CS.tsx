import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Search, MoreHorizontal, MessageSquare, Phone, Mail, Edit, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getConsultationStatusBadge } from '@/components/ui/status-badge';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ConsultationDialog } from '@/components/dialogs/ConsultationDialog';
import { DeleteConfirmDialog } from '@/components/dialogs/DeleteConfirmDialog';
import { toast } from 'sonner';

interface Consultation {
  id: string;
  content: string;
  status: string;
  consultation_type: string | null;
  customer_name: string | null;
  customer_contact: string | null;
  created_at: string;
  client_id: string;
  agent_id: string;
  client?: { name: string };
  agent?: { full_name: string };
}

export default function CS() {
  const { user, isManagerPlus } = useAuth();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    fetchConsultations();
  }, [statusFilter]);

  const fetchConsultations = async () => {
    try {
      let query = supabase
        .from('consultations')
        .select(`
          *,
          client:clients(name),
          agent:profiles!consultations_agent_id_fkey(full_name)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as 'pending' | 'in_progress' | 'completed' | 'escalated');
      }

      const { data, error } = await query;

      if (error) throw error;
      setConsultations((data || []) as Consultation[]);
    } catch (error) {
      console.error('Error fetching consultations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (consultation: Consultation) => {
    setSelectedConsultation(consultation);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedConsultation) return;
    
    setDeleteLoading(true);
    try {
      const { error } = await supabase
        .from('consultations')
        .delete()
        .eq('id', selectedConsultation.id);

      if (error) throw error;
      
      toast.success('상담이 삭제되었습니다');
      setDeleteDialogOpen(false);
      setSelectedConsultation(null);
      fetchConsultations();
    } catch (error) {
      console.error('Error deleting consultation:', error);
      toast.error('삭제에 실패했습니다');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleStatusChange = async (consultation: Consultation, newStatus: 'pending' | 'in_progress' | 'completed' | 'escalated') => {
    try {
      const { error } = await supabase
        .from('consultations')
        .update({ status: newStatus })
        .eq('id', consultation.id);

      if (error) throw error;
      
      toast.success('상태가 변경되었습니다');
      fetchConsultations();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('상태 변경에 실패했습니다');
    }
  };

  const filteredConsultations = consultations.filter(consultation =>
    (consultation.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     consultation.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     consultation.client?.name?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getChannelIcon = (type: string | null) => {
    switch (type) {
      case 'phone':
        return <Phone className="h-4 w-4" />;
      case 'email':
        return <Mail className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getChannelLabel = (type: string | null) => {
    const labels: Record<string, string> = {
      phone: '전화',
      email: '이메일',
      kakao: '카카오톡',
      channel_talk: '채널톡',
      other: '기타',
    };
    return labels[type || 'other'] || type || '기타';
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-full items-center justify-center">
          <div className="animate-pulse text-muted-foreground">로딩중...</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">CS 운영</h1>
            <p className="text-muted-foreground">고객 상담 내역을 관리합니다</p>
          </div>
          <Button onClick={() => { setSelectedConsultation(null); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            상담 등록
          </Button>
        </div>

        {/* Stats */}
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{consultations.filter(c => c.status === 'pending').length}</div>
              <p className="text-sm text-muted-foreground">대기중</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{consultations.filter(c => c.status === 'in_progress').length}</div>
              <p className="text-sm text-muted-foreground">진행중</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{consultations.filter(c => c.status === 'completed').length}</div>
              <p className="text-sm text-muted-foreground">완료</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{consultations.filter(c => c.status === 'escalated').length}</div>
              <p className="text-sm text-muted-foreground">에스컬레이션</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="고객명, 내용, 고객사로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="상태 필터" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="pending">대기중</SelectItem>
              <SelectItem value="in_progress">진행중</SelectItem>
              <SelectItem value="completed">완료</SelectItem>
              <SelectItem value="escalated">에스컬레이션</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Consultations Table */}
        <Card>
          <CardHeader>
            <CardTitle>상담 목록</CardTitle>
            <CardDescription>총 {filteredConsultations.length}건</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>채널</TableHead>
                  <TableHead>고객사</TableHead>
                  <TableHead>고객정보</TableHead>
                  <TableHead>상담내용</TableHead>
                  <TableHead>담당자</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>등록일시</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConsultations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {searchQuery || statusFilter !== 'all' ? '검색 결과가 없습니다' : '등록된 상담이 없습니다'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredConsultations.map((consultation) => (
                    <TableRow key={consultation.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getChannelIcon(consultation.consultation_type)}
                          <span className="text-sm">{getChannelLabel(consultation.consultation_type)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {consultation.client?.name || '-'}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{consultation.customer_name || '미입력'}</p>
                          <p className="text-sm text-muted-foreground">{consultation.customer_contact || '-'}</p>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <p className="truncate">{consultation.content}</p>
                      </TableCell>
                      <TableCell>{consultation.agent?.full_name || '-'}</TableCell>
                      <TableCell>{getConsultationStatusBadge(consultation.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(consultation.created_at), 'M/d HH:mm', { locale: ko })}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(consultation)}>
                              <Edit className="mr-2 h-4 w-4" />
                              수정
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleStatusChange(consultation, 'pending')}>
                              상태: 대기중
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(consultation, 'in_progress')}>
                              상태: 진행중
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(consultation, 'completed')}>
                              상태: 완료
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(consultation, 'escalated')}>
                              상태: 에스컬레이션
                            </DropdownMenuItem>
                            {isManagerPlus && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => { setSelectedConsultation(consultation); setDeleteDialogOpen(true); }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  삭제
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <ConsultationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        consultation={selectedConsultation}
        onSuccess={fetchConsultations}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="상담 삭제"
        description="이 상담을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </AppLayout>
  );
}
