import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, MessageSquare, ClipboardList, AlertTriangle, CheckCircle2, Clock, Calendar, Users, Bell, Rocket } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getConsultationStatusBadge, getTaskStatusBadge, getIssuePriorityBadge, getIssueStatusBadge } from '@/components/ui/status-badge';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

interface DashboardStats {
  activeClients: number;
  todayConsultations: number;
  pendingTasks: number;
  openIssues: number;
}

interface ScheduleItem {
  id: string;
  clientName: string;
  startTime: string;
  endTime: string;
  status: string;
}

interface IssueItem {
  id: string;
  title: string;
  priority: string;
  status: string;
  clientName: string;
  createdAt: string;
}

interface ConsultationItem {
  id: string;
  content: string;
  status: string;
  customerName: string;
  clientName: string;
  createdAt: string;
}

interface TaskItem {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  clientName: string | null;
}

interface PilotSummary {
  id: string;
  clientName: string;
  status: string;
  progress: number;
  startDate: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    activeClients: 0,
    todayConsultations: 0,
    pendingTasks: 0,
    openIssues: 0,
  });
  const [todaySchedules, setTodaySchedules] = useState<ScheduleItem[]>([]);
  const [openIssues, setOpenIssues] = useState<IssueItem[]>([]);
  const [recentConsultations, setRecentConsultations] = useState<ConsultationItem[]>([]);
  const [myTasks, setMyTasks] = useState<TaskItem[]>([]);
  const [pilotSummaries, setPilotSummaries] = useState<PilotSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Array<{id: string; type: string; message: string; time: Date}>>([]);

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    
    try {
      const today = new Date().toISOString().split('T')[0];

      // Fetch stats in parallel
      const [clientsRes, consultationsRes, tasksRes, issuesRes] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('consultations').select('*', { count: 'exact', head: true }).gte('created_at', today),
        supabase.from('tasks').select('*', { count: 'exact', head: true }).in('status', ['pending', 'in_progress']),
        supabase.from('issues').select('*', { count: 'exact', head: true }).in('status', ['open', 'in_progress']),
      ]);

      setStats({
        activeClients: clientsRes.count || 0,
        todayConsultations: consultationsRes.count || 0,
        pendingTasks: tasksRes.count || 0,
        openIssues: issuesRes.count || 0,
      });

      // Fetch today's schedules
      const { data: schedules } = await supabase
        .from('schedule_assignments')
        .select(`
          id,
          start_time,
          end_time,
          status,
          clients (name)
        `)
        .eq('work_date', today)
        .eq('user_id', user?.id)
        .order('start_time', { ascending: true });

      setTodaySchedules((schedules || []).map(s => ({
        id: s.id,
        clientName: (s.clients as any)?.name || '미지정',
        startTime: s.start_time,
        endTime: s.end_time,
        status: s.status,
      })));

      // Fetch open issues with client info
      const { data: issues } = await supabase
        .from('issues')
        .select(`
          id,
          title,
          priority,
          status,
          created_at,
          clients (name)
        `)
        .in('status', ['open', 'in_progress'])
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(5);

      setOpenIssues((issues || []).map(i => ({
        id: i.id,
        title: i.title,
        priority: i.priority,
        status: i.status,
        clientName: (i.clients as any)?.name || '-',
        createdAt: i.created_at,
      })));

      // Fetch recent consultations with client info
      const { data: consultations } = await supabase
        .from('consultations')
        .select(`
          id,
          content,
          status,
          customer_name,
          created_at,
          clients (name)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentConsultations((consultations || []).map(c => ({
        id: c.id,
        content: c.content?.substring(0, 40) + (c.content?.length > 40 ? '...' : '') || '',
        status: c.status,
        customerName: c.customer_name || '익명',
        clientName: (c.clients as any)?.name || '-',
        createdAt: c.created_at,
      })));

      // Fetch my tasks with client info
      const { data: tasksData } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          status,
          due_date,
          clients (name)
        `)
        .eq('assignee_id', user?.id)
        .in('status', ['pending', 'in_progress', 'review'])
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(5);

      setMyTasks((tasksData || []).map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        dueDate: t.due_date,
        clientName: (t.clients as any)?.name || null,
      })));

      // Fetch pilot summaries
      const { data: pilotsData } = await supabase
        .from('pilot_projects')
        .select(`
          id,
          status,
          start_date,
          clients (name),
          checkpoints:pilot_checkpoints (is_completed)
        `)
        .in('status', ['pending', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(5);

      setPilotSummaries((pilotsData || []).map(p => {
        const checkpoints = (p as any).checkpoints || [];
        const completed = checkpoints.filter((c: any) => c.is_completed).length;
        const progress = checkpoints.length > 0 ? Math.round((completed / checkpoints.length) * 100) : 0;
        return {
          id: p.id,
          clientName: (p.clients as any)?.name || '-',
          status: p.status,
          progress,
          startDate: p.start_date,
        };
      }));

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user, fetchDashboardData]);

  // Real-time subscriptions for notifications
  useEffect(() => {
    if (!user) return;

    // Subscribe to new consultations
    const consultationsChannel = supabase
      .channel('consultations-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'consultations'
        },
        (payload) => {
          console.log('New consultation:', payload);
          const newConsultation = payload.new as any;
          
          toast({
            title: "📞 새로운 상담 접수",
            description: `${newConsultation.customer_name || '고객'}님의 상담이 등록되었습니다.`,
          });
          
          setNotifications(prev => [{
            id: newConsultation.id,
            type: 'consultation',
            message: `새로운 상담: ${newConsultation.content?.substring(0, 30)}...`,
            time: new Date()
          }, ...prev].slice(0, 10));
          
          // Refresh dashboard data
          fetchDashboardData();
        }
      )
      .subscribe();

    // Subscribe to new issues
    const issuesChannel = supabase
      .channel('issues-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'issues'
        },
        (payload) => {
          console.log('New issue:', payload);
          const newIssue = payload.new as any;
          
          toast({
            title: "⚠️ 새로운 이슈 등록",
            description: newIssue.title,
            variant: newIssue.priority === 'critical' || newIssue.priority === 'high' ? 'destructive' : 'default',
          });
          
          setNotifications(prev => [{
            id: newIssue.id,
            type: 'issue',
            message: `새로운 이슈: ${newIssue.title}`,
            time: new Date()
          }, ...prev].slice(0, 10));
          
          // Refresh dashboard data
          fetchDashboardData();
        }
      )
      .subscribe();

    // Subscribe to new tasks assigned to current user
    const tasksChannel = supabase
      .channel('tasks-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tasks'
        },
        (payload) => {
          console.log('New task:', payload);
          const newTask = payload.new as any;
          
          // Only notify if assigned to current user
          if (newTask.assignee_id === user.id) {
            toast({
              title: "📋 새로운 업무 배정",
              description: newTask.title,
            });
            
            setNotifications(prev => [{
              id: newTask.id,
              type: 'task',
              message: `새로운 업무: ${newTask.title}`,
              time: new Date()
            }, ...prev].slice(0, 10));
            
            // Refresh dashboard data
            fetchDashboardData();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(consultationsChannel);
      supabase.removeChannel(issuesChannel);
      supabase.removeChannel(tasksChannel);
    };
  }, [user, toast, fetchDashboardData]);

  const formatTime = (time: string) => {
    return time.substring(0, 5);
  };

  const getScheduleStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-success/10 text-success';
      case 'pending': return 'bg-warning/10 text-warning';
      case 'cancelled': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'consultation': return <MessageSquare className="h-4 w-4 text-primary" />;
      case 'issue': return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'task': return <ClipboardList className="h-4 w-4 text-warning" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const handleNotificationClick = (notification: {id: string; type: string}) => {
    switch (notification.type) {
      case 'consultation':
        navigate('/cs');
        break;
      case 'issue':
        navigate('/issues');
        break;
      case 'task':
        navigate('/tasks');
        break;
    }
  };

  const handleItemClick = (type: 'schedule' | 'task' | 'issue' | 'consultation' | 'pilot', id?: string) => {
    switch (type) {
      case 'schedule':
        navigate('/leave');
        break;
      case 'task':
        navigate('/tasks');
        break;
      case 'issue':
        navigate('/issues');
        break;
      case 'consultation':
        navigate('/cs');
        break;
      case 'pilot':
        navigate('/pilots');
        break;
    }
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
      <div className="p-4 md:p-6">
        {/* Header with Notifications */}
        <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">대시보드</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              {format(new Date(), 'yyyy년 M월 d일 EEEE', { locale: ko })}
            </p>
          </div>
          
          {/* Recent Notifications Badge */}
          {notifications.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-lg">
              <Bell className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-sm font-medium text-primary">
                새 알림 {notifications.length}개
              </span>
            </div>
          )}
        </div>

        {/* Real-time Notification Banner */}
        {notifications.length > 0 && (
          <Card className="mb-6 border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="h-4 w-4 text-primary" />
                실시간 알림
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {notifications.slice(0, 3).map((notification) => (
                  <li 
                    key={notification.id} 
                    className="flex items-center gap-3 text-sm cursor-pointer hover:bg-primary/10 rounded-md p-2 -mx-2 transition-colors"
                    onClick={() => handleNotificationClick(notification)}
                  >
                    {getNotificationIcon(notification.type)}
                    <span className="flex-1 truncate">{notification.message}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(notification.time, 'HH:mm')}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid - 2x2 on mobile, 4 columns on desktop */}
        <div className="mb-6 md:mb-8 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          <StatCard
            title="활성 고객사"
            value={stats.activeClients}
            subtitle="유료 계약 중"
            icon={<Building2 className="h-5 w-5 md:h-6 md:w-6" />}
          />
          <StatCard
            title="오늘 상담"
            value={stats.todayConsultations}
            subtitle="건"
            icon={<MessageSquare className="h-5 w-5 md:h-6 md:w-6" />}
          />
          <StatCard
            title="진행 중 업무"
            value={stats.pendingTasks}
            subtitle="건"
            icon={<ClipboardList className="h-5 w-5 md:h-6 md:w-6" />}
          />
          <StatCard
            title="미해결 이슈"
            value={stats.openIssues}
            subtitle="건"
            icon={<AlertTriangle className="h-5 w-5 md:h-6 md:w-6" />}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
          {/* Pilot Progress Summary */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Rocket className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                파일럿 진행 현황
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">진행 중인 파일럿 프로젝트</CardDescription>
            </CardHeader>
            <CardContent>
              {pilotSummaries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 md:py-8 text-center">
                  <Rocket className="mb-2 h-10 w-10 md:h-12 md:w-12 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">진행 중인 파일럿이 없습니다</p>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {pilotSummaries.map((pilot) => (
                    <div
                      key={pilot.id}
                      className="flex flex-col gap-2 p-3 md:p-4 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => handleItemClick('pilot', pilot.id)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">{pilot.clientName}</span>
                        <Badge variant={pilot.status === 'in_progress' ? 'default' : 'secondary'} className="text-xs">
                          {pilot.status === 'in_progress' ? '진행중' : '대기중'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={pilot.progress} className="h-2 flex-1" />
                        <span className="text-sm font-medium text-muted-foreground w-10 text-right">
                          {pilot.progress}%
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(pilot.startDate), 'M월 d일', { locale: ko })} 시작
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Today's Schedule */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Calendar className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                오늘의 스케줄
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">
                {format(new Date(), 'M월 d일')} 배정된 근무
              </CardDescription>
            </CardHeader>
            <CardContent>
              {todaySchedules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 md:py-8 text-center">
                  <Calendar className="mb-2 h-10 w-10 md:h-12 md:w-12 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">오늘 배정된 스케줄이 없습니다</p>
                </div>
              ) : (
                <ul className="space-y-2 md:space-y-3">
                  {todaySchedules.map((schedule) => (
                    <li 
                      key={schedule.id} 
                      className="flex items-center justify-between rounded-lg border p-2 md:p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => handleItemClick('schedule')}
                    >
                      <div className="flex items-center gap-2 md:gap-3 min-w-0">
                        <div className="flex-shrink-0 text-xs md:text-sm font-mono text-primary">
                          {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
                        </div>
                        <span className="font-medium text-sm md:text-base truncate">{schedule.clientName}</span>
                      </div>
                      <Badge variant="outline" className={`text-xs ${getScheduleStatusColor(schedule.status)}`}>
                        {schedule.status === 'confirmed' ? '확정' : schedule.status === 'pending' ? '대기' : schedule.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* My Tasks */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <ClipboardList className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                나의 할 일
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">배정된 미완료 업무</CardDescription>
            </CardHeader>
            <CardContent>
              {myTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 md:py-8 text-center">
                  <CheckCircle2 className="mb-2 h-10 w-10 md:h-12 md:w-12 text-success" />
                  <p className="text-sm text-muted-foreground">완료되지 않은 업무가 없습니다</p>
                </div>
              ) : (
                <ul className="space-y-2 md:space-y-3">
                  {myTasks.map((task) => (
                    <li 
                      key={task.id} 
                      className="flex items-center justify-between rounded-lg border p-2 md:p-3 gap-2 cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => handleItemClick('task', task.id)}
                    >
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-medium text-sm md:text-base truncate">{task.title}</span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {task.clientName && <span>{task.clientName}</span>}
                          {task.dueDate && (
                            <>
                              <span>•</span>
                              <span className={new Date(task.dueDate) < new Date() ? 'text-destructive' : ''}>
                                {format(new Date(task.dueDate), 'M/d')} 마감
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      {getTaskStatusBadge(task.status)}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Open Issues */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-destructive" />
                미해결 이슈
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">처리가 필요한 이슈 목록</CardDescription>
            </CardHeader>
            <CardContent>
              {openIssues.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 md:py-8 text-center">
                  <CheckCircle2 className="mb-2 h-10 w-10 md:h-12 md:w-12 text-success" />
                  <p className="text-sm text-muted-foreground">미해결 이슈가 없습니다</p>
                </div>
              ) : (
                <ul className="space-y-2 md:space-y-3">
                  {openIssues.map((issue) => (
                    <li 
                      key={issue.id} 
                      className="flex items-start justify-between rounded-lg border p-2 md:p-3 gap-2 cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => handleItemClick('issue', issue.id)}
                    >
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-medium text-sm md:text-base truncate">{issue.title}</span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{issue.clientName}</span>
                          <span>•</span>
                          <span>{format(new Date(issue.createdAt), 'M/d HH:mm')}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {getIssuePriorityBadge(issue.priority)}
                        {getIssueStatusBadge(issue.status)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Recent Consultations */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <MessageSquare className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                최근 상담
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">최근 접수된 상담 내역</CardDescription>
            </CardHeader>
            <CardContent>
              {recentConsultations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 md:py-8 text-center">
                  <MessageSquare className="mb-2 h-10 w-10 md:h-12 md:w-12 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">최근 상담 내역이 없습니다</p>
                </div>
              ) : (
                <ul className="space-y-2 md:space-y-3">
                  {recentConsultations.map((consultation) => (
                    <li 
                      key={consultation.id} 
                      className="flex items-start justify-between rounded-lg border p-2 md:p-3 gap-2 cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => handleItemClick('consultation', consultation.id)}
                    >
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-medium text-sm md:text-base truncate">{consultation.content}</span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Users className="h-3 w-3" />
                          <span>{consultation.customerName}</span>
                          <span>•</span>
                          <span>{consultation.clientName}</span>
                          <span>•</span>
                          <span>{format(new Date(consultation.createdAt), 'M/d HH:mm')}</span>
                        </div>
                      </div>
                      {getConsultationStatusBadge(consultation.status)}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
