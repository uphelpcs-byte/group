import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  MessageSquare, 
  ClipboardList, 
  BarChart3, 
  Settings,
  LogOut,
  AlertCircle,
  CalendarDays,
  Clock,
  LogIn,
  LogOut as LogOutIcon,
  DollarSign,
  Wrench,
  Rocket,
  Video,
  UtensilsCrossed,
  RotateCcw,
  TrendingUp,
  Receipt
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import logo from '@/assets/logo.png';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { format } from 'date-fns';

const navigation = [
  { name: '대시보드', href: '/dashboard', icon: LayoutDashboard },
  { name: '구성원 관리', href: '/members', icon: Users },
  { name: '스케줄 관리', href: '/schedule', icon: CalendarDays },
  { name: '근태관리', href: '/attendance', icon: Clock, adminOnly: true },
  { name: '급여 관리', href: '/payroll', icon: DollarSign, adminOnly: true },
  { name: '급여 명세서', href: '/payslips', icon: Receipt },
  { name: '매출 관리', href: '/revenue', icon: TrendingUp, adminOnly: true },
  { name: '고객사 관리', href: '/clients', icon: Building2 },
  { name: '파일럿 관리', href: '/pilots', icon: Rocket },
  { name: 'CS 운영', href: '/cs', icon: MessageSquare },
  { name: '이슈 관리', href: '/issues', icon: AlertCircle },
  { name: '업무 관리', href: '/tasks', icon: ClipboardList },
  { name: '회의관리', href: '/meetings', icon: Video },
  { name: '업무 툴 관리', href: '/tools', icon: Wrench },
  { name: '리포트', href: '/reports', icon: BarChart3 },
  { name: '설정', href: '/settings', icon: Settings },
];

