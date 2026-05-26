import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import { Download, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';

interface WeeklyBreakdown {
  week: string;
  hours: number;
}

interface Payslip {
  id: string;
  pay_month: string;
  hourly_rate: number;
  total_hours: number;
  base_pay: number;
  weekly_holiday_pay: number;
  total_pay: number;
  weekly_breakdown: WeeklyBreakdown[] | null;
  memo: string | null;
  issued_at: string;
}

export default function Payslips() {
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  const { data: profile } = useQuery({
    queryKey: ['my-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: payslips = [], isLoading } = useQuery({
    queryKey: ['my-payslips', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payslips')
        .select('id, pay_month, hourly_rate, total_hours, base_pay, weekly_holiday_pay, total_pay, weekly_breakdown, memo, issued_at')
        .eq('user_id', user!.id)
        .order('pay_month', { ascending: false });
      if (error) throw error;
      return data as unknown as Payslip[];
    },
    enabled: !!user,
  });

  const name = profile?.full_name || profile?.email || '';

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount);

  const formatHours = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}시간 ${m}분`;
  };

  const monthLabel = (payMonth: string) =>
    format(new Date(payMonth + '-01'), 'yyyy년 M월', { locale: ko });

  const downloadExcel = (slip: Payslip) => {
    const weekly = slip.weekly_breakdown || [];
    const data = [
      [`${monthLabel(slip.pay_month)} 급여명세서`],
      [],
      ['성명', name],
      ['시급', slip.hourly_rate],
      [],
      ['주차', '근무시간(h)', '주휴수당 대상'],
      ...weekly.map(wh => [
        `${wh.week} 주`,
        Math.round(wh.hours * 10) / 10,
        wh.hours >= 15 ? 'O' : '-',
      ]),
      [],
      ['총 근무시간', Math.round(slip.total_hours * 100) / 100],
      ['기본급', slip.base_pay],
      ['주휴수당', slip.weekly_holiday_pay],
      ['총 지급액', slip.total_pay],
      [],
      [`발급일: ${format(new Date(slip.issued_at), 'yyyy년 MM월 dd일')}`],
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, '급여명세서');
    XLSX.writeFile(wb, `급여명세서_${name}_${slip.pay_month}.xlsx`);
    toast.success('급여명세서가 다운로드되었습니다');
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">급여 명세서</h1>
          <p className="text-muted-foreground">발급된 월별 급여 명세서를 확인하세요</p>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">불러오는 중...</div>
        ) : payslips.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FileText className="mx-auto mb-3 h-10 w-10 opacity-40" />
              아직 발급된 급여 명세서가 없습니다.
            </CardContent>
          </Card>
        ) : (
          <Accordion type="single" collapsible value={selectedId} onValueChange={setSelectedId} className="space-y-3">
            {payslips.map((slip) => (
              <AccordionItem key={slip.id} value={slip.id} className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex flex-1 items-center justify-between pr-4">
                    <span className="font-semibold">{monthLabel(slip.pay_month)}</span>
                    <span className="text-primary font-bold">{formatCurrency(slip.total_pay)}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <SummaryItem label="시급" value={slip.hourly_rate > 0 ? formatCurrency(slip.hourly_rate) : '-'} />
                      <SummaryItem label="총 근무시간" value={formatHours(slip.total_hours)} />
                      <SummaryItem label="기본급" value={formatCurrency(slip.base_pay)} />
                      <SummaryItem
                        label="주휴수당"
                        value={slip.weekly_holiday_pay > 0 ? formatCurrency(slip.weekly_holiday_pay) : '-'}
                      />
                    </div>

                    {slip.weekly_breakdown && slip.weekly_breakdown.length > 0 && (
                      <div>
                        <p className="mb-2 text-sm font-medium">주차별 근무시간</p>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>주차</TableHead>
                              <TableHead className="text-right">근무시간</TableHead>
                              <TableHead className="text-center">주휴수당</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {slip.weekly_breakdown.map((wh, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{wh.week} 주</TableCell>
                                <TableCell className="text-right">{wh.hours.toFixed(1)}h</TableCell>
                                <TableCell className="text-center">
                                  {wh.hours >= 15 ? <span className="text-green-600">대상</span> : '-'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {slip.memo && (
                      <div className="rounded-md bg-muted p-3 text-sm">
                        <span className="font-medium">메모: </span>
                        {slip.memo}
                      </div>
                    )}

                    <div className="flex items-center justify-between border-t pt-3">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          발급일: {format(new Date(slip.issued_at), 'yyyy년 MM월 dd일')}
                        </p>
                        <p className="text-lg font-bold text-primary">
                          총 지급액 {formatCurrency(slip.total_pay)}
                        </p>
                      </div>
                      <Button variant="outline" onClick={() => downloadExcel(slip)}>
                        <Download className="mr-2 h-4 w-4" />
                        다운로드
                      </Button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </AppLayout>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
