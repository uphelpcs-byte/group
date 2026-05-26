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
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Check, X, Clock, CalendarDays, User } from 'lucide-react';

interface Availability {
  id: string;
  user_id: string;
  work_date: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  created_at: string;
  profile?: { full_name: string; email: string };
}

interface Assignment {
  id: string;
  availability_id: string;
  user_id: string;
  work_date: string;
  start_time: string;
  end_time: string;
  client_id: string | null;
  status: string;
  notes: string | null;
  assigned_by: string;
  profile?: { full_name: string };
  client?: { name: string };
}

const TIME_SLOTS = [
  { label: '오전 (09:00-13:00)', start: '09:00', end: '13:00' },
  { label: '오후 (13:00-18:00)', start: '13:00', end: '18:00' },
  { label: '저녁 (18:00-22:00)', start: '18:00', end: '22:00' },
  { label: '종일 (09:00-18:00)', start: '09:00', end: '18:00' },
];

export default function Schedule() {
  const { user, isManagerPlus } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedAvailability, setSelectedAvailability] = useState<Availability | null>(null);
  const [formData, setFormData] = useState({
    work_date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '09:00',
    end_time: '18:00',
    notes: '',
  });
  const [assignData, setAssignData] = useState({
    client_id: '',
    notes: '',
  });

  // 내 가용 시간 조회
  const { data: myAvailability = [] } = useQuery({
    queryKey: ['my-availability'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedule_availability')
        .select('*')
        .eq('user_id', user?.id)
        .order('work_date', { ascending: true });
      if (error) throw error;
      return data as Availability[];
    },
    enabled: !!user,
  });

  // 모든 가용 시간 조회 (관리자용)
  const { data: allAvailability = [] } = useQuery({
    queryKey: ['all-availability'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedule_availability')
        .select('*')
        .order('work_date', { ascending: true });
      if (error) throw error;
      
      // 프로필 정보 별도 조회
      const userIds = [...new Set(data.map(d => d.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      return data.map(item => ({
        ...item,
        profile: profileMap.get(item.user_id),
      })) as Availability[];
    },
    enabled: isManagerPlus,
  });

  // 확정된 스케줄 조회
  const { data: assignments = [] } = useQuery({
    queryKey: ['schedule-assignments'],
    queryFn: async () => {
      let query = supabase
        .from('schedule_assignments')
        .select('*, client:clients(name)')
        .order('work_date', { ascending: true });
      
      if (!isManagerPlus) {
        query = query.eq('user_id', user?.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // 프로필 정보 별도 조회
      const userIds = [...new Set(data.map(d => d.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      return data.map(item => ({
        ...item,
        profile: profileMap.get(item.user_id),
      })) as Assignment[];
    },
    enabled: !!user,
  });

  // 고객사 목록 조회 (pilot, active 상태만)
  const { data: clients = [] } = useQuery({
    queryKey: ['clients-for-schedule'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .in('status', ['pilot', 'active'])
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: isManagerPlus,
  });

  // 가용 시간 등록
  const addAvailabilityMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('schedule_availability').insert({
        user_id: user?.id,
        work_date: formData.work_date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        notes: formData.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-availability'] });
      queryClient.invalidateQueries({ queryKey: ['all-availability'] });
      toast.success('근무 가능 시간이 등록되었습니다');
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || '등록 실패');
    },
  });

  // 가용 시간 삭제
  const deleteAvailabilityMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('schedule_availability').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-availability'] });
      queryClient.invalidateQueries({ queryKey: ['all-availability'] });
      toast.success('삭제되었습니다');
    },
    onError: () => {
      toast.error('삭제 실패');
    },
  });

  // 스케줄 확정 (관리자)
  const confirmAssignmentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAvailability) return;
      const { error } = await supabase.from('schedule_assignments').insert({
        availability_id: selectedAvailability.id,
        user_id: selectedAvailability.user_id,
        work_date: selectedAvailability.work_date,
        start_time: selectedAvailability.start_time,
        end_time: selectedAvailability.end_time,
        client_id: assignData.client_id && assignData.client_id !== 'none' ? assignData.client_id : null,
        assigned_by: user?.id,
        notes: assignData.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-assignments'] });
      toast.success('스케줄이 확정되었습니다');
      setIsAssignDialogOpen(false);
      setSelectedAvailability(null);
      setAssignData({ client_id: '', notes: '' });
    },
    onError: (error: any) => {
      toast.error(error.message || '확정 실패');
    },
  });

  // 스케줄 취소 (관리자)
  const cancelAssignmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('schedule_assignments')
        .update({ status: 'cancelled' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-assignments'] });
      toast.success('스케줄이 취소되었습니다');
    },
    onError: () => {
      toast.error('취소 실패');
    },
  });

  const resetForm = () => {
    setFormData({
      work_date: format(new Date(), 'yyyy-MM-dd'),
      start_time: '09:00',
      end_time: '18:00',
      notes: '',
    });
  };

  const handleTimeSlotSelect = (slot: typeof TIME_SLOTS[0]) => {
    setFormData(prev => ({
      ...prev,
      start_time: slot.start,
      end_time: slot.end,
    }));
  };

  const handleOpenAssignDialog = (availability: Availability) => {
    setSelectedAvailability(availability);
    setIsAssignDialogOpen(true);
  };

  // 해당 날짜의 스케줄이 이미 확정되었는지 확인
  const isAlreadyAssigned = (availabilityId: string) => {
    return assignments.some(a => a.availability_id === availabilityId && a.status === 'confirmed');
  };

  // 날짜별 가용 시간 필터링
  const getAvailabilityForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    if (isManagerPlus) {
      return allAvailability.filter(a => a.work_date === dateStr);
    }
    return myAvailability.filter(a => a.work_date === dateStr);
  };

  // 날짜에 가용 시간이 있는지 확인
  const hasAvailabilityOnDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    if (isManagerPlus) {
      return allAvailability.some(a => a.work_date === dateStr);
    }
    return myAvailability.some(a => a.work_date === dateStr);
  };

  // 날짜에 확정된 스케줄이 있는지 확인
  const hasAssignmentOnDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return assignments.some(a => a.work_date === dateStr && a.status === 'confirmed');
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">스케줄 관리</h1>
            <p className="text-muted-foreground">
              {isManagerPlus 
                ? '상담원들의 근무 가능 시간을 확인하고 배정하세요' 
                : '근무 가능한 날짜와 시간을 등록해주세요'}
            </p>
          </div>
          {!isManagerPlus && (
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              근무 가능 시간 등록
            </Button>
          )}
        </div>

        <Tabs defaultValue={isManagerPlus ? "pending" : "my-availability"} className="space-y-4">
          <TabsList>
            {!isManagerPlus && <TabsTrigger value="my-availability">내 가용 시간</TabsTrigger>}
            {isManagerPlus && <TabsTrigger value="pending">대기 중인 요청</TabsTrigger>}
            <TabsTrigger value="confirmed">확정된 스케줄</TabsTrigger>
            <TabsTrigger value="calendar">캘린더 보기</TabsTrigger>
          </TabsList>

          {/* 상담원: 내 가용 시간 목록 */}
          {!isManagerPlus && (
            <TabsContent value="my-availability" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    등록한 근무 가능 시간
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {myAvailability.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      등록된 근무 가능 시간이 없습니다
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {myAvailability.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex items-center gap-4">
                            <div className="text-center">
                              <div className="text-sm text-muted-foreground">
                                {format(new Date(item.work_date), 'EEE', { locale: ko })}
                              </div>
                              <div className="text-lg font-semibold">
                                {format(new Date(item.work_date), 'M/d')}
                              </div>
                            </div>
                            <div>
                              <div className="font-medium">
                                {item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}
                              </div>
                              {item.notes && (
                                <div className="text-sm text-muted-foreground">{item.notes}</div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isAlreadyAssigned(item.id) ? (
                              <Badge variant="default">확정됨</Badge>
                            ) : (
                              <>
                                <Badge variant="secondary">대기중</Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteAvailabilityMutation.mutate(item.id)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* 관리자: 대기 중인 요청 */}
          {isManagerPlus && (
            <TabsContent value="pending" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    대기 중인 근무 요청
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {allAvailability.filter(a => !isAlreadyAssigned(a.id)).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      대기 중인 요청이 없습니다
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {allAvailability
                        .filter(a => !isAlreadyAssigned(a.id))
                        .map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-4 border rounded-lg"
                          >
                            <div className="flex items-center gap-4">
                              <div className="text-center min-w-[60px]">
                                <div className="text-sm text-muted-foreground">
                                  {format(new Date(item.work_date), 'EEE', { locale: ko })}
                                </div>
                                <div className="text-lg font-semibold">
                                  {format(new Date(item.work_date), 'M/d')}
                                </div>
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">
                                    {item.profile?.full_name || item.profile?.email}
                                  </span>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}
                                  {item.notes && ` · ${item.notes}`}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleOpenAssignDialog(item)}
                              >
                                <Check className="mr-1 h-4 w-4" />
                                확정
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteAvailabilityMutation.mutate(item.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* 확정된 스케줄 */}
          <TabsContent value="confirmed" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  확정된 스케줄
                </CardTitle>
              </CardHeader>
              <CardContent>
                {assignments.filter(a => a.status === 'confirmed').length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    확정된 스케줄이 없습니다
                  </div>
                ) : (
                  <div className="space-y-3">
                    {assignments
                      .filter(a => a.status === 'confirmed')
                      .map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-4 border rounded-lg bg-primary/5"
                        >
                          <div className="flex items-center gap-4">
                            <div className="text-center min-w-[60px]">
                              <div className="text-sm text-muted-foreground">
                                {format(new Date(item.work_date), 'EEE', { locale: ko })}
                              </div>
                              <div className="text-lg font-semibold">
                                {format(new Date(item.work_date), 'M/d')}
                              </div>
                            </div>
                            <div>
                              {isManagerPlus && (
                                <div className="flex items-center gap-2 mb-1">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{item.profile?.full_name}</span>
                                </div>
                              )}
                              <div className="text-sm">
                                {item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}
                              </div>
                              {item.client && (
                                <div className="text-sm text-muted-foreground">
                                  고객사: {item.client.name}
                                </div>
                              )}
                              {item.notes && (
                                <div className="text-sm text-muted-foreground">{item.notes}</div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="default">확정</Badge>
                            {isManagerPlus && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => cancelAssignmentMutation.mutate(item.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 캘린더 보기 */}
          <TabsContent value="calendar" className="space-y-4">
            <div className="grid gap-6 md:grid-cols-[300px_1fr]">
              <Card>
                <CardContent className="pt-6">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    locale={ko}
                    modifiers={{
                      hasAvailability: (date) => hasAvailabilityOnDate(date),
                      hasAssignment: (date) => hasAssignmentOnDate(date),
                    }}
                    modifiersStyles={{
                      hasAvailability: { backgroundColor: 'hsl(var(--primary) / 0.1)' },
                      hasAssignment: { backgroundColor: 'hsl(var(--primary) / 0.3)', fontWeight: 'bold' },
                    }}
                  />
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-primary/10" />
                      <span>등록된 가용 시간</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-primary/30" />
                      <span>확정된 스케줄</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    {format(selectedDate, 'yyyy년 M월 d일 (EEE)', { locale: ko })}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {getAvailabilityForDate(selectedDate).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      해당 날짜에 등록된 스케줄이 없습니다
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {getAvailabilityForDate(selectedDate).map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div>
                            {isManagerPlus && (
                              <div className="font-medium mb-1">
                                {item.profile?.full_name || item.profile?.email}
                              </div>
                            )}
                            <div className="text-sm">
                              {item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}
                            </div>
                            {item.notes && (
                              <div className="text-sm text-muted-foreground">{item.notes}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {isAlreadyAssigned(item.id) ? (
                              <Badge variant="default">확정됨</Badge>
                            ) : (
                              <>
                                <Badge variant="secondary">대기중</Badge>
                                {isManagerPlus && (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => handleOpenAssignDialog(item)}
                                  >
                                    <Check className="mr-1 h-4 w-4" />
                                    확정
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* 근무 가능 시간 등록 다이얼로그 */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>근무 가능 시간 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>날짜</Label>
              <Input
                type="date"
                value={formData.work_date}
                onChange={(e) => setFormData(prev => ({ ...prev, work_date: e.target.value }))}
                min={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
            
            <div className="space-y-2">
              <Label>시간대 선택</Label>
              <div className="grid grid-cols-2 gap-2">
                {TIME_SLOTS.map((slot) => (
                  <Button
                    key={slot.label}
                    type="button"
                    variant={
                      formData.start_time === slot.start && formData.end_time === slot.end
                        ? 'default'
                        : 'outline'
                    }
                    onClick={() => handleTimeSlotSelect(slot)}
                    className="text-sm"
                  >
                    {slot.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>시작 시간</Label>
                <Input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>종료 시간</Label>
                <Input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>메모 (선택)</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="추가 메모를 입력하세요"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={() => addAvailabilityMutation.mutate()}>
              등록
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 스케줄 확정 다이얼로그 (관리자용) */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>스케줄 확정</DialogTitle>
          </DialogHeader>
          {selectedAvailability && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="font-medium">
                  {selectedAvailability.profile?.full_name || '상담원'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {format(new Date(selectedAvailability.work_date), 'yyyy년 M월 d일 (EEE)', { locale: ko })}
                </div>
                <div className="text-sm">
                  {selectedAvailability.start_time.slice(0, 5)} - {selectedAvailability.end_time.slice(0, 5)}
                </div>
              </div>

              <div className="space-y-2">
                <Label>담당 고객사 (선택)</Label>
                <Select
                  value={assignData.client_id}
                  onValueChange={(value) => setAssignData(prev => ({ ...prev, client_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="고객사 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">미지정</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>메모 (선택)</Label>
                <Textarea
                  value={assignData.notes}
                  onChange={(e) => setAssignData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="배정 관련 메모를 입력하세요"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={() => confirmAssignmentMutation.mutate()}>
              확정
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