export function AppSidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const location = useLocation();
  const { user, role, signOut, isManagerPlus } = useAuth();
  const [currentAttendance, setCurrentAttendance] = useState<{ id: string; clock_in: string; meal_out: string | null; meal_in: string | null } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 오늘 출근 기록 확인
  useEffect(() => {
    if (user && !isManagerPlus) {
      checkTodayAttendance();
    }
  }, [user, isManagerPlus]);

  const checkTodayAttendance = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const { data } = await supabase
      .from('attendance_records')
      .select('id, clock_in, clock_out, meal_out, meal_in')
      .eq('user_id', user?.id)
      .eq('work_date', today)
      .is('clock_out', null)
      .maybeSingle();
    
    if (data) {
      setCurrentAttendance({ id: data.id, clock_in: data.clock_in, meal_out: data.meal_out, meal_in: data.meal_in });
    } else {
      setCurrentAttendance(null);
    }
  };

  const handleClockIn = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.from('attendance_records').insert({
        user_id: user.id,
        clock_in: new Date().toISOString(),
        work_date: format(new Date(), 'yyyy-MM-dd'),
      });
      if (error) throw error;
      toast.success('출근이 등록되었습니다');
      checkTodayAttendance();
    } catch (error: any) {
      toast.error(error.message || '출근 등록 실패');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!currentAttendance) return;
    setIsLoading(true);
    try {
      // Calculate meal duration if meal_out and meal_in exist
      const { data: record } = await supabase
        .from('attendance_records')
        .select('meal_out, meal_in')
        .eq('id', currentAttendance.id)
        .single();
      
      let mealDuration: number | null = null;
      if (record?.meal_out && record?.meal_in) {
        mealDuration = (new Date(record.meal_in).getTime() - new Date(record.meal_out).getTime()) / (1000 * 60 * 60);
      }

      const { error } = await supabase
        .from('attendance_records')
        .update({ 
          clock_out: new Date().toISOString(),
          meal_duration: mealDuration,
        })
        .eq('id', currentAttendance.id);
      if (error) throw error;
      toast.success('퇴근이 등록되었습니다');
      setCurrentAttendance(null);
    } catch (error: any) {
      toast.error(error.message || '퇴근 등록 실패');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMealOut = async () => {
    if (!currentAttendance) return;
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('attendance_records')
        .update({ meal_out: new Date().toISOString() })
        .eq('id', currentAttendance.id);
      if (error) throw error;
      toast.success('식사 시작이 등록되었습니다');
      checkTodayAttendance();
    } catch (error: any) {
      toast.error(error.message || '식사 등록 실패');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMealIn = async () => {
    if (!currentAttendance) return;
    setIsLoading(true);
    try {
      const mealDuration = currentAttendance.meal_out
        ? (new Date().getTime() - new Date(currentAttendance.meal_out).getTime()) / (1000 * 60 * 60)
        : null;
      const { error } = await supabase
        .from('attendance_records')
        .update({ meal_in: new Date().toISOString(), meal_duration: mealDuration })
        .eq('id', currentAttendance.id);
      if (error) throw error;
      toast.success('식사 복귀가 등록되었습니다');
      checkTodayAttendance();
    } catch (error: any) {
      toast.error(error.message || '복귀 등록 실패');
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleLabel = (role: string | null) => {
    switch (role) {
      case 'admin': return '대표';
      case 'director': return '이사';
      case 'manager': return '운영관리자';
      case 'agent': return 'CS상담원';
      case 'contractor': return '외주인력';
      default: return '';
    }
  };

  const getInitials = (email: string | undefined) => {
    if (!email) return 'U';
    return email.charAt(0).toUpperCase();
  };

  // 권한에 따른 네비게이션 필터링
  const filteredNavigation = navigation.filter(item => {
    if (item.adminOnly && !isManagerPlus) return false;
    return true;
  });

  return (
    <aside className="flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-sidebar-border px-4 gap-3">
        <img src={logo} alt="업도움" className="h-10 w-10 object-contain" />
        <div>
          <h1 className="text-lg font-bold leading-tight">업도움</h1>
          <p className="text-xs text-sidebar-foreground/60">그룹웨어</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {filteredNavigation.map((item) => {
          const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
          return (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </NavLink>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="border-t border-sidebar-border p-4 space-y-3">
        {/* 상담원/외주인력 출퇴근 버튼 */}
        {!isManagerPlus && (
          <div className="space-y-2">
            <div className="flex gap-2">
              {currentAttendance ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                    onClick={handleClockOut}
                    disabled={isLoading}
                  >
                    <LogOutIcon className="mr-1 h-4 w-4" />
                    퇴근
                  </Button>
                  {!currentAttendance.meal_out || currentAttendance.meal_in ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
                      onClick={handleMealOut}
                      disabled={isLoading}
                    >
                      <UtensilsCrossed className="mr-1 h-4 w-4" />
                      식사
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-blue-500/30 text-blue-500 hover:bg-blue-500/10"
                      onClick={handleMealIn}
                      disabled={isLoading}
                    >
                      <RotateCcw className="mr-1 h-4 w-4" />
                      복귀
                    </Button>
                  )}
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 border-green-500/30 text-green-500 hover:bg-green-500/10"
                  onClick={handleClockIn}
                  disabled={isLoading}
                >
                  <LogIn className="mr-1 h-4 w-4" />
                  출근
                </Button>
              )}
            </div>
          </div>
        )}

        {/* 현재 근무 상태 표시 */}
        {!isManagerPlus && currentAttendance && (
          <div className="text-xs text-center text-sidebar-foreground/60">
            {format(new Date(currentAttendance.clock_in), 'HH:mm')} 출근
            {currentAttendance.meal_out && !currentAttendance.meal_in && ' · 식사중'}
          </div>
        )}

        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">
              {getInitials(user?.email)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium">{user?.email}</p>
            <p className="text-xs text-sidebar-foreground/60">{getRoleLabel(role)}</p>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={signOut}
            className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
