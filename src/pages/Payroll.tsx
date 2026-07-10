import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachWeekOfInterval, isWithinInterval } from 'date-fns';
import { ko } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign, Clock, Users, Calculator, Settings, Edit, Download, FileText, MessageSquare, Check, X, Send, BadgeCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import * as XLSX from 'xlsx';

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
  adjusted_hours: number | null;
}

interface PayrollSetting {
  id: string;
  user_id: string;
  hourly_rate: number;
  effective_from: string;
  notes: string | null;
  training_start_date: string | null;
  training_end_date: string | null;
  training_hourly_rate: number | null;
}

interface MemberPayroll {
  userId: string;
  name: string;
  email: string;
  hourlyRate: number;
  totalHours: number;
  regularHours: number;
  trainingHours: number;
  nightHours: number;
  nightPremium: number;
  weeklyHours: { week: string; hours: number }[];
  weeklyHolidayPay: number;
  basePay: number;
  regularBasePay: number;
  trainingBasePay: number;
  totalPay: number;
  trainingStart: string | null;
  trainingEnd: string | null;
  trainingRate: number | null;
  memo: string | null;
}

export default function Payroll() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [isSettingDialogOpen, setIsSettingDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string; hourlyRate: number } | null>(null);
  const [hourlyRateInput, setHourlyRateInput] = useState('');
  const [trainingStartInput, setTrainingStartInput] = useState('');
  const [trainingEndInput, setTrainingEndInput] = useState('');
  const [trainingRateInput, setTrainingRateInput] = useState('');
  const [editingMemo, setEditingMemo] = useState<string | null>(null);
  const [memoInput, setMemoInput] = useState('');
  const [detailMember, setDetailMember] = useState<string>('all');

  const monthStart = startOfMonth(new Date(selectedMonth + '-01'));
  const monthEnd = endOfMonth(monthStart);

  const { data: members = [] } = useQuery({
    queryKey: ['members-for-payroll'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name');
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const { data: payrollSettings = [] } = useQuery({
    queryKey: ['payroll-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_settings')
        .select('*')
        .order('effective_from', { ascending: false });
      if (error) throw error;
      return data as PayrollSetting[];
    },
    enabled: isAdmin,
  });

  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ['attendance-for-payroll', selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .gte('work_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('work_date', format(monthEnd, 'yyyy-MM-dd'))
        .order('work_date', { ascending: true })
        .order('clock_in', { ascending: true });
      if (error) throw error;
      return data as AttendanceRecord[];
    },
    enabled: isAdmin,
  });

  const { data: issuedPayslips = [] } = useQuery({
    queryKey: ['payslips-issued', selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payslips')
        .select('user_id, issued_at')
        .eq('pay_month', selectedMonth);
      if (error) throw error;
      return data as { user_id: string; issued_at: string }[];
    },
    enabled: isAdmin,
  });

  const issuedMap = useMemo(() => {
    const m = new Map<string, string>();
    issuedPayslips.forEach(p => m.set(p.user_id, p.issued_at));
    return m;
  }, [issuedPayslips]);

  const completedRecords = useMemo(
    () => attendanceRecords.filter(r => r.clock_out || r.adjusted_hours != null),
    [attendanceRecords],
  );

  const detailRecords = useMemo(() => {
    if (detailMember === 'all') return attendanceRecords;
    return attendanceRecords.filter(r => r.user_id === detailMember);
  }, [attendanceRecords, detailMember]);

  // 보정시간 저장 mutation
  const updateAdjustedHoursMutation = useMutation({
    mutationFn: async ({ recordId, adjustedHours }: { recordId: string; adjustedHours: number | null }) => {
      const { error } = await supabase
        .from('attendance_records')
        .update({ adjusted_hours: adjustedHours })
        .eq('id', recordId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-for-payroll'] });
      toast.success('보정시간이 저장되었습니다');
    },
    onError: (error: any) => {
      toast.error(error.message || '보정시간 저장 실패');
    },
  });

  const savePayrollSettingMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMember || !hourlyRateInput) return;
      const trainingFields = {
        training_start_date: trainingStartInput || null,
        training_end_date: trainingEndInput || null,
        training_hourly_rate: trainingRateInput ? parseFloat(trainingRateInput) : null,
      };
      const existingSetting = payrollSettings.find(s => s.user_id === selectedMember.id);
      if (existingSetting) {
        const { error } = await supabase
          .from('payroll_settings')
          .update({ hourly_rate: parseFloat(hourlyRateInput), ...trainingFields })
          .eq('id', existingSetting.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('payroll_settings')
          .insert({ user_id: selectedMember.id, hourly_rate: parseFloat(hourlyRateInput), created_by: user?.id, ...trainingFields });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-settings'] });
      toast.success('시급이 저장되었습니다');
      setIsSettingDialogOpen(false);
      setSelectedMember(null);
      setHourlyRateInput('');
      setTrainingStartInput('');
      setTrainingEndInput('');
      setTrainingRateInput('');
    },
    onError: (error: any) => {
      toast.error(error.message || '저장 실패');
    },
  });

  // 실제 적용 시간: adjusted_hours가 있으면 그것 사용, 없으면 total_hours - meal_duration
  const getEffectiveHours = (record: AttendanceRecord): number => {
    if (record.adjusted_hours != null) return record.adjusted_hours;
    if (record.total_hours != null) return record.total_hours - (record.meal_duration || 0);
    return 0;
  };

  // 22:00~다음날 06:00 야간 시간대와 겹치는 시간(hours)
  const nightOverlapHours = (startISO: string, endISO: string): number => {
    const start = new Date(startISO);
    const end = new Date(endISO);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return 0;
    let total = 0;
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    const lastDay = new Date(end);
    lastDay.setHours(0, 0, 0, 0);
    while (cursor <= lastDay) {
      const ns = new Date(cursor); ns.setHours(22, 0, 0, 0);
      const ne = new Date(cursor); ne.setDate(ne.getDate() + 1); ne.setHours(6, 0, 0, 0);
      const oStart = Math.max(ns.getTime(), start.getTime());
      const oEnd = Math.min(ne.getTime(), end.getTime());
      if (oEnd > oStart) total += (oEnd - oStart) / 3_600_000;
      cursor.setDate(cursor.getDate() + 1);
    }
    return total;
  };

  // 근무 기록 하나에서 야간 근무시간(식사시간 야간 부분 제외, 보정시간 비율로 스케일)
  const nightHoursForRecord = (r: AttendanceRecord): number => {
    if (!r.clock_in || !r.clock_out) return 0;
    const effective = getEffectiveHours(r);
    if (effective <= 0) return 0;
    const rawShift = (new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime()) / 3_600_000 - (r.meal_duration || 0);
    if (rawShift <= 0) return 0;
    let rawNight = nightOverlapHours(r.clock_in, r.clock_out);
    if (r.meal_out && r.meal_in) rawNight -= nightOverlapHours(r.meal_out, r.meal_in);
    if (rawNight <= 0) return 0;
    const scaled = rawNight * (effective / rawShift);
    return Math.max(0, Math.min(scaled, effective));
  };

  // 급여 계산 (보정시간 + 교육기간 시급 반영)
  const memberPayrolls = useMemo<MemberPayroll[]>(() => {
    return members.map(member => {
      const memberRecords = completedRecords.filter(r => r.user_id === member.id);
      const setting = payrollSettings.find(s => s.user_id === member.id);
      const hourlyRate = setting?.hourly_rate || 0;
      const trainingStart = setting?.training_start_date || null;
      const trainingEnd = setting?.training_end_date || null;
      const trainingRate = setting?.training_hourly_rate ?? null;

      const inTraining = (workDate: string) =>
        !!(trainingStart && trainingEnd && trainingRate != null &&
           workDate >= trainingStart && workDate <= trainingEnd);
      const rateFor = (workDate: string) => (inTraining(workDate) ? (trainingRate as number) : hourlyRate);

      let regularHours = 0;
      let trainingHours = 0;
      let regularBasePay = 0;
      let trainingBasePay = 0;
      let nightHours = 0;
      let nightPremium = 0;
      for (const r of memberRecords) {
        const h = getEffectiveHours(r);
        const rate = inTraining(r.work_date) ? (trainingRate as number) : hourlyRate;
        const nh = nightHoursForRecord(r);
        nightHours += nh;
        nightPremium += nh * rate * 0.5;
        if (inTraining(r.work_date)) {
          trainingHours += h;
          trainingBasePay += h * (trainingRate as number);
        } else {
          regularHours += h;
          regularBasePay += h * hourlyRate;
        }
      }
      const totalHours = regularHours + trainingHours;
      const basePay = regularBasePay + trainingBasePay;

      const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { locale: ko });
      const weeklyDetail = weeks.map(weekStart => {
        const weekEnd = endOfWeek(weekStart, { locale: ko });
        const weekRecords = memberRecords.filter(r =>
          isWithinInterval(new Date(r.work_date), { start: weekStart, end: weekEnd })
        );
        const hours = weekRecords.reduce((sum, r) => sum + getEffectiveHours(r), 0);
        return { weekStart, weekRecords, hours };
      });

      let weeklyHolidayPay = 0;
      for (const wd of weeklyDetail) {
        if (wd.hours >= 15) {
          // 해당 주에 적용된 시급의 가중평균으로 주휴수당 계산
          const weekPay = wd.weekRecords.reduce(
            (s, r) => s + getEffectiveHours(r) * rateFor(r.work_date), 0
          );
          const avgRate = wd.hours > 0 ? weekPay / wd.hours : 0;
          const holidayHours = Math.min((wd.hours / 40) * 8, 8);
          weeklyHolidayPay += holidayHours * avgRate;
        }
      }

      const totalPay = basePay + weeklyHolidayPay + nightPremium;

      return {
        userId: member.id,
        name: member.full_name || member.email,
        email: member.email,
        hourlyRate,
        totalHours,
        regularHours,
        trainingHours,
        nightHours,
        nightPremium,
        weeklyHours: weeklyDetail.map(wd => ({
          week: format(wd.weekStart, 'M/d', { locale: ko }),
          hours: wd.hours,
        })),
        weeklyHolidayPay,
        basePay,
        regularBasePay,
        trainingBasePay,
        totalPay,
        trainingStart,
        trainingEnd,
        trainingRate,
        memo: setting?.notes || null,
      };
    }).filter(m => m.totalHours > 0);
  }, [members, completedRecords, payrollSettings, monthStart, monthEnd]);

  const totals = useMemo(() => {
    return memberPayrolls.reduce(
      (acc, m) => ({
        totalHours: acc.totalHours + m.totalHours,
        basePay: acc.basePay + m.basePay,
        weeklyHolidayPay: acc.weeklyHolidayPay + m.weeklyHolidayPay,
        nightHours: acc.nightHours + m.nightHours,
        nightPremium: acc.nightPremium + m.nightPremium,
        totalPay: acc.totalPay + m.totalPay,
      }),
      { totalHours: 0, basePay: 0, weeklyHolidayPay: 0, nightHours: 0, nightPremium: 0, totalPay: 0 }
    );
  }, [memberPayrolls]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount);
  };

  const formatHours = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}시간 ${m}분`;
  };

  const openSettingDialog = (member: { id: string; name: string; hourlyRate: number }) => {
    setSelectedMember(member);
    setHourlyRateInput(member.hourlyRate > 0 ? member.hourlyRate.toString() : '');
    const existing = payrollSettings.find(s => s.user_id === member.id);
    setTrainingStartInput(existing?.training_start_date || '');
    setTrainingEndInput(existing?.training_end_date || '');
    setTrainingRateInput(existing?.training_hourly_rate != null ? String(existing.training_hourly_rate) : '');
    setIsSettingDialogOpen(true);
  };

  const saveMemoMutation = useMutation({
    mutationFn: async ({ userId, memo }: { userId: string; memo: string }) => {
      const existingSetting = payrollSettings.find(s => s.user_id === userId);
      if (existingSetting) {
        const { error } = await supabase
          .from('payroll_settings')
          .update({ notes: memo || null })
          .eq('id', existingSetting.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('payroll_settings')
          .insert({ user_id: userId, hourly_rate: 0, notes: memo || null, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-settings'] });
      toast.success('메모가 저장되었습니다');
      setEditingMemo(null);
    },
    onError: (error: any) => {
      toast.error(error.message || '메모 저장 실패');
    },
  });

  const buildPayslipRow = (member: MemberPayroll) => ({
    user_id: member.userId,
    pay_month: selectedMonth,
    hourly_rate: member.hourlyRate,
    total_hours: Math.round(member.totalHours * 100) / 100,
    base_pay: Math.round(member.basePay),
    weekly_holiday_pay: Math.round(member.weeklyHolidayPay),
    total_pay: Math.round(member.totalPay),
    weekly_breakdown: member.weeklyHours,
    memo: member.memo,
    issued_by: user?.id ?? null,
    issued_at: new Date().toISOString(),
  });

  const issuePayslipMutation = useMutation({
    mutationFn: async (member: MemberPayroll) => {
      const { error } = await supabase
        .from('payslips')
        .upsert(buildPayslipRow(member), { onConflict: 'user_id,pay_month' });
      if (error) throw error;
    },
    onSuccess: (_, member) => {
      queryClient.invalidateQueries({ queryKey: ['payslips-issued'] });
      toast.success(`${member.name}님의 급여명세서가 발급되었습니다`);
    },
    onError: (error: any) => {
      toast.error(error.message || '명세서 발급 실패');
    },
  });

  const issueAllMutation = useMutation({
    mutationFn: async () => {
      if (memberPayrolls.length === 0) return;
      const rows = memberPayrolls.map(buildPayslipRow);
      const { error } = await supabase
        .from('payslips')
        .upsert(rows, { onConflict: 'user_id,pay_month' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payslips-issued'] });
      toast.success(`${memberPayrolls.length}명의 급여명세서가 발급되었습니다`);
    },
    onError: (error: any) => {
      toast.error(error.message || '명세서 발급 실패');
    },
  });

  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push({
        value: format(date, 'yyyy-MM'),
        label: format(date, 'yyyy년 M월', { locale: ko }),
      });
    }
    return options;
  }, []);

  // 전체 리포트 엑셀 다운로드
  const downloadAllExcel = () => {
    const monthLabel = format(new Date(selectedMonth + '-01'), 'yyyy년 M월', { locale: ko });

    // 요약 시트
    const summaryData = [
      ['항목', '금액'],
      ['총 근무시간', formatHours(totals.totalHours)],
      ['  · 야간 근무시간', formatHours(totals.nightHours)],
      ['기본급 합계', totals.basePay],
      ['주휴수당 합계', totals.weeklyHolidayPay],
      ['야간수당 합계 (0.5배 가산)', totals.nightPremium],
      ['총 급여', totals.totalPay],
    ];

    // 구성원별 시트
    const detailData = [
      ['구성원', '이메일', '시급', '총 근무시간(h)', '야간시간(h)', '기본급', '주휴수당', '야간수당', '총 급여', '메모'],
      ...memberPayrolls.map(m => [
        m.name,
        m.email,
        m.hourlyRate,
        Math.round(m.totalHours * 100) / 100,
        Math.round(m.nightHours * 100) / 100,
        m.basePay,
        m.weeklyHolidayPay,
        Math.round(m.nightPremium),
        m.totalPay,
        m.memo || '',
      ]),
    ];

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    const ws2 = XLSX.utils.aoa_to_sheet(detailData);
    XLSX.utils.book_append_sheet(wb, ws1, '요약');
    XLSX.utils.book_append_sheet(wb, ws2, '구성원별 급여');
    XLSX.writeFile(wb, `급여리포트_${selectedMonth}.xlsx`);
    toast.success('엑셀 파일이 다운로드되었습니다');
  };

  // 개인 급여명세서 엑셀 다운로드
  const downloadIndividualExcel = (member: MemberPayroll) => {
    const monthLabel = format(new Date(selectedMonth + '-01'), 'yyyy년 M월', { locale: ko });

    const hasTrainingSetting = member.trainingRate != null && member.trainingStart && member.trainingEnd;
    const hasTrainingHours = member.trainingHours > 0;
    const round2 = (n: number) => Math.round(n * 100) / 100;

    const data: (string | number)[][] = [
      [`${monthLabel} 급여명세서`],
      [],
      ['성명', member.name],
      ['이메일', member.email],
      ['시급 (일반)', member.hourlyRate],
    ];
    if (hasTrainingSetting) {
      data.push(['교육 기간', `${member.trainingStart} ~ ${member.trainingEnd}`]);
      data.push(['시급 (교육)', member.trainingRate as number]);
    }
    data.push([]);
    data.push(['주차', '근무시간(h)', '주휴수당 대상']);
    member.weeklyHours.forEach(wh => {
      data.push([`${wh.week} 주`, Math.round(wh.hours * 10) / 10, wh.hours >= 15 ? 'O' : '-']);
    });
    data.push([]);
    data.push(['총 근무시간', round2(member.totalHours)]);
    if (hasTrainingHours) {
      data.push(['  · 일반 근무시간', round2(member.regularHours)]);
      data.push(['  · 교육 근무시간', round2(member.trainingHours)]);
    }
    if (member.nightHours > 0) {
      data.push(['  · 야간 근무시간 (22:00~06:00)', round2(member.nightHours)]);
    }
    data.push(['기본급', member.basePay]);
    if (hasTrainingHours) {
      data.push(['  · 일반기간 기본급', member.regularBasePay]);
      data.push(['  · 교육기간 기본급', member.trainingBasePay]);
    }
    data.push(['주휴수당', member.weeklyHolidayPay]);
    if (member.nightPremium > 0) {
      data.push(['야간수당 (야간 근무시간 × 시급 × 0.5)', Math.round(member.nightPremium)]);
    }
    data.push(['총 지급액', member.totalPay]);
    data.push([]);
    data.push([`발급일: ${format(new Date(), 'yyyy년 MM월 dd일')}`]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, '급여명세서');
    XLSX.writeFile(wb, `급여명세서_${member.name}_${selectedMonth}.xlsx`);
    toast.success(`${member.name}님의 급여명세서가 다운로드되었습니다`);
  };

  // 보정시간 드롭다운 옵션 (30분 단위)
  const adjustedHoursOptions = [
    { value: 'auto', label: '자동' },
    ...Array.from({ length: 24 }, (_, i) => {
      const hours = (i + 1) * 0.5;
      const label = Number.isInteger(hours) ? `${hours}시간` : `${Math.floor(hours)}시간 30분`;
      return { value: String(hours), label };
    }),
  ];

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">접근 권한이 없습니다</h2>
            <p className="text-muted-foreground">급여 관리는 대표만 볼 수 있습니다.</p>
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
            <h1 className="text-3xl font-bold tracking-tight">급여 관리</h1>
            <p className="text-muted-foreground">월별 근무시간과 급여를 확인하세요</p>
          </div>
        </div>

        <Tabs defaultValue="report" className="space-y-4">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="report">월별 급여 리포트</TabsTrigger>
            <TabsTrigger value="detail">근태 상세</TabsTrigger>
            <TabsTrigger value="settings">시급 설정</TabsTrigger>
          </TabsList>

          {/* 월별 급여 리포트 */}
          <TabsContent value="report" className="space-y-4">
            <div className="flex gap-4 flex-wrap justify-between">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" onClick={() => issueAllMutation.mutate()} disabled={memberPayrolls.length === 0 || issueAllMutation.isPending}>
                  <Send className="mr-2 h-4 w-4" />
                  이번 달 전체 발급
                </Button>
                <Button onClick={downloadAllExcel} disabled={memberPayrolls.length === 0}>
                  <Download className="mr-2 h-4 w-4" />
                  전체 리포트 엑셀 다운로드
                </Button>
              </div>
            </div>

            {/* 통계 카드 */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">총 근무시간</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatHours(totals.totalHours)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">기본급 합계</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(totals.basePay)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">주휴수당 합계</CardTitle>
                  <Calculator className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(totals.weeklyHolidayPay)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">총 급여</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">{formatCurrency(totals.totalPay)}</div>
                </CardContent>
              </Card>
            </div>

            {/* 급여 테이블 */}
            <Card>
              <CardHeader>
                <CardTitle>구성원별 급여 내역</CardTitle>
              </CardHeader>
              <CardContent>
                {memberPayrolls.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    해당 월에 근무 기록이 없습니다
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>구성원</TableHead>
                        <TableHead className="text-right">시급</TableHead>
                        <TableHead className="text-right">총 근무시간</TableHead>
                        <TableHead className="text-right">기본급</TableHead>
                        <TableHead className="text-right">주휴수당</TableHead>
                        <TableHead className="text-right">총 급여</TableHead>
                        <TableHead>메모</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {memberPayrolls.map((member) => (
                        <TableRow key={member.userId}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{member.name}</div>
                              <div className="text-xs text-muted-foreground">{member.email}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {member.hourlyRate > 0 ? formatCurrency(member.hourlyRate) : '-'}
                            {member.trainingHours > 0 && member.trainingRate != null && (
                              <div className="text-xs text-muted-foreground">
                                교육 {formatCurrency(member.trainingRate)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatHours(member.totalHours)}
                            {member.trainingHours > 0 && (
                              <div className="text-xs text-muted-foreground">
                                교육 {formatHours(member.trainingHours)}
                              </div>
                            )}
                            {member.nightHours > 0 && (
                              <div className="text-xs text-indigo-600">
                                야간 {formatHours(member.nightHours)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(member.basePay)}</TableCell>
                          <TableCell className="text-right">
                            {member.weeklyHolidayPay > 0 ? (
                              <span className="text-green-600">{formatCurrency(member.weeklyHolidayPay)}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                            {member.nightPremium > 0 && (
                              <div className="text-xs text-indigo-600">
                                야간수당 +{formatCurrency(member.nightPremium)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            {editingMemo === member.userId ? (
                              <div className="flex items-start gap-1">
                                <Textarea
                                  value={memoInput}
                                  onChange={(e) => setMemoInput(e.target.value)}
                                  className="min-h-[60px] text-xs"
                                  placeholder="메모 입력..."
                                  autoFocus
                                />
                                <div className="flex flex-col gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7"
                                    onClick={() => saveMemoMutation.mutate({ userId: member.userId, memo: memoInput })}>
                                    <Check className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7"
                                    onClick={() => setEditingMemo(null)}>
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div
                                className="cursor-pointer hover:bg-muted rounded p-1 text-xs min-h-[24px]"
                                onClick={() => { setEditingMemo(member.userId); setMemoInput(member.memo || ''); }}
                                title="클릭하여 메모 편집"
                              >
                                {member.memo || <span className="text-muted-foreground italic">메모 추가...</span>}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(member.totalPay)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {issuedMap.has(member.userId) && (
                                <Badge variant="secondary" className="gap-1 text-green-600" title={`발급일: ${format(new Date(issuedMap.get(member.userId)!), 'yyyy-MM-dd HH:mm')}`}>
                                  <BadgeCheck className="h-3 w-3" />
                                  발급됨
                                </Badge>
                              )}
                              <Button
                                variant={issuedMap.has(member.userId) ? 'ghost' : 'default'}
                                size="sm"
                                onClick={() => issuePayslipMutation.mutate(member)}
                                disabled={issuePayslipMutation.isPending}
                                title={issuedMap.has(member.userId) ? '재발급' : '급여명세서 발급'}
                              >
                                <Send className="h-4 w-4 sm:mr-1" />
                                <span className="hidden sm:inline">{issuedMap.has(member.userId) ? '재발급' : '발급'}</span>
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => downloadIndividualExcel(member)} title="급여명세서 다운로드">
                                <FileText className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm"
                                onClick={() => openSettingDialog({ id: member.userId, name: member.name, hourlyRate: member.hourlyRate })}
                                title="시급 설정">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* 주별 상세 */}
            {memberPayrolls.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>주별 근무시간 상세</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>구성원</TableHead>
                        {memberPayrolls[0]?.weeklyHours.map((wh, idx) => (
                          <TableHead key={idx} className="text-center">{wh.week}~</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {memberPayrolls.map((member) => (
                        <TableRow key={member.userId}>
                          <TableCell className="font-medium">{member.name}</TableCell>
                          {member.weeklyHours.map((wh, idx) => (
                            <TableCell key={idx} className="text-center">
                              {wh.hours > 0 ? (
                                <div>
                                  <div>{wh.hours.toFixed(1)}h</div>
                                  {wh.hours >= 15 && <div className="text-xs text-green-600">주휴✓</div>}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <p className="text-xs text-muted-foreground mt-4">
                    * 주 15시간 이상 근무 시 주휴수당이 발생합니다. 주휴수당 = (주간 근무시간 / 40) × 8시간 × 시급
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* 근태 상세 */}
          <TabsContent value="detail" className="space-y-4">
            <div className="flex gap-4 flex-wrap">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={detailMember} onValueChange={setDetailMember}>
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

            <Card>
              <CardHeader>
                <CardTitle>출퇴근 및 식사 상세 기록</CardTitle>
              </CardHeader>
              <CardContent>
                {detailRecords.length === 0 ? (
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
                        <TableHead>식사 시작</TableHead>
                        <TableHead>식사 복귀</TableHead>
                        <TableHead>식사시간</TableHead>
                        <TableHead>퇴근</TableHead>
                        <TableHead>실근무시간</TableHead>
                        <TableHead>보정시간</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailRecords.map((record) => {
                        const memberProfile = members.find(m => m.id === record.user_id);
                        const autoEffective = record.total_hours != null
                          ? record.total_hours - (record.meal_duration || 0)
                          : null;
                        return (
                          <TableRow key={record.id}>
                            <TableCell>
                              {format(new Date(record.work_date), 'M/d (EEE)', { locale: ko })}
                            </TableCell>
                            <TableCell className="font-medium">
                              {memberProfile?.full_name || memberProfile?.email || '-'}
                            </TableCell>
                            <TableCell>{format(new Date(record.clock_in), 'HH:mm')}</TableCell>
                            <TableCell>
                              {record.meal_out ? format(new Date(record.meal_out), 'HH:mm') : '-'}
                            </TableCell>
                            <TableCell>
                              {record.meal_in ? format(new Date(record.meal_in), 'HH:mm') : '-'}
                            </TableCell>
                            <TableCell>
                              {record.meal_duration ? formatHours(record.meal_duration) : '-'}
                            </TableCell>
                            <TableCell>
                              {record.clock_out ? format(new Date(record.clock_out), 'HH:mm') : '-'}
                            </TableCell>
                            <TableCell>
                              {autoEffective != null ? formatHours(autoEffective) : '-'}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={record.adjusted_hours != null ? String(record.adjusted_hours) : 'auto'}
                                onValueChange={(val) => {
                                  const adjustedHours = val === 'auto' ? null : parseFloat(val);
                                  updateAdjustedHoursMutation.mutate({ recordId: record.id, adjustedHours });
                                }}
                              >
                                <SelectTrigger className="w-[100px] h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {adjustedHoursOptions.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
                <p className="text-xs text-muted-foreground mt-4">
                  * 보정시간을 선택하면 해당 일의 근무시간이 선택한 값으로 급여 계산에 반영됩니다. '자동'은 실제 출퇴근 기록 기반으로 계산합니다.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 시급 설정 */}
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  구성원별 시급 설정
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>구성원</TableHead>
                      <TableHead>이메일</TableHead>
                      <TableHead className="text-right">시급</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => {
                      const setting = payrollSettings.find(s => s.user_id === member.id);
                      return (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">{member.full_name || '-'}</TableCell>
                          <TableCell>{member.email}</TableCell>
                          <TableCell className="text-right">
                            {setting ? formatCurrency(setting.hourly_rate) : '-'}
                          </TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm"
                              onClick={() => openSettingDialog({
                                id: member.id,
                                name: member.full_name || member.email,
                                hourlyRate: setting?.hourly_rate || 0,
                              })}>
                              <Edit className="mr-2 h-4 w-4" />
                              설정
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* 시급 설정 다이얼로그 */}
      <Dialog open={isSettingDialogOpen} onOpenChange={setIsSettingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>시급 설정</DialogTitle>
          </DialogHeader>
          {selectedMember && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="font-medium">{selectedMember.name}</div>
              </div>
              <div className="space-y-2">
                <Label>시급 (원)</Label>
                <Input type="number" value={hourlyRateInput} onChange={(e) => setHourlyRateInput(e.target.value)} placeholder="예: 10000" />
                <p className="text-xs text-muted-foreground">2024년 최저시급: 9,860원</p>
              </div>

              <div className="space-y-2 rounded-md border p-3">
                <Label className="text-sm">교육 기간 (선택)</Label>
                <p className="text-xs text-muted-foreground">교육 기간 내 근무일은 아래의 교육 시급으로 계산됩니다.</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">시작일</Label>
                    <Input type="date" value={trainingStartInput} onChange={(e) => setTrainingStartInput(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">종료일</Label>
                    <Input type="date" value={trainingEndInput} onChange={(e) => setTrainingEndInput(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">교육 시급 (원)</Label>
                  <Input type="number" value={trainingRateInput} onChange={(e) => setTrainingRateInput(e.target.value)} placeholder="예: 9860" />
                </div>
                {(trainingStartInput || trainingEndInput || trainingRateInput) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => { setTrainingStartInput(''); setTrainingEndInput(''); setTrainingRateInput(''); }}
                  >
                    교육 기간 지우기
                  </Button>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingDialogOpen(false)}>취소</Button>
            <Button onClick={() => savePayrollSettingMutation.mutate()} disabled={!hourlyRateInput}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
