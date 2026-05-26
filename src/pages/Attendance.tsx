import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, Users, TrendingUp, CalendarDays, UtensilsCrossed } from 'lucide-react';

interface AttendanceRecord {
  id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  meal_out: string | null;
  meal_in: string | null;
  meal_duration: number | null;
  work_date: string;
  total_hours: number | null;
  notes: string | null;
  profile?: { full_name: string; email: string };
}

export default function Attendance() {
  const { isManagerPlus } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [filterMember, setFilterMember] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'last_month' | '2months_ago' | '3months_ago' | 'last_3months'>('today');

  const getDateRange = () => {
    const today = new Date();
    switch (dateRange) {
      case 'today':
        return { start: format(today, 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') };
      case 'week':
        return { start: format(startOfWeek(today, { locale: ko }), 'yyyy-MM-dd'), end: format(endOfWeek(today, { locale: ko }), 'yyyy-MM-dd') };
      case 'month':
        return { start: format(startOfMonth(today), 'yyyy-MM-dd'), end: format(endOfMonth(today), 'yyyy-MM-dd') };
      case 'last_month': {
        const d = subMonths(today, 1);
        return { start: format(startOfMonth(d), 'yyyy-MM-dd'), end: format(endOfMonth(d), 'yyyy-MM-dd') };
      }
      case '2months_ago': {
        const d = subMonths(today, 2);
        return { start: format(startOfMonth(d), 'yyyy-MM-dd'), end: format(endOfMonth(d), 'yyyy-MM-dd') };
      }
      case '3months_ago': {
        const d = subMonths(today, 3);
        return { start: format(startOfMonth(d), 'yyyy-MM-dd'), end: format(endOfMonth(d), 'yyyy-MM-dd') };
      }
      case 'last_3months':
        return { start: format(startOfMonth(subMonths(today, 3)), 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') };
      default:
        return { start: format(today, 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') };
    }
  };

  // 근태 기록 조회
  const { data: attendanceRecords = [], isLoading } = useQuery({
    queryKey: ['attendance-records', dateRange, filterMember],
    queryFn: async () => {
      const { start, end } = getDateRange();
      
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .gte('work_date', start)
        .lte('work_date', end)
        .order('clock_in', { ascending: false });
      
      if (error) throw error;

      // 프로필 정보 별도 조회
      const userIds = [...new Set(data.map(d => d.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      let records = data.map(item => ({
        ...item,
        profile: profileMap.get(item.user_id),
      })) as AttendanceRecord[];

      if (filterMember !== 'all') {
        records = records.filter(r => r.user_id === filterMember);
      }

      return records;
    },
    enabled: isManagerPlus,
  });

  // 구성원 목록 조회
  const { data: members = [] } = useQuery({
    queryKey: ['members-for-attendance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name');
      if (error) throw error;
      return data;
    },
    enabled: isManagerPlus,
  });

  // 오늘 출근한 인원
  const todayAttendance = attendanceRecords.filter(
    r => r.work_date === format(new Date(), 'yyyy-MM-dd')
  );
  const currentlyWorking = todayAttendance.filter(r => !r.clock_out);

  // 통계 계산
  // 식사시간 제외한 실근무시간 계산
  const getEffectiveHours = (record: AttendanceRecord) => {
    if (!record.total_hours) return null;
    return record.total_hours - (record.meal_duration || 0);
  };

  const totalHoursThisRange = attendanceRecords
    .filter(r => r.total_hours)
    .reduce((sum, r) => sum + ((r.total_hours || 0) - (r.meal_duration || 0)), 0);

  const formatTime = (timestamp: string) => {
    return format(new Date(timestamp), 'HH:mm');
  };

  const formatDuration = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}시간 ${m}분`;
  };

  if (!isManagerPlus) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">접근 권한이 없습니다</h2>
            <p className="text-muted-foreground">근태관리는 관리자만 볼 수 있습니다.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">근태관리</h1>
            <p className="text-muted-foreground">상담원들의 출퇴근 기록을 확인하세요</p>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">오늘 출근</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{todayAttendance.length}명</div>
              <p className="text-xs text-muted-foreground">
                현재 근무중 {currentlyWorking.length}명
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">현재 근무중</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currentlyWorking.length}명</div>
              <p className="text-xs text-muted-foreground">
                {currentlyWorking.map(r => r.profile?.full_name).filter(Boolean).join(', ') || '-'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">총 근무시간</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDuration(totalHoursThisRange)}</div>
              <p className="text-xs text-muted-foreground">
                {dateRange === 'today' ? '오늘' : dateRange === 'week' ? '이번 주' : dateRange === 'month' ? '이번 달' : dateRange === 'last_month' ? '지난 달' : dateRange === '2months_ago' ? '2개월 전' : dateRange === '3months_ago' ? '3개월 전' : '최근 3개월'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">기록 수</CardTitle>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{attendanceRecords.length}건</div>
              <p className="text-xs text-muted-foreground">선택된 기간</p>
            </CardContent>
          </Card>
        </div>

        {/* 필터 */}
        <div className="flex gap-4 flex-wrap">
          <Select value={dateRange} onValueChange={(v: typeof dateRange) => setDateRange(v)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">오늘</SelectItem>
              <SelectItem value="week">이번 주</SelectItem>
              <SelectItem value="month">이번 달</SelectItem>
              <SelectItem value="last_month">지난 달</SelectItem>
              <SelectItem value="2months_ago">2개월 전</SelectItem>
              <SelectItem value="3months_ago">3개월 전</SelectItem>
              <SelectItem value="last_3months">최근 3개월</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterMember} onValueChange={setFilterMember}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="구성원 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 구성원</SelectItem>
              {members.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.full_name || member.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 근태 기록 테이블 */}
        <Card>
          <CardHeader>
            <CardTitle>근태 기록</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">로딩중...</div>
            ) : attendanceRecords.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                해당 기간에 근태 기록이 없습니다
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>날짜</TableHead>
                    <TableHead>구성원</TableHead>
                    <TableHead>출근</TableHead>
                    <TableHead>식사</TableHead>
                    <TableHead>복귀</TableHead>
                    <TableHead>퇴근</TableHead>
                    <TableHead>식사시간</TableHead>
                    <TableHead>실근무시간</TableHead>
                    <TableHead>상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceRecords.map((record) => {
                    const effectiveHours = getEffectiveHours(record);
                    return (
                      <TableRow key={record.id}>
                        <TableCell>
                          {format(new Date(record.work_date), 'M/d (EEE)', { locale: ko })}
                        </TableCell>
                        <TableCell className="font-medium">
                          {record.profile?.full_name || record.profile?.email || '-'}
                        </TableCell>
                        <TableCell>{formatTime(record.clock_in)}</TableCell>
                        <TableCell>
                          {record.meal_out ? formatTime(record.meal_out) : '-'}
                        </TableCell>
                        <TableCell>
                          {record.meal_in ? formatTime(record.meal_in) : '-'}
                        </TableCell>
                        <TableCell>
                          {record.clock_out ? formatTime(record.clock_out) : '-'}
                        </TableCell>
                        <TableCell>
                          {record.meal_duration ? formatDuration(record.meal_duration) : '-'}
                        </TableCell>
                        <TableCell>
                          {effectiveHours !== null ? formatDuration(effectiveHours) : '-'}
                        </TableCell>
                        <TableCell>
                          {record.clock_out ? (
                            <Badge variant="secondary">퇴근</Badge>
                          ) : record.meal_out && !record.meal_in ? (
                            <Badge variant="outline" className="border-amber-500/50 text-amber-500">
                              <UtensilsCrossed className="mr-1 h-3 w-3" />식사중
                            </Badge>
                          ) : (
                            <Badge variant="default">근무중</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
