import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Check, X, Pencil, CalendarOff, User, Clock } from 'lucide-react';

interface LeaveRequest {
  id: string;
  user_id: string;
  leave_date: string;
  is_all_day: boolean;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  status: string;
  reject_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  profile?: { full_name: string | null; email: string };
}

const emptyForm = {
  leave_date: format(new Date(), 'yyyy-MM-dd'),
  is_all_day: true,
  start_time: '09:00',
  end_time: '18:00',
  reason: '',
};

export default function Leave() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // 상담원: 내 신청 내역
  const { data: myRequests = [] } = useQuery({
    queryKey: ['my-leave-requests', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('user_id', user!.id)
        .order('leave_date', { ascending: false });
      if (error) throw error;
      return data as LeaveRequest[];
    },
    enabled: !!user && !isAdmin,
  });

  // 대표: 전체 신청 내역
  const { data: allRequests = [] } = useQuery({
    queryKey: ['all-leave-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const userIds = [...new Set(data.map((d) => d.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);
      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      return data.map((item) => ({
        ...item,
        profile: profileMap.get(item.user_id),
      })) as LeaveRequest[];
    },
    enabled: isAdmin,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['my-leave-requests'] });
    queryClient.invalidateQueries({ queryKey: ['all-leave-requests'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const validateForm = () => {
    if (!form.is_all_day && form.start_time >= form.end_time) {
      toast.error('종료 시간은 시작 시간보다 늦어야 합니다');
      return false;
    }
    return true;
  };

  const buildPayload = () => ({
    leave_date: form.leave_date,
    is_all_day: form.is_all_day,
    start_time: form.is_all_day ? null : form.start_time,
    end_time: form.is_all_day ? null : form.end_time,
    reason: form.reason || null,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const { error } = await supabase
          .from('leave_requests')
          .update(buildPayload())
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('leave_requests')
          .insert({ user_id: user!.id, ...buildPayload() });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidateAll();
      toast.success(editingId ? '휴무 신청이 수정되었습니다' : '휴무 신청이 접수되었습니다');
      closeForm();
    },
    onError: (e: any) => toast.error(e.message || '처리 실패'),
  });

  const withdrawMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leave_requests').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('휴무 신청이 철회되었습니다');
    },
    onError: (e: any) => toast.error(e.message || '철회 실패'),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('leave_requests')
        .update({ status: 'approved', reviewed_by: user!.id, reviewed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('승인되었습니다');
    },
    onError: (e: any) => toast.error(e.message || '승인 실패'),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!rejectTarget) return;
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: 'rejected',
          reject_reason: rejectReason || null,
          reviewed_by: user!.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', rejectTarget.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('반려되었습니다');
      setRejectTarget(null);
      setRejectReason('');
    },
    onError: (e: any) => toast.error(e.message || '반려 실패'),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setIsFormOpen(true);
  };

  const openEdit = (req: LeaveRequest) => {
    setEditingId(req.id);
    setForm({
      leave_date: req.leave_date,
      is_all_day: req.is_all_day,
      start_time: req.start_time?.slice(0, 5) || '09:00',
      end_time: req.end_time?.slice(0, 5) || '18:00',
      reason: req.reason || '',
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const timeLabel = (req: LeaveRequest) =>
    req.is_all_day
      ? '종일'
      : `${req.start_time?.slice(0, 5)} ~ ${req.end_time?.slice(0, 5)}`;

  const statusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-600 hover:bg-green-600">승인</Badge>;
      case 'rejected':
        return <Badge variant="destructive">반려</Badge>;
      default:
        return <Badge variant="secondary">대기중</Badge>;
    }
  };

  const pendingRequests = allRequests.filter((r) => r.status === 'pending');

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">휴무 신청</h1>
            <p className="text-muted-foreground">
              {isAdmin ? '상담원들의 휴무 신청을 승인하거나 반려하세요' : '휴무가 필요한 날짜와 시간을 신청하세요'}
            </p>
          </div>
          {!isAdmin && (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              휴무 신청
            </Button>
          )}
        </div>

        {isAdmin ? (
          <Tabs defaultValue="pending" className="space-y-4">
            <TabsList>
              <TabsTrigger value="pending">
                대기 중{pendingRequests.length > 0 && ` (${pendingRequests.length})`}
              </TabsTrigger>
              <TabsTrigger value="all">전체 내역</TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    승인 대기 중인 휴무 신청
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pendingRequests.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">대기 중인 신청이 없습니다</div>
                  ) : (
                    <div className="space-y-3">
                      {pendingRequests.map((req) => (
                        <div key={req.id} className="flex items-start justify-between gap-3 rounded-lg border p-4">
                          <div className="flex items-start gap-4">
                            <div className="min-w-[56px] text-center">
                              <div className="text-sm text-muted-foreground">
                                {format(new Date(req.leave_date), 'EEE', { locale: ko })}
                              </div>
                              <div className="text-lg font-semibold">
                                {format(new Date(req.leave_date), 'M/d')}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">
                                  {req.profile?.full_name || req.profile?.email}
                                </span>
                              </div>
                              <div className="text-sm">{timeLabel(req)}</div>
                              {req.reason && (
                                <div className="text-sm text-muted-foreground">사유: {req.reason}</div>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => approveMutation.mutate(req.id)}>
                              <Check className="mr-1 h-4 w-4" />
                              승인
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => { setRejectTarget(req); setRejectReason(''); }}>
                              <X className="mr-1 h-4 w-4" />
                              반려
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="all">
              <Card>
                <CardHeader>
                  <CardTitle>전체 휴무 신청 내역</CardTitle>
                </CardHeader>
                <CardContent>
                  {allRequests.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">신청 내역이 없습니다</div>
                  ) : (
                    <div className="space-y-3">
                      {allRequests.map((req) => (
                        <div key={req.id} className="flex items-start justify-between gap-3 rounded-lg border p-4">
                          <div className="flex items-start gap-4">
                            <div className="min-w-[56px] text-center">
                              <div className="text-sm text-muted-foreground">
                                {format(new Date(req.leave_date), 'EEE', { locale: ko })}
                              </div>
                              <div className="text-lg font-semibold">
                                {format(new Date(req.leave_date), 'M/d')}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">
                                  {req.profile?.full_name || req.profile?.email}
                                </span>
                              </div>
                              <div className="text-sm">{timeLabel(req)}</div>
                              {req.reason && (
                                <div className="text-sm text-muted-foreground">사유: {req.reason}</div>
                              )}
                              {req.status === 'rejected' && req.reject_reason && (
                                <div className="text-sm text-destructive">반려 사유: {req.reject_reason}</div>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0">{statusBadge(req.status)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarOff className="h-5 w-5" />
                내 휴무 신청 내역
              </CardTitle>
            </CardHeader>
            <CardContent>
              {myRequests.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">신청한 휴무가 없습니다</div>
              ) : (
                <div className="space-y-3">
                  {myRequests.map((req) => (
                    <div key={req.id} className="flex items-start justify-between gap-3 rounded-lg border p-4">
                      <div className="flex items-start gap-4">
                        <div className="min-w-[56px] text-center">
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(req.leave_date), 'EEE', { locale: ko })}
                          </div>
                          <div className="text-lg font-semibold">
                            {format(new Date(req.leave_date), 'M/d')}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-sm font-medium">{timeLabel(req)}</div>
                          {req.reason && (
                            <div className="text-sm text-muted-foreground">사유: {req.reason}</div>
                          )}
                          {req.status === 'rejected' && req.reject_reason && (
                            <div className="text-sm text-destructive">반려 사유: {req.reject_reason}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        {statusBadge(req.status)}
                        {req.status === 'pending' && (
                          <div className="flex gap-1">
                            <Button variant="outline" size="sm" onClick={() => openEdit(req)}>
                              <Pencil className="mr-1 h-3.5 w-3.5" />
                              수정
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => withdrawMutation.mutate(req.id)}>
                              <X className="mr-1 h-3.5 w-3.5" />
                              철회
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* 신청 / 수정 다이얼로그 */}
      <Dialog open={isFormOpen} onOpenChange={(o) => (o ? setIsFormOpen(true) : closeForm())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? '휴무 신청 수정' : '휴무 신청'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>날짜</Label>
              <Input
                type="date"
                value={form.leave_date}
                min={format(new Date(), 'yyyy-MM-dd')}
                onChange={(e) => setForm((p) => ({ ...p, leave_date: e.target.value }))}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="all-day" className="cursor-pointer">종일 휴무</Label>
              <Switch
                id="all-day"
                checked={form.is_all_day}
                onCheckedChange={(v) => setForm((p) => ({ ...p, is_all_day: v }))}
              />
            </div>

            {!form.is_all_day && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>시작 시간</Label>
                  <Input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm((p) => ({ ...p, start_time: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>종료 시간</Label>
                  <Input
                    type="time"
                    value={form.end_time}
                    onChange={(e) => setForm((p) => ({ ...p, end_time: e.target.value }))}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>사유 (선택)</Label>
              <Textarea
                value={form.reason}
                onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                placeholder="휴무 사유를 입력하세요"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>취소</Button>
            <Button onClick={() => validateForm() && submitMutation.mutate()} disabled={submitMutation.isPending}>
              {editingId ? '수정' : '신청'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 반려 사유 다이얼로그 */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>휴무 신청 반려</DialogTitle>
          </DialogHeader>
          {rejectTarget && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-3 text-sm">
                <div className="font-medium">{rejectTarget.profile?.full_name || rejectTarget.profile?.email}</div>
                <div className="text-muted-foreground">
                  {format(new Date(rejectTarget.leave_date), 'yyyy년 M월 d일 (EEE)', { locale: ko })} · {timeLabel(rejectTarget)}
                </div>
              </div>
              <div className="space-y-2">
                <Label>반려 사유</Label>
                <Textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="반려 사유를 입력하세요 (상담원에게 표시됩니다)"
                  autoFocus
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>취소</Button>
            <Button variant="destructive" onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending}>
              반려
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
