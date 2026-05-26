import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachWeekOfInterval, isWithinInterval, differenceInCalendarDays,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  DollarSign, TrendingUp, TrendingDown, FileText, AlertTriangle, Edit, Wallet, Receipt,
} from 'lucide-react';
import { computeProration } from '@/lib/billing';
import { InvoiceRecordDialog } from '@/components/dialogs/InvoiceRecordDialog';

export interface BillingRow {
  clientId: string;
  clientName: string;
  status: string;
  baseAmount: number;
  billedAmount: number;
  isProrated: boolean;
  prorateBusinessDays: number;
  totalBusinessDays: number;
  invoiceIssued: boolean;
  invoiceIssuedDate: string | null;
  isPaid: boolean;
  paidDate: string | null;
  notes: string | null;
  hasRecord: boolean;
}

interface ClientRow {
  id: string;
  name: string;
  status: string;
  monthly_fee: number | null;
  contract_start_date: string | null;
}

interface InvoiceRow {
  id: string;
  client_id: string;
  billing_month: string;
  base_amount: number;
  billed_amount: number;
  is_prorated: boolean;
  prorate_business_days: number | null;
  total_business_days: number | null;
  invoice_issued: boolean;
  invoice_issued_date: string | null;
  is_paid: boolean;
  paid_date: string | null;
  notes: string | null;
}

interface AttendanceRecord {
  user_id: string;
  work_date: string;
  total_hours: number | null;
  meal_duration: number | null;
  adjusted_hours: number | null;
  clock_out: string | null;
}

