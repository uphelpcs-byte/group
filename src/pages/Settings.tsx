import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { User, Bell, Shield, Building, Palette } from 'lucide-react';
import { toast } from 'sonner';

export default function Settings() {
  const { user, role } = useAuth();
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({ full_name: '', phone: '' });
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [darkMode, setDarkMode] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [notifications, setNotifications] = useState({
    email: true,
    deadline: true,
    issue: true,
    daily: false,
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', user?.id)
      .single();
    
    if (data) {
      setProfile({ full_name: data.full_name || '', phone: data.phone || '' });
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: profile.full_name, phone: profile.phone })
        .eq('id', user?.id);
      
      if (error) throw error;
      toast.success('프로필이 저장되었습니다');
    } catch (error: any) {
      toast.error(error.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.current || !passwordForm.new) {
      toast.error('비밀번호를 입력해주세요');
      return;
    }
    if (passwordForm.new !== passwordForm.confirm) {
      toast.error('새 비밀번호가 일치하지 않습니다');
      return;
    }
    if (passwordForm.new.length < 6) {
      toast.error('비밀번호는 6자 이상이어야 합니다');
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.new });
      if (error) throw error;
      toast.success('비밀번호가 변경되었습니다');
      setPasswordForm({ current: '', new: '', confirm: '' });
    } catch (error: any) {
      toast.error(error.message || '비밀번호 변경 실패');
    }
  };

  const handlePhotoChange = () => {
    toast.info('프로필 사진 변경 기능은 준비 중입니다');
  };

  const handleOrgSave = () => {
    toast.success('조직 설정이 저장되었습니다');
  };

  const getInitials = (email: string | undefined) => {
    if (!email) return 'U';
    return email.charAt(0).toUpperCase();
  };

  const getRoleLabel = (role: string | null) => {
    switch (role) {
      case 'admin': return '대표';
      case 'manager': return '운영관리자';
      case 'agent': return 'CS상담원';
      case 'contractor': return '외주인력';
      default: return '';
    }
  };

  return (
    <AppLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">설정</h1>
          <p className="text-muted-foreground">계정 및 시스템 설정을 관리합니다</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              프로필
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              알림
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" />
              보안
            </TabsTrigger>
            {(role === 'admin' || role === 'manager') && (
              <TabsTrigger value="organization" className="gap-2">
                <Building className="h-4 w-4" />
                조직
              </TabsTrigger>
            )}
            <TabsTrigger value="appearance" className="gap-2">
              <Palette className="h-4 w-4" />
              테마
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>프로필 정보</CardTitle>
                <CardDescription>개인 정보를 수정합니다</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <Avatar className="h-20 w-20">
                    <AvatarFallback className="text-2xl">{getInitials(user?.email)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <Button variant="outline" size="sm" onClick={handlePhotoChange}>사진 변경</Button>
                    <p className="mt-1 text-sm text-muted-foreground">JPG, PNG, GIF 최대 5MB</p>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">이메일</Label>
                    <Input id="email" value={user?.email || ''} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">역할</Label>
                    <Input id="role" value={getRoleLabel(role)} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">이름</Label>
                    <Input 
                      id="name" 
                      placeholder="이름을 입력하세요" 
                      value={profile.full_name}
                      onChange={(e) => setProfile(prev => ({ ...prev, full_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">전화번호</Label>
                    <Input 
                      id="phone" 
                      placeholder="전화번호를 입력하세요" 
                      value={profile.phone}
                      onChange={(e) => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveProfile} disabled={saving}>
                    {saving ? '저장 중...' : '저장'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>알림 설정</CardTitle>
                <CardDescription>알림 수신 방법을 설정합니다</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">이메일 알림</p>
                    <p className="text-sm text-muted-foreground">새로운 상담이 배정되면 이메일로 알려드립니다</p>
                  </div>
                  <Switch 
                    checked={notifications.email} 
                    onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, email: checked }))}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">업무 마감 알림</p>
                    <p className="text-sm text-muted-foreground">업무 마감일 1일 전 알림을 보내드립니다</p>
                  </div>
                  <Switch 
                    checked={notifications.deadline} 
                    onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, deadline: checked }))}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">이슈 알림</p>
                    <p className="text-sm text-muted-foreground">새로운 이슈가 등록되면 알려드립니다</p>
                  </div>
                  <Switch 
                    checked={notifications.issue} 
                    onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, issue: checked }))}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">일일 리포트</p>
                    <p className="text-sm text-muted-foreground">매일 오전 9시에 일일 현황을 보내드립니다</p>
                  </div>
                  <Switch 
                    checked={notifications.daily} 
                    onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, daily: checked }))}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>보안 설정</CardTitle>
                <CardDescription>계정 보안을 관리합니다</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-medium mb-2">비밀번호 변경</h3>
                  <div className="space-y-4 max-w-md">
                    <div className="space-y-2">
                      <Label htmlFor="current-password">현재 비밀번호</Label>
                      <Input 
                        id="current-password" 
                        type="password" 
                        value={passwordForm.current}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, current: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-password">새 비밀번호</Label>
                      <Input 
                        id="new-password" 
                        type="password" 
                        value={passwordForm.new}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, new: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">비밀번호 확인</Label>
                      <Input 
                        id="confirm-password" 
                        type="password" 
                        value={passwordForm.confirm}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm: e.target.value }))}
                      />
                    </div>
                    <Button onClick={handleChangePassword}>비밀번호 변경</Button>
                  </div>
                </div>
                <Separator />
                <div>
                  <h3 className="font-medium mb-2">로그인 기록</h3>
                  <p className="text-sm text-muted-foreground mb-4">최근 로그인 기록입니다</p>
                  <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                    로그인 기록이 없습니다
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Organization Tab */}
          <TabsContent value="organization">
            <Card>
              <CardHeader>
                <CardTitle>조직 설정</CardTitle>
                <CardDescription>조직 정보를 관리합니다 (관리자 전용)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="org-name">회사명</Label>
                    <Input id="org-name" placeholder="회사명을 입력하세요" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="business-number">사업자등록번호</Label>
                    <Input id="business-number" placeholder="000-00-00000" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="org-address">주소</Label>
                    <Input id="org-address" placeholder="회사 주소를 입력하세요" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleOrgSave}>저장</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance">
            <Card>
              <CardHeader>
                <CardTitle>테마 설정</CardTitle>
                <CardDescription>화면 표시 방식을 설정합니다</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">다크 모드</p>
                    <p className="text-sm text-muted-foreground">어두운 테마를 사용합니다</p>
                  </div>
                  <Switch 
                    checked={darkMode}
                    onCheckedChange={(checked) => {
                      setDarkMode(checked);
                      toast.info(checked ? '다크 모드가 활성화되었습니다 (개발 중)' : '라이트 모드가 활성화되었습니다');
                    }}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">컴팩트 모드</p>
                    <p className="text-sm text-muted-foreground">화면 요소 간격을 좁힙니다</p>
                  </div>
                  <Switch 
                    checked={compactMode}
                    onCheckedChange={(checked) => {
                      setCompactMode(checked);
                      toast.info(checked ? '컴팩트 모드가 활성화되었습니다 (개발 중)' : '기본 모드가 활성화되었습니다');
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
