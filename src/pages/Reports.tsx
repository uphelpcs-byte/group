import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';
import { Download, TrendingUp, Users, MessageSquare, Building2, FileDown, Mail, RefreshCw, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfDay, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { toast } from 'sonner';
import {
  buildWeeklyReportHtml,
  buildInvoiceHtml,
  type WeeklyStats,
  type ReportSettings,
} from '@/lib/reportTemplates';

interface DailyStats { date: string; consultations: number; tasks: number; }
interface StatusDistribution { name: string; value: number; color: string; }
interface ClientRow {
  id: string;
  name: string;
  channeltalk_access_key: string | null;
  channeltalk_secret: string | null;
  manager_email: string | null;
  monthly_fee: number | null;
  business_number: string | null;
  report_show_tags: boolean;
  report_show_first_response: boolean;
  report_show_response_rate: boolean;
  report_top_comment: string | null;
}

const fmtKRW = (n: number) => n.toLocaleString('ko-KR');

function printHtml(html: string) {
  const w = window.open('', '_blank');
  if (!w) {
    toast.error('팝업이 차단되었습니다. 팝업을 허용해주세요.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { try { w.print(); } catch {} }, 500);
}

export default function Reports() {
  return (
    <AppLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">리포트</h1>
          <p className="text-muted-foreground">운영 통계 · 주간 CS 리포트 · 인보이스</p>
        </div>

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="dashboard">통계 대시보드</TabsTrigger>
            <TabsTrigger value="weekly">주간 CS 리포트</TabsTrigger>
            <TabsTrigger value="invoice">인보이스 발송</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard"><DashboardTab /></TabsContent>
          <TabsContent value="weekly"><WeeklyReportTab /></TabsContent>
          <TabsContent value="invoice"><InvoiceTab /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

/* =========================================================
   DASHBOARD TAB (기존 통계)
   ========================================================= */
function DashboardTab() {
  const [period, setPeriod] = useState('7');
  const [loading, setLoading] = useState(true);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [consultationByStatus, setConsultationByStatus] = useState<StatusDistribution[]>([]);
  const [summary, setSummary] = useState({ totalConsultations: 0, totalTasks: 0, activeClients: 0, avgResponseTime: '-' });

  useEffect(() => { fetchReportData(); }, [period]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const days = parseInt(period);
      const startDate = startOfDay(subDays(new Date(), days));
      const [{ data: consultations }, { data: tasks }, { count: clientsCount }] = await Promise.all([
        supabase.from('consultations').select('created_at, status').gte('created_at', startDate.toISOString()),
        supabase.from('tasks').select('created_at').gte('created_at', startDate.toISOString()),
        supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      ]);

      const dailyData: DailyStats[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const dateStr = format(date, 'yyyy-MM-dd');
        const displayDate = format(date, 'M/d');
        dailyData.push({
          date: displayDate,
          consultations: (consultations || []).filter((c: any) => format(new Date(c.created_at), 'yyyy-MM-dd') === dateStr).length,
          tasks: (tasks || []).filter((t: any) => format(new Date(t.created_at), 'yyyy-MM-dd') === dateStr).length,
        });
      }
      setDailyStats(dailyData);

      const statusCounts = (consultations || []).reduce((acc: any, c: any) => { acc[c.status] = (acc[c.status] || 0) + 1; return acc; }, {} as Record<string, number>);
      const statusColors: Record<string, string> = { pending: '#fbbf24', in_progress: '#3b82f6', completed: '#22c55e', escalated: '#ef4444' };
      const statusLabels: Record<string, string> = { pending: '대기중', in_progress: '진행중', completed: '완료', escalated: '에스컬레이션' };
      setConsultationByStatus(Object.entries(statusCounts).map(([s, v]) => ({ name: statusLabels[s] || s, value: v as number, color: statusColors[s] || '#6b7280' })));

      setSummary({ totalConsultations: consultations?.length || 0, totalTasks: tasks?.length || 0, activeClients: clientsCount || 0, avgResponseTime: '-' });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex h-40 items-center justify-center text-muted-foreground">로딩중...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">최근 7일</SelectItem>
            <SelectItem value="14">최근 14일</SelectItem>
            <SelectItem value="30">최근 30일</SelectItem>
            <SelectItem value="90">최근 90일</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => {
          const csv = 'data:text/csv;charset=utf-8,날짜,상담,업무\n' + dailyStats.map(d => `${d.date},${d.consultations},${d.tasks}`).join('\n');
          const link = document.createElement('a');
          link.setAttribute('href', encodeURI(csv));
          link.setAttribute('download', `리포트_${period}일.csv`);
          link.click();
        }}><Download className="mr-2 h-4 w-4" />CSV</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { icon: MessageSquare, color: 'bg-blue-100 text-blue-600', value: summary.totalConsultations, label: '총 상담' },
          { icon: TrendingUp, color: 'bg-green-100 text-green-600', value: summary.totalTasks, label: '총 업무' },
          { icon: Building2, color: 'bg-purple-100 text-purple-600', value: summary.activeClients, label: '활성 고객사' },
          { icon: Users, color: 'bg-orange-100 text-orange-600', value: summary.avgResponseTime, label: '평균 응답시간' },
        ].map((c, i) => (
          <Card key={i}><CardContent className="pt-6"><div className="flex items-center gap-4">
            <div className={`rounded-full p-3 ${c.color}`}><c.icon className="h-6 w-6" /></div>
            <div><p className="text-2xl font-bold">{c.value}</p><p className="text-sm text-muted-foreground">{c.label}</p></div>
          </div></CardContent></Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>일별 추이</CardTitle><CardDescription>상담 및 업무 등록 현황</CardDescription></CardHeader>
          <CardContent><div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip />
                <Line type="monotone" dataKey="consultations" name="상담" stroke="#3b82f6" strokeWidth={2} />
                <Line type="monotone" dataKey="tasks" name="업무" stroke="#22c55e" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>상담 상태 분포</CardTitle></CardHeader>
          <CardContent><div className="h-[300px]">
            {consultationByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={consultationByStatus} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {consultationByStatus.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="flex h-full items-center justify-center text-muted-foreground">데이터가 없습니다</div>}
          </div></CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>일별 상담 건수</CardTitle></CardHeader>
          <CardContent><div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip />
                <Bar dataKey="consultations" name="상담" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div></CardContent>
        </Card>
      </div>
    </div>
  );
}

/* =========================================================
   WEEKLY CS REPORT TAB
   ========================================================= */
function lastWeekRange() {
  const today = new Date();
  const thisMon = startOfWeek(today, { weekStartsOn: 1 });
  const lastMon = addDays(thisMon, -7);
  const lastSun = endOfWeek(lastMon, { weekStartsOn: 1 });
  return { from: format(lastMon, 'yyyy-MM-dd'), to: format(lastSun, 'yyyy-MM-dd') };
}

const KST_FORMATTER = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const toKstDateKey = (ts: number | string | null | undefined) => {
  if (!ts) return null;
  const date = new Date(typeof ts === 'number' ? ts : Number(ts));
  if (Number.isNaN(date.getTime())) return null;
  return KST_FORMATTER.format(date);
};

function aggregateChats(chats: any[], from: string, to: string): WeeklyStats {
  const byDayMap = new Map<string, { inCount: number; answered: number; frTimes: number[] }>();

  let cursor = new Date(`${from}T00:00:00+09:00`);
  const lastDay = new Date(`${to}T00:00:00+09:00`);
  while (cursor <= lastDay) {
    byDayMap.set(format(cursor, 'yyyy-MM-dd'), { inCount: 0, answered: 0, frTimes: [] });
    cursor = addDays(cursor, 1);
  }

  for (const c of chats) {
    const inboundTs = c.firstOpenedAt ?? c.openedAt ?? c.createdAt ?? c.createdAtMs;
    const responseTs = c.firstAnsweredAt ?? c.firstRepliedAt ?? c.firstRepliedAtAfterOpen;

    const inboundKey = toKstDateKey(inboundTs);
    if (inboundKey && inboundKey >= from && inboundKey <= to) {
      const row = byDayMap.get(inboundKey);
      if (row) row.inCount += 1;
    }

    const responseKey = toKstDateKey(responseTs);
    if (responseKey && responseKey >= from && responseKey <= to) {
      const row = byDayMap.get(responseKey);
      if (row) {
        row.answered += 1;
        const start = Number(inboundTs);
        const end = Number(responseTs);
        if (start && end && end > start) row.frTimes.push((end - start) / 1000);
      }
    }
  }

  const byDay = Array.from(byDayMap.entries()).map(([date, v]) => ({
    date,
    inCount: v.inCount,
    answered: v.answered,
    avgFirstResponseSec: v.frTimes.length ? v.frTimes.reduce((s, x) => s + x, 0) / v.frTimes.length : null,
  }));

  const totalIn = byDay.reduce((sum, row) => sum + row.inCount, 0);
  const totalAnswered = byDay.reduce((sum, row) => sum + row.answered, 0);

  const tagMap = new Map<string, number>();
  for (const c of chats) {
    const tags: string[] = Array.isArray(c.tags) ? c.tags : [];
    for (const t of tags) tagMap.set(t, (tagMap.get(t) || 0) + 1);
  }
  const byTag = Array.from(tagMap.entries()).sort(([, a], [, b]) => b - a).map(([tag, count]) => ({ tag, count }));

  return { totalIn, totalAnswered, byDay, byTag };
}

function WeeklyReportTab() {
  const initial = lastWeekRange();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [clientId, setClientId] = useState<string>('');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [stats, setStats] = useState<WeeklyStats | null>(null);

  useEffect(() => {
    supabase.from('clients').select('*').order('name').then(({ data }) => {
      setClients((data || []) as any);
    });
  }, []);

  const client = useMemo(() => clients.find(c => c.id === clientId) || null, [clients, clientId]);
  const settings: ReportSettings | null = client ? {
    showTags: !!client.report_show_tags,
    showFirstResponse: !!client.report_show_first_response,
    showResponseRate: !!client.report_show_response_rate,
    topComment: client.report_top_comment,
  } : null;

  const fetchData = async () => {
    if (!client) { toast.error('고객사를 선택해주세요'); return; }
    if (!client.channeltalk_access_key || !client.channeltalk_secret) {
      toast.error('해당 고객사에 채널톡 Access Key/Secret이 등록되어 있지 않습니다');
      return;
    }
    if (!from || !to) { toast.error('기간을 선택해주세요'); return; }

    setLoading(true);
    setStats(null);
    try {
      const { data, error } = await supabase.functions.invoke('channeltalk-fetch', {
        body: { apiKey: client.channeltalk_access_key, apiSecret: client.channeltalk_secret, from, to },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const chats = (data as any)?.chats || [];
      const aggregated = aggregateChats(chats, from, to);
      setStats(aggregated);
      toast.success(`인입 ${aggregated.totalIn}건 · 응대 ${aggregated.totalAnswered}건을 불러왔습니다`);
    } catch (e: any) {
      console.error(e);
      const msg = e?.message || '데이터 가져오기 실패';
      toast.error(msg.includes('CORS') ? 'CORS 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' : `오류: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const buildHtml = () => {
    if (!client || !stats || !settings) return '';
    return buildWeeklyReportHtml({
      clientName: client.name,
      periodStart: from,
      periodEnd: to,
      stats,
      settings,
    });
  };

  const onPdf = () => {
    const html = buildHtml();
    if (!html) { toast.error('먼저 데이터를 가져와주세요'); return; }
    printHtml(html);
  };

  const onSendEmail = async () => {
    if (!client || !stats) { toast.error('먼저 데이터를 가져와주세요'); return; }
    if (!client.manager_email) { toast.error('고객사에 담당자 이메일이 등록되어 있지 않습니다'); return; }
    setSending(true);
    try {
      const subject = `[업도움] ${client.name} 주간 CS 리포트 (${from} ~ ${to})`;
      const html = buildHtml();
      const { data, error } = await supabase.functions.invoke('send-report-email', {
        body: { to: client.manager_email, subject, html, clientId: client.id, reportType: 'weekly_cs', periodStart: from, periodEnd: to },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`${client.manager_email}로 발송되었습니다`);
    } catch (e: any) {
      toast.error(`발송 실패: ${e?.message || '알 수 없는 오류'}`);
    } finally {
      setSending(false);
    }
  };

  const responseRate = stats && stats.totalIn > 0 ? Math.round((stats.totalAnswered / stats.totalIn) * 100) : 0;
  const hasTags = settings?.showTags && (stats?.byTag.length || 0) > 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">조회 조건</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="grid gap-2 md:col-span-2">
              <Label>고객사</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="고객사 선택" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>시작일</Label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>종료일</Label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchData} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? '가져오는 중...' : '데이터 가져오기'}
            </Button>
            <Button variant="outline" onClick={onPdf} disabled={!stats}><FileDown className="mr-2 h-4 w-4" />PDF 저장</Button>
            <Button variant="outline" onClick={onSendEmail} disabled={!stats || sending}><Mail className="mr-2 h-4 w-4" />{sending ? '발송중...' : 'Gmail 발송'}</Button>
          </div>
        </CardContent>
      </Card>

      {stats && client && settings && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">리포트 미리보기 · {client.name}</CardTitle>
            <CardDescription>{from} ~ {to}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {settings.topComment?.trim() && (
              <div className="rounded-md border-l-4 p-4" style={{ borderLeftColor: '#C8A96E', background: '#fbf8f1' }}>
                <div className="text-xs font-semibold mb-1" style={{ color: '#0D4A55' }}>이번 주 운영 코멘트</div>
                <div className="text-sm whitespace-pre-wrap">{settings.topComment}</div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <KpiCard label="인입 상담 수" value={`${fmtKRW(stats.totalIn)}건`} />
              <KpiCard label="응대 상담 수" value={`${fmtKRW(stats.totalAnswered)}건`} />
              {settings.showResponseRate && <KpiCard label="응대율" value={`${responseRate}%`} />}
            </div>

            <div>
              <div className="font-semibold mb-2" style={{ color: '#0D4A55' }}>일별 현황</div>
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#0D4A55', color: '#fff' }}>
                      <th className="p-2 text-left">날짜</th>
                      <th className="p-2 text-right">인입 수</th>
                      <th className="p-2 text-right">응대 수</th>
                      {settings.showFirstResponse && <th className="p-2 text-right">평균 첫 응답</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byDay.length === 0 && (
                      <tr><td className="p-4 text-center text-muted-foreground" colSpan={settings.showFirstResponse ? 4 : 3}>데이터 없음</td></tr>
                    )}
                    {stats.byDay.map((d) => (
                      <tr key={d.date} className="border-t">
                        <td className="p-2">{d.date}</td>
                        <td className="p-2 text-right">{fmtKRW(d.inCount)}</td>
                        <td className="p-2 text-right">{fmtKRW(d.answered)}</td>
                        {settings.showFirstResponse && (
                          <td className="p-2 text-right">{d.avgFirstResponseSec == null ? '-' : `${Math.floor(d.avgFirstResponseSec / 60)}분 ${Math.floor(d.avgFirstResponseSec % 60)}초`}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {hasTags && (
              <div>
                <div className="font-semibold mb-2" style={{ color: '#0D4A55' }}>태그별 현황</div>
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: '#0D4A55', color: '#fff' }}>
                        <th className="p-2 text-left">태그</th>
                        <th className="p-2 text-right">인입 수</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.byTag.map((t) => (
                        <tr key={t.tag} className="border-t"><td className="p-2">{t.tag}</td><td className="p-2 text-right">{fmtKRW(t.count)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="pt-6 text-center">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-2xl font-bold" style={{ color: '#0D4A55' }}>{value}</div>
    </CardContent></Card>
  );
}

/* =========================================================
   INVOICE TAB
   ========================================================= */
function InvoiceTab() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [clientId, setClientId] = useState('');
  const now = new Date();
  const [billingMonth, setBillingMonth] = useState(format(now, 'yyyy-MM'));
  const [amount, setAmount] = useState<string>('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    supabase.from('clients').select('*').order('name').then(({ data }) => setClients((data || []) as any));
  }, []);

  const client = useMemo(() => clients.find(c => c.id === clientId) || null, [clients, clientId]);

  useEffect(() => {
    if (client?.monthly_fee != null) setAmount(String(client.monthly_fee));
  }, [client]);

  const [year, month] = billingMonth.split('-').map(Number);
  const amountNum = Number(amount) || 0;
  const vat = Math.round(amountNum * 0.1);
  const total = amountNum + vat;

  const buildHtml = () => client ? buildInvoiceHtml({
    clientName: client.name,
    year, month,
    amount: amountNum,
    businessNumber: client.business_number,
  }) : '';

  const onPdf = () => {
    if (!client) { toast.error('고객사를 선택해주세요'); return; }
    printHtml(buildHtml());
  };

  const onSend = async () => {
    if (!client) { toast.error('고객사를 선택해주세요'); return; }
    if (!client.manager_email) { toast.error('고객사에 담당자 이메일이 없습니다'); return; }
    if (!amountNum) { toast.error('금액을 입력해주세요'); return; }
    setSending(true);
    try {
      const subject = `[업도움] ${client.name} ${year}년 ${month}월 거래명세서`;
      const { data, error } = await supabase.functions.invoke('send-report-email', {
        body: { to: client.manager_email, subject, html: buildHtml(), clientId: client.id, reportType: 'invoice', periodStart: `${billingMonth}-01`, periodEnd: null },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`${client.manager_email}로 발송되었습니다`);
    } catch (e: any) {
      toast.error(`발송 실패: ${e?.message || '알 수 없는 오류'}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">인보이스 정보</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-2">
              <Label>고객사</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="고객사 선택" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>청구월</Label>
              <Input type="month" value={billingMonth} onChange={e => setBillingMonth(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>금액 (VAT 별도, 원)</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onPdf} disabled={!client}><FileText className="mr-2 h-4 w-4" />PDF 미리보기</Button>
            <Button onClick={onSend} disabled={!client || sending}><Mail className="mr-2 h-4 w-4" />{sending ? '발송중...' : 'Gmail 발송'}</Button>
          </div>
        </CardContent>
      </Card>

      {client && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">미리보기 · {client.name}</CardTitle>
            <CardDescription>{year}년 {month}월</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm border rounded overflow-hidden">
              <thead>
                <tr style={{ background: '#0D4A55', color: '#fff' }}>
                  <th className="p-3 text-left">항목</th>
                  <th className="p-3 text-right w-40">금액 (원)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t"><td className="p-3">CS 쉐어링 서비스 이용료 {year}년 {month}월</td><td className="p-3 text-right">{fmtKRW(amountNum)}</td></tr>
                <tr className="border-t"><td className="p-3 text-muted-foreground">VAT (10%)</td><td className="p-3 text-right text-muted-foreground">{fmtKRW(vat)}</td></tr>
                <tr className="border-t" style={{ background: '#fbf8f1' }}>
                  <td className="p-3 font-bold" style={{ color: '#0D4A55' }}>합계</td>
                  <td className="p-3 text-right font-bold text-lg" style={{ color: '#0D4A55' }}>{fmtKRW(total)}</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
