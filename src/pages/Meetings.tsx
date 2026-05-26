import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Plus, Calendar, Clock, MapPin, Users, FileText, CheckSquare, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { MeetingDialog } from '@/components/dialogs/MeetingDialog';
import { MeetingDetailDialog } from '@/components/dialogs/MeetingDetailDialog';
import { DeleteConfirmDialog } from '@/components/dialogs/DeleteConfirmDialog';

type Meeting = {
  id: string;
  title: string;
  description: string | null;
  meeting_date: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  status: string;
  created_by: string;
  created_at: string;
};

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  in_progress: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  completed: 'bg-green-500/10 text-green-500 border-green-500/20',
  cancelled: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

const statusLabels: Record<string, string> = {
  scheduled: '예정',
  in_progress: '진행중',
  completed: '완료',
  cancelled: '취소',
};

export default function Meetings() {
  const { user, isManagerPlus } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ['meetings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .order('meeting_date', { ascending: false })
        .order('start_time', { ascending: false });
      
      if (error) throw error;
      return data as Meeting[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email');
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('meetings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      toast.success('회의가 삭제되었습니다');
      setIsDeleteDialogOpen(false);
      setSelectedMeeting(null);
    },
    onError: (error: any) => {
      toast.error(error.message || '회의 삭제 실패');
    },
  });

  const filteredMeetings = meetings.filter(meeting => {
    if (statusFilter === 'all') return true;
    return meeting.status === statusFilter;
  });

  const handleEdit = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setIsDialogOpen(true);
  };

  const handleDelete = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setIsDeleteDialogOpen(true);
  };

  const handleViewDetail = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setIsDetailDialogOpen(true);
  };

  const getCreatorName = (createdBy: string) => {
    const profile = profiles.find(p => p.id === createdBy);
    return profile?.full_name || profile?.email || '알 수 없음';
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">회의관리</h1>
            <p className="text-muted-foreground">회의 일정, 아젠다, 회의록 및 액션아이템을 관리합니다</p>
          </div>
          <Button onClick={() => { setSelectedMeeting(null); setIsDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            회의 추가
          </Button>
        </div>

        {/* Filter Tabs */}
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="all">전체</TabsTrigger>
            <TabsTrigger value="scheduled">예정</TabsTrigger>
            <TabsTrigger value="in_progress">진행중</TabsTrigger>
            <TabsTrigger value="completed">완료</TabsTrigger>
            <TabsTrigger value="cancelled">취소</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Meeting Cards */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">로딩중...</div>
        ) : filteredMeetings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {statusFilter === 'all' ? '등록된 회의가 없습니다' : `${statusLabels[statusFilter]} 상태의 회의가 없습니다`}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredMeetings.map((meeting) => (
              <Card 
                key={meeting.id} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleViewDetail(meeting)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{meeting.title}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {meeting.description || '설명 없음'}
                      </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(meeting); }}>
                          <Pencil className="mr-2 h-4 w-4" />
                          수정
                        </DropdownMenuItem>
                        {isManagerPlus && (
                          <DropdownMenuItem 
                            onClick={(e) => { e.stopPropagation(); handleDelete(meeting); }}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            삭제
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {format(parseISO(meeting.meeting_date), 'M월 d일 (EEE)', { locale: ko })}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {meeting.start_time.slice(0, 5)}
                      {meeting.end_time && ` - ${meeting.end_time.slice(0, 5)}`}
                    </div>
                  </div>
                  
                  {meeting.location && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {meeting.location}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between pt-2 border-t">
                    <Badge variant="outline" className={statusColors[meeting.status]}>
                      {statusLabels[meeting.status]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {getCreatorName(meeting.created_by)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <MeetingDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        meeting={selectedMeeting}
      />

      <MeetingDetailDialog
        open={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
        meeting={selectedMeeting}
      />

      <DeleteConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={() => selectedMeeting && deleteMutation.mutate(selectedMeeting.id)}
        title="회의 삭제"
        description={`"${selectedMeeting?.title}" 회의를 삭제하시겠습니까? 관련된 아젠다, 회의록, 액션아이템도 함께 삭제됩니다.`}
      />
    </AppLayout>
  );
}
