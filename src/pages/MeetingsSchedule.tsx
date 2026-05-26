import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, isBefore, startOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, MapPin, Building2, CalendarClock } from 'lucide-react';

interface Meeting {
  id: string;
  company_name: string;
  location: string | null;
  meeting_date: string;
  meeting_time: string;
  agenda: string | null;
}

const emptyForm = {
  company_name: '',
  location: '',
  meeting_date: format(new Date(), 'yyyy-MM-dd'),
  meeting_time: '10:00',
  agenda: '',
};

export default function MeetingsSchedule() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: meetings = [] } = useQuery({
    queryKey: ['meetings-schedule'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meeting_schedules')
        .select('id, company_name, location, meeting_date, meeting_time, agenda')
        .order('meeting_date', { ascending: true })
        .order('meeting_time', { ascending: true });
      if (error) throw error;
      return data as Meeting[];
    },
    enabled: isAdmin,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        company_name: form.company_name.trim(),
        location: form.location.trim() || null,
        meeting_date: form.meeting_date,
        meeting_time: form.meeting_time,
        agenda: form.agenda.trim() || null,
      };
      if (editingId) {
        const { error } = await supabase.from('meeting_schedules').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('meeting_schedules').insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings-schedule'] });
      toast.success(editingId ? '미팅 일정이 수정되었습니다' : '미팅 일정이 등록되었습니다');
      closeForm();
    },
    onError: (e: any) => toast.error(e.message || '저장 실패'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('meeting_schedules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings-schedule'] });
      toast.success('미팅 일정이 삭제되었습니다');
    },
    onError: (e: any) => toast.error(e.message || '삭제 실패'),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setIsFormOpen(true);
  };

  const openEdit = (m: Meeting) => {
    setEditingId(m.id);
    setForm({
      company_name: m.company_name,
      location: m.location || '',
      meeting_date: m.meeting_date,
      meeting_time: m.meeting_time.slice(0, 5),
      agenda: m.agenda || '',
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const isPast = (m: Meeting) => isBefore(new Date(m.meeting_date), startOfDay(new Date()));

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="text-center">
            <h2 className="mb-2 text-xl font-semibold">접근 권한이 없습니다</h2>
            <p className="text-muted-foreground">미팅 일정 관리는 대표·이사만 볼 수 있습니다.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const upcoming = meetings.filter((m) => !isPast(m));
  const past = meetings.filter((m) => isPast(m));

  const renderMeeting = (m: Meeting, muted = false) => (
    <div key={m.id} className={`rounded-lg border p-4 ${muted ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-4">
          <div className="min-w-[64px] rounded-md bg-primary/10 p-2 text-center">
            <div className="text-xs text-muted-foreground">
              {format(new Date(m.meeting_date), 'EEE', { locale: ko })}
            </div>
            <div className="text-lg font-bold leading-tight">
              {format(new Date(m.meeting_date), 'M/d')}
            </div>
            <div className="text-xs font-medium text-primary">{m.meeting_time.slice(0, 5)}</div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 font-semibold">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              {m.company_name}
            </div>
            {m.location && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                {m.location}
              </div>
            )}
            {m.agenda && (
              <div className="whitespace-pre-wrap pt-1 text-sm">{m.agenda}</div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteMutation.mutate(m.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">미팅 일정 관리</h1>
            <p className="text-muted-foreground">업체 미팅 일정을 등록하면 하루 전·당일에 알림이 표시됩니다</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            미팅 등록
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5" />
              예정된 미팅
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">예정된 미팅이 없습니다</div>
            ) : (
              <div className="space-y-3">{upcoming.map((m) => renderMeeting(m))}</div>
            )}
          </CardContent>
        </Card>

        {past.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-muted-foreground">지난 미팅</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">{past.map((m) => renderMeeting(m, true))}</div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={isFormOpen} onOpenChange={(o) => (o ? setIsFormOpen(true) : closeForm())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? '미팅 일정 수정' : '미팅 일정 등록'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>업체명</Label>
              <Input
                value={form.company_name}
                onChange={(e) => setForm((p) => ({ ...p, company_name: e.target.value }))}
                placeholder="예: (주)코튼88"
              />
            </div>
            <div className="space-y-2">
              <Label>장소</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                placeholder="예: 강남 본사 3층 회의실"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>날짜</Label>
                <Input
                  type="date"
                  value={form.meeting_date}
                  onChange={(e) => setForm((p) => ({ ...p, meeting_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>시간</Label>
                <Input
                  type="time"
                  value={form.meeting_time}
                  onChange={(e) => setForm((p) => ({ ...p, meeting_time: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>아젠다</Label>
              <Textarea
                value={form.agenda}
                onChange={(e) => setForm((p) => ({ ...p, agenda: e.target.value }))}
                placeholder="미팅 안건을 입력하세요"
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>취소</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.company_name.trim() || saveMutation.isPending}
            >
              {editingId ? '수정' : '등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