const fmtKRW = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`;

export default function Revenue() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<BillingRow | null>(null);

  const monthStart = startOfMonth(new Date(selectedMonth + '-01'));
  const monthEnd = endOfMonth(monthStart);

  const { data: clients = [] } = useQuery({
    queryKey: ['revenue-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, status, monthly_fee, contract_start_date')
        .order('name');
      if (error) throw error;
      return data as ClientRow[];
    },
    enabled: isAdmin,
  });

  const { data: monthInvoices = [] } = useQuery({
    queryKey: ['revenue-invoices', selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_invoices')
        .select('*')
        .eq('billing_month', selectedMonth);
      if (error) throw error;
      return data as InvoiceRow[];
    },
    enabled: isAdmin,
  });

  const { data: unpaidInvoices = [] } = useQuery({
    queryKey: ['revenue-unpaid'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_invoices')
        .select('*')
        .eq('is_paid', false)
        .order('billing_month', { ascending: true });
      if (error) throw error;
      return data as InvoiceRow[];
    },
    enabled: isAdmin,
  });

  const { data: payrollSettings = [] } = useQuery({
    queryKey: ['revenue-payroll-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('payroll_settings').select('user_id, hourly_rate');
      if (error) throw error;
      return data as { user_id: string; hourly_rate: number }[];
    },
    enabled: isAdmin,
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ['revenue-attendance', selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('user_id, work_date, total_hours, meal_duration, adjusted_hours, clock_out')
        .gte('work_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('work_date', format(monthEnd, 'yyyy-MM-dd'));
      if (error) throw error;
      return data as AttendanceRecord[];
    },
    enabled: isAdmin,
  });

  // 월별 청구 행 구성 (계약금액 있는 고객사 + 이미 저장된 청구 내역)
  const billingRows = useMemo<BillingRow[]>(() => {
    const invoiceByClient = new Map(monthInvoices.map((i) => [i.client_id, i]));
    const clientById = new Map(clients.map((c) => [c.id, c]));
    const rows: BillingRow[] = [];
    const included = new Set<string>();

    for (const c of clients) {
      const hasFee = (c.monthly_fee ?? 0) > 0;
      // 아직 시작 전인 계약(이번 달보다 늦게 시작)은 제외
      const notStarted =
        c.contract_start_date != null && format(new Date(c.contract_start_date), 'yyyy-MM') > selectedMonth;
      const rec = invoiceByClient.get(c.id);
      if (!hasFee && !rec) continue;
      if (notStarted && !rec) continue;

      const prorate = computeProration({
        monthlyFee: c.monthly_fee ?? 0,
        contractStartDate: c.contract_start_date,
        billingMonth: selectedMonth,
      });

      rows.push({
        clientId: c.id,
        clientName: c.name,
        status: c.status,
        baseAmount: rec ? rec.base_amount : prorate.baseAmount,
        billedAmount: rec ? rec.billed_amount : prorate.billedAmount,
        isProrated: rec ? rec.is_prorated : prorate.isProrated,
        prorateBusinessDays: rec?.prorate_business_days ?? prorate.prorateBusinessDays,
        totalBusinessDays: rec?.total_business_days ?? prorate.totalBusinessDays,
        invoiceIssued: rec ? rec.invoice_issued : false,
        invoiceIssuedDate: rec?.invoice_issued_date ?? null,
        isPaid: rec ? rec.is_paid : false,
        paidDate: rec?.paid_date ?? null,
        notes: rec?.notes ?? null,
        hasRecord: !!rec,
      });
      included.add(c.id);
    }

    // 고객사 목록 필터에서 빠졌지만 저장된 청구가 있는 경우도 표시
    for (const inv of monthInvoices) {
      if (included.has(inv.client_id)) continue;
      const c = clientById.get(inv.client_id);
      rows.push({
        clientId: inv.client_id,
        clientName: c?.name ?? '(삭제된 고객사)',
        status: c?.status ?? '-',
        baseAmount: inv.base_amount,
        billedAmount: inv.billed_amount,
        isProrated: inv.is_prorated,
        prorateBusinessDays: inv.prorate_business_days ?? 0,
        totalBusinessDays: inv.total_business_days ?? 0,
        invoiceIssued: inv.invoice_issued,
        invoiceIssuedDate: inv.invoice_issued_date,
        isPaid: inv.is_paid,
        paidDate: inv.paid_date,
        notes: inv.notes,
        hasRecord: true,
      });
    }

    return rows.sort((a, b) => a.clientName.localeCompare(b.clientName, 'ko'));
  }, [clients, monthInvoices, selectedMonth]);

  // 인건비 계산 (급여 관리와 동일 로직: 기본급 + 주휴수당)
  const laborCost = useMemo(() => {
    const completed = attendance.filter((r) => r.clock_out);
    const rateByUser = new Map(payrollSettings.map((s) => [s.user_id, s.hourly_rate]));
    const effHours = (r: AttendanceRecord) =>
      r.adjusted_hours != null ? r.adjusted_hours : r.total_hours != null ? r.total_hours - (r.meal_duration || 0) : 0;

    const userIds = Array.from(new Set(completed.map((r) => r.user_id)));
    const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { locale: ko });

    let total = 0;
    for (const uid of userIds) {
      const rate = rateByUser.get(uid) || 0;
      if (rate <= 0) continue;
      const recs = completed.filter((r) => r.user_id === uid);
      const totalHours = recs.reduce((s, r) => s + effHours(r), 0);
      let holidayPay = 0;
      for (const ws of weeks) {
        const we = endOfWeek(ws, { locale: ko });
        const wh = recs
          .filter((r) => isWithinInterval(new Date(r.work_date), { start: ws, end: we }))
          .reduce((s, r) => s + effHours(r), 0);
        if (wh >= 15) holidayPay += Math.min((wh / 40) * 8, 8) * rate;
      }
      total += totalHours * rate + holidayPay;
    }
    return total;
  }, [attendance, payrollSettings, monthStart, monthEnd]);

  const totals = useMemo(() => {
    const billed = billingRows.reduce((s, r) => s + r.billedAmount, 0);
    const withVat = Math.round(billed * 1.1);
    const paid = billingRows.filter((r) => r.isPaid).reduce((s, r) => s + Math.round(r.billedAmount * 1.1), 0);
    const unpaid = billingRows.filter((r) => !r.isPaid).reduce((s, r) => s + Math.round(r.billedAmount * 1.1), 0);
    const unpaidCount = billingRows.filter((r) => !r.isPaid).length;
    const notIssuedCount = billingRows.filter((r) => !r.invoiceIssued).length;
    return { billed, withVat, paid, unpaid, unpaidCount, notIssuedCount };
  }, [billingRows]);

  const profit = totals.billed - laborCost;
  const margin = totals.billed > 0 ? Math.round((profit / totals.billed) * 100) : 0;

  const quickUpdateMutation = useMutation({
    mutationFn: async ({ row, patch }: { row: BillingRow; patch: Partial<InvoiceRow> }) => {
      const payload = {
        client_id: row.clientId,
        billing_month: selectedMonth,
        base_amount: row.baseAmount,
        billed_amount: row.billedAmount,
        is_prorated: row.isProrated,
        prorate_business_days: row.prorateBusinessDays,
        total_business_days: row.totalBusinessDays,
        invoice_issued: row.invoiceIssued,
        invoice_issued_date: row.invoiceIssuedDate,
        is_paid: row.isPaid,
        paid_date: row.paidDate,
        notes: row.notes,
        created_by: user?.id ?? null,
        ...patch,
      };
      const { error } = await supabase
        .from('client_invoices')
        .upsert(payload, { onConflict: 'client_id,billing_month' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenue-invoices', selectedMonth] });
      queryClient.invalidateQueries({ queryKey: ['revenue-unpaid'] });
    },
    onError: (e: any) => toast.error(e.message || '저장 실패'),
  });

  const today = format(new Date(), 'yyyy-MM-dd');

  const toggleIssued = (row: BillingRow, value: boolean) =>
    quickUpdateMutation.mutate({
      row,
      patch: { invoice_issued: value, invoice_issued_date: value ? row.invoiceIssuedDate || today : null },
    });

  const togglePaid = (row: BillingRow, value: boolean) =>
    quickUpdateMutation.mutate({
      row,
      patch: { is_paid: value, paid_date: value ? row.paidDate || today : null },
    });

  const generateAllMutation = useMutation({
    mutationFn: async () => {
      const toCreate = billingRows.filter((r) => !r.hasRecord && r.billedAmount > 0);
      if (toCreate.length === 0) return 0;
      const payload = toCreate.map((r) => ({
        client_id: r.clientId,
        billing_month: selectedMonth,
        base_amount: r.baseAmount,
        billed_amount: r.billedAmount,
        is_prorated: r.isProrated,
        prorate_business_days: r.prorateBusinessDays,
        total_business_days: r.totalBusinessDays,
        created_by: user?.id ?? null,
      }));
      const { error } = await supabase
        .from('client_invoices')
        .upsert(payload, { onConflict: 'client_id,billing_month' });
      if (error) throw error;
      return toCreate.length;
    },
    onSuccess: (count) => {
      if (count === 0) toast.info('새로 생성할 청구 건이 없습니다');
      else toast.success(`${count}건의 청구 내역을 생성했습니다`);
      queryClient.invalidateQueries({ queryKey: ['revenue-invoices', selectedMonth] });
      queryClient.invalidateQueries({ queryKey: ['revenue-unpaid'] });
    },
    onError: (e: any) => toast.error(e.message || '생성 실패'),
  });

  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push({ value: format(date, 'yyyy-MM'), label: format(date, 'yyyy년 M월', { locale: ko }) });
    }
    return options;
  }, []);

  const clientNameById = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients]);

  const openEdit = (row: BillingRow) => {
    setSelectedRow(row);
    setDialogOpen(true);
  };

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">접근 권한이 없습니다</h2>
            <p className="text-muted-foreground">매출 관리는 대표만 볼 수 있습니다.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">매출 관리</h1>
          <p className="text-muted-foreground">고객사별 월 청구 · 세금계산서 · 수금 현황 · 손익</p>
        </div>

        <Tabs defaultValue="billing" className="space-y-4">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="billing">월별 청구/수금</TabsTrigger>
            <TabsTrigger value="unpaid">
              미수금 현황
              {unpaidInvoices.length > 0 && (
                <Badge variant="destructive" className="ml-2">{unpaidInvoices.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="pnl">손익 (인건비 대비)</TabsTrigger>
          </TabsList>

          {/* 월별 청구/수금 */}
          <TabsContent value="billing" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {monthOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={() => generateAllMutation.mutate()} disabled={generateAllMutation.isPending}>
                <Receipt className="mr-2 h-4 w-4" />
                이번 달 청구 일괄 생성
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <StatCard title="총 청구액 (VAT 별도)" value={fmtKRW(totals.billed)} icon={DollarSign} />
              <StatCard title="합계 (VAT 포함)" value={fmtKRW(totals.withVat)} icon={Wallet} />
              <StatCard title="수금 완료" value={fmtKRW(totals.paid)} icon={TrendingUp} valueClass="text-green-600" />
              <StatCard
                title={`미수금 (${totals.unpaidCount}건)`}
                value={fmtKRW(totals.unpaid)}
                icon={AlertTriangle}
                valueClass={totals.unpaid > 0 ? 'text-amber-600' : ''}
              />
            </div>

            <Card>
              <CardHeader><CardTitle>고객사별 청구 내역</CardTitle></CardHeader>
              <CardContent>
                {billingRows.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground">
                    이 달에 청구할 고객사가 없습니다. 고객사 관리에서 월 계약금액과 계약 시작일을 입력하세요.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>고객사</TableHead>
                        <TableHead className="text-right">월 계약금액</TableHead>
                        <TableHead className="text-right">청구액 (VAT 별도)</TableHead>
                        <TableHead className="text-right">합계 (VAT 포함)</TableHead>
                        <TableHead className="text-center">세금계산서</TableHead>
                        <TableHead className="text-center">수금</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {billingRows.map((row) => (
                        <TableRow key={row.clientId}>
                          <TableCell>
                            <div className="font-medium">{row.clientName}</div>
                            {row.isProrated && (
                              <div className="text-xs text-amber-600">
                                일할 {row.prorateBusinessDays}/{row.totalBusinessDays} 영업일
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{fmtKRW(row.baseAmount)}</TableCell>
                          <TableCell className="text-right font-medium">{fmtKRW(row.billedAmount)}</TableCell>
                          <TableCell className="text-right">{fmtKRW(Math.round(row.billedAmount * 1.1))}</TableCell>
                          <TableCell>
                            <div className="flex flex-col items-center gap-0.5">
                              <Switch checked={row.invoiceIssued} onCheckedChange={(v) => toggleIssued(row, v)} />
                              {row.invoiceIssued && row.invoiceIssuedDate && (
                                <span className="text-[10px] text-muted-foreground">{row.invoiceIssuedDate}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col items-center gap-0.5">
                              <Switch checked={row.isPaid} onCheckedChange={(v) => togglePaid(row, v)} />
                              {row.isPaid ? (
                                row.paidDate && <span className="text-[10px] text-green-600">{row.paidDate}</span>
                              ) : (
                                <span className="text-[10px] text-amber-600">미수금</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(row)} title="상세 수정">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 미수금 현황 */}
          <TabsContent value="unpaid" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  미수금 현황
                </CardTitle>
              </CardHeader>
              <CardContent>
                {unpaidInvoices.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground">미수금이 없습니다 🎉</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>고객사</TableHead>
                        <TableHead>청구월</TableHead>
                        <TableHead className="text-right">청구액 (VAT 별도)</TableHead>
                        <TableHead className="text-right">합계 (VAT 포함)</TableHead>
                        <TableHead className="text-center">세금계산서</TableHead>
                        <TableHead className="text-right">경과</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unpaidInvoices
                        .filter((inv) => inv.billed_amount > 0)
                        .map((inv) => {
                          const issuedDays = inv.invoice_issued_date
                            ? differenceInCalendarDays(new Date(), new Date(inv.invoice_issued_date))
                            : null;
                          const overdue = issuedDays != null && issuedDays > 30;
                          return (
                            <TableRow key={inv.id} className={overdue ? 'bg-destructive/5' : ''}>
                              <TableCell className="font-medium">
                                {clientNameById.get(inv.client_id) ?? '(삭제된 고객사)'}
                              </TableCell>
                              <TableCell>{inv.billing_month}</TableCell>
                              <TableCell className="text-right">{fmtKRW(inv.billed_amount)}</TableCell>
                              <TableCell className="text-right font-medium">
                                {fmtKRW(Math.round(inv.billed_amount * 1.1))}
                              </TableCell>
                              <TableCell className="text-center">
                                {inv.invoice_issued ? (
                                  <Badge variant="outline" className="gap-1">
                                    <FileText className="h-3 w-3" />발행
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">미발행</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {issuedDays != null ? (
                                  <span className={overdue ? 'font-semibold text-destructive' : 'text-muted-foreground'}>
                                    발행 +{issuedDays}일{overdue ? ' ⚠' : ''}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                )}
                <p className="mt-4 text-xs text-muted-foreground">
                  * 세금계산서 발행 후 30일이 지난 미수금은 빨간색으로 표시됩니다.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 손익 */}
          <TabsContent value="pnl" className="space-y-4">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {monthOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>

            <div className="grid gap-4 md:grid-cols-4">
              <StatCard title="매출 (VAT 별도)" value={fmtKRW(totals.billed)} icon={DollarSign} />
              <StatCard title="인건비 (급여)" value={fmtKRW(laborCost)} icon={TrendingDown} valueClass="text-amber-600" />
              <StatCard
                title="순이익"
                value={fmtKRW(profit)}
                icon={profit >= 0 ? TrendingUp : TrendingDown}
                valueClass={profit >= 0 ? 'text-green-600' : 'text-destructive'}
              />
              <StatCard title="이익률" value={`${margin}%`} icon={TrendingUp} valueClass={profit >= 0 ? 'text-green-600' : 'text-destructive'} />
            </div>

            <Card>
              <CardHeader><CardTitle>손익 요약</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell>매출 (청구액 합계, VAT 별도)</TableCell>
                      <TableCell className="text-right font-medium">{fmtKRW(totals.billed)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>(-) 인건비 (구성원 급여 합계)</TableCell>
                      <TableCell className="text-right text-amber-600">- {fmtKRW(laborCost)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-semibold">순이익</TableCell>
                      <TableCell className={`text-right text-lg font-bold ${profit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                        {fmtKRW(profit)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                <p className="mt-4 text-xs text-muted-foreground">
                  * 인건비는 급여 관리의 계산 방식(기본급 + 주휴수당)과 동일하게 해당 월 근태·시급을 기준으로 산출합니다.
                  매출은 VAT 별도 청구액 기준입니다.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <InvoiceRecordDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        row={selectedRow}
        billingMonth={selectedMonth}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['revenue-invoices', selectedMonth] });
          queryClient.invalidateQueries({ queryKey: ['revenue-unpaid'] });
        }}
      />
    </AppLayout>
  );
}

function StatCard({
  title, value, icon: Icon, valueClass = '',
}: { title: string; value: string; icon: React.ComponentType<{ className?: string }>; valueClass?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${valueClass}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
