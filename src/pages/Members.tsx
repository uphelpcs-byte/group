import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Search, MoreHorizontal, Mail, Phone, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { toast } from 'sonner';

const DEPARTMENTS = ['CS운영팀', '영업팀'] as const;
const POSITIONS = ['이사', '팀장', '사원'] as const;

interface Member {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  work_status: string;
  created_at: string;
  department: string | null;
  position: string | null;
  role?: string;
  clientIds: string[];
  resident_number?: string | null;
}

interface ClientOption {
  id: string;
  name: string;
}

const ROLES = ['admin', 'director', 'manager', 'agent', 'contractor'] as const;

export default function Members() {
  const { isManagerPlus, isAdmin, user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [positionFilter, setPositionFilter] = useState<string>('all');
  
  // 다이얼로그 상태
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [editForm, setEditForm] = useState({
    department: '',
    position: '',
    role: '',
    work_status: '',
    clientIds: [] as string[],
    resident_number: '',
  });

  useEffect(() => {
    fetchMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const fetchMembers = async () => {
    try {
      const [profilesRes, rolesRes, assignmentsRes, clientsRes, sensitiveRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('user_roles').select('user_id, role'),
        supabase.from('client_assignments').select('user_id, client_id'),
        supabase.from('clients').select('id, name').order('name'),
        isAdmin
          ? supabase.from('member_sensitive').select('user_id, resident_number')
          : Promise.resolve({ data: [] as { user_id: string; resident_number: string | null }[] }),
      ]);

      if (profilesRes.error) throw profilesRes.error;

      const roleMap = new Map((rolesRes.data || []).map((r) => [r.user_id, r.role]));
      const assignMap = new Map<string, string[]>();
      (assignmentsRes.data || []).forEach((a) => {
        const arr = assignMap.get(a.user_id) || [];
        arr.push(a.client_id);
        assignMap.set(a.user_id, arr);
      });
      const sensitiveMap = new Map(
        ((sensitiveRes.data || []) as { user_id: string; resident_number: string | null }[])
          .map((s) => [s.user_id, s.resident_number])
      );

      setClients((clientsRes.data || []) as ClientOption[]);
      setMembers(
        (profilesRes.data || []).map((profile) => ({
          ...profile,
          role: roleMap.get(profile.id) || 'agent',
          clientIds: assignMap.get(profile.id) || [],
          resident_number: sensitiveMap.get(profile.id) ?? null,
        }))
      );
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  };

  const clientName = (id: string) => clients.find((c) => c.id === id)?.name || '알 수 없음';

  const filteredMembers = members.filter(member => {
    const matchesSearch = 
      member.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDepartment = departmentFilter === 'all' || member.department === departmentFilter;
    const matchesPosition = positionFilter === 'all' || member.position === positionFilter;
    
    return matchesSearch && matchesDepartment && matchesPosition;
  });

  const clearFilters = () => {
    setSearchQuery('');
    setDepartmentFilter('all');
    setPositionFilter('all');
  };

  const hasActiveFilters = searchQuery || departmentFilter !== 'all' || positionFilter !== 'all';

  const getWorkStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      active: { label: '재직중', variant: 'default' },
      freelancer: { label: '프리랜서', variant: 'secondary' },
      on_leave: { label: '휴직', variant: 'outline' },
      resigned: { label: '퇴사', variant: 'destructive' },
    };
    const config = statusConfig[status] || { label: status, variant: 'outline' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getRoleBadge = (role: string) => {
    const roleConfig: Record<string, { label: string; className: string }> = {
      admin: { label: '대표', className: 'bg-primary text-primary-foreground' },
      director: { label: '이사', className: 'bg-primary text-primary-foreground' },
      manager: { label: '운영관리자', className: 'bg-blue-500 text-white' },
      agent: { label: 'CS상담원', className: 'bg-green-500 text-white' },
      contractor: { label: '외주인력', className: 'bg-orange-500 text-white' },
    };
    const config = roleConfig[role] || { label: role, className: '' };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const getInitials = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: '대표',
      director: '이사',
      manager: '운영관리자',
      agent: 'CS상담원',
      contractor: '외주인력',
    };
    return labels[role] || role;
  };

  const getWorkStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      active: '재직중',
      freelancer: '프리랜서',
      on_leave: '휴직',
      resigned: '퇴사',
    };
    return labels[status] || status;
  };

  const handleViewDetail = (member: Member) => {
    setSelectedMember(member);
    setDetailDialogOpen(true);
  };

  const handleOpenEdit = (member: Member) => {
    setSelectedMember(member);
    setEditForm({
      department: member.department || '',
      position: member.position || '',
      role: member.role || 'agent',
      work_status: member.work_status,
      clientIds: member.clientIds || [],
      resident_number: member.resident_number || '',
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedMember) return;
    
    try {
      // 프로필 업데이트
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          department: editForm.department || null,
          position: editForm.position || null,
          work_status: editForm.work_status as 'active' | 'freelancer' | 'on_leave' | 'resigned',
        })
        .eq('id', selectedMember.id);

      if (profileError) throw profileError;

      // 역할 업데이트
      const { error: roleError } = await supabase
        .from('user_roles')
        .update({ role: editForm.role as 'admin' | 'director' | 'manager' | 'agent' | 'contractor' })
        .eq('user_id', selectedMember.id);

      if (roleError) throw roleError;

      // 담당 고객사 동기화 (추가/삭제분만 반영)
      const original = selectedMember.clientIds || [];
      const next = editForm.clientIds;
      const toAdd = next.filter((id) => !original.includes(id));
      const toRemove = original.filter((id) => !next.includes(id));

      if (toAdd.length > 0) {
        const { error } = await supabase
          .from('client_assignments')
          .insert(toAdd.map((client_id) => ({ user_id: selectedMember.id, client_id })));
        if (error) throw error;
      }
      if (toRemove.length > 0) {
        const { error } = await supabase
          .from('client_assignments')
          .delete()
          .eq('user_id', selectedMember.id)
          .in('client_id', toRemove);
        if (error) throw error;
      }

      // 주민등록번호 (대표/이사만 수정 가능)
      if (isAdmin) {
        const trimmed = editForm.resident_number.trim();
        const original = selectedMember.resident_number || '';
        if (trimmed !== original) {
          const { error } = await supabase
            .from('member_sensitive')
            .upsert(
              { user_id: selectedMember.id, resident_number: trimmed || null, updated_by: user?.id ?? null },
              { onConflict: 'user_id' },
            );
          if (error) throw error;
        }
      }

      toast.success('구성원 정보가 수정되었습니다');
      setEditDialogOpen(false);
      fetchMembers();
    } catch (error: any) {
      console.error('Error updating member:', error);
      toast.error(error.message || '수정 실패');
    }
  };

  const handleDeactivate = async (member: Member) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ work_status: 'resigned' as const })
        .eq('id', member.id);

      if (error) throw error;

      toast.success(`${member.full_name}님이 비활성화되었습니다`);
      fetchMembers();
    } catch (error: any) {
      console.error('Error deactivating member:', error);
      toast.error(error.message || '비활성화 실패');
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
      <div className="p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">구성원 관리</h1>
            <p className="text-muted-foreground">팀원 정보 및 권한을 관리합니다</p>
          </div>
          {isManagerPlus && (
            <Button onClick={() => toast.info('구성원 초대 기능은 관리자 권한으로 회원가입 후 역할을 배정해주세요.')}>
              <Plus className="mr-2 h-4 w-4" />
              구성원 초대
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="이름 또는 이메일로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="부서 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 부서</SelectItem>
              {DEPARTMENTS.map((dept) => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={positionFilter} onValueChange={setPositionFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="직급 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 직급</SelectItem>
              {POSITIONS.map((pos) => (
                <SelectItem key={pos} value={pos}>{pos}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              필터 초기화
            </Button>
          )}
        </div>

        {/* Members Table */}
        <Card>
          <CardHeader>
            <CardTitle>전체 구성원</CardTitle>
            <CardDescription>총 {filteredMembers.length}명</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>구성원</TableHead>
                  <TableHead>부서</TableHead>
                  <TableHead>직급</TableHead>
                  <TableHead>역할</TableHead>
                  <TableHead>담당 고객사</TableHead>
                  <TableHead>연락처</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>가입일</TableHead>
                  {isAdmin && <TableHead>주민등록번호</TableHead>}
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 10 : 9} className="text-center py-8 text-muted-foreground">
                      {hasActiveFilters ? '검색 결과가 없습니다' : '등록된 구성원이 없습니다'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>{getInitials(member.full_name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{member.full_name}</p>
                            <p className="text-sm text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {member.department ? (
                          <Badge variant="outline">{member.department}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {member.position ? (
                          <span className="font-medium">{member.position}</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>{getRoleBadge(member.role || 'agent')}</TableCell>
                      <TableCell>
                        {member.clientIds.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[220px]">
                            {member.clientIds.map((id) => (
                              <Badge key={id} variant="secondary" className="font-normal">
                                {clientName(id)}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="flex items-center gap-1 text-sm">
                            <Mail className="h-3 w-3" />
                            {member.email}
                          </span>
                          {member.phone && (
                            <span className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {member.phone}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getWorkStatusBadge(member.work_status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(member.created_at), 'yyyy.MM.dd')}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="font-mono text-sm">
                          {member.resident_number || <span className="text-muted-foreground">-</span>}
                        </TableCell>
                      )}
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover">
                            <DropdownMenuItem onClick={() => handleViewDetail(member)}>
                              상세보기
                            </DropdownMenuItem>
                            {isManagerPlus && (
                              <>
                                <DropdownMenuItem onClick={() => handleOpenEdit(member)}>
                                  정보 수정
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => handleDeactivate(member)}
                                >
                                  비활성화
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 상세보기 다이얼로그 */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>구성원 상세 정보</DialogTitle>
            </DialogHeader>
            {selectedMember && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="text-xl">{getInitials(selectedMember.full_name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-lg font-semibold">{selectedMember.full_name}</h3>
                    <p className="text-muted-foreground">{selectedMember.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <Label className="text-muted-foreground text-xs">부서</Label>
                    <p className="font-medium">{selectedMember.department || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">직급</Label>
                    <p className="font-medium">{selectedMember.position || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">역할</Label>
                    <p className="font-medium">{getRoleLabel(selectedMember.role || 'agent')}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">상태</Label>
                    <p className="font-medium">{getWorkStatusLabel(selectedMember.work_status)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">연락처</Label>
                    <p className="font-medium">{selectedMember.phone || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">가입일</Label>
                    <p className="font-medium">{format(new Date(selectedMember.created_at), 'yyyy.MM.dd')}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-muted-foreground text-xs">담당 고객사</Label>
                    {selectedMember.clientIds.length > 0 ? (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {selectedMember.clientIds.map((id) => (
                          <Badge key={id} variant="secondary" className="font-normal">{clientName(id)}</Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="font-medium">-</p>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="col-span-2">
                      <Label className="text-muted-foreground text-xs">주민등록번호</Label>
                      <p className="font-mono font-medium">{selectedMember.resident_number || '-'}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* 정보 수정 다이얼로그 */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>구성원 정보 수정</DialogTitle>
              <DialogDescription>
                {selectedMember?.full_name}님의 정보를 수정합니다
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>부서</Label>
                <Select value={editForm.department || "none"} onValueChange={(v) => setEditForm({ ...editForm, department: v === "none" ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="부서 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">미지정</SelectItem>
                    {DEPARTMENTS.map((dept) => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>직급</Label>
                <Select value={editForm.position || "none"} onValueChange={(v) => setEditForm({ ...editForm, position: v === "none" ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="직급 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">미지정</SelectItem>
                    {POSITIONS.map((pos) => (
                      <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>역할</Label>
                <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="역할 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role} value={role}>{getRoleLabel(role)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>근무 상태</Label>
                <Select value={editForm.work_status} onValueChange={(v) => setEditForm({ ...editForm, work_status: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="상태 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">재직중</SelectItem>
                    <SelectItem value="freelancer">프리랜서</SelectItem>
                    <SelectItem value="on_leave">휴직</SelectItem>
                    <SelectItem value="resigned">퇴사</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>담당 고객사</Label>
                <Select
                  value=""
                  onValueChange={(id) =>
                    setEditForm((f) =>
                      f.clientIds.includes(id) ? f : { ...f, clientIds: [...f.clientIds, id] }
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="고객사 추가..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.filter((c) => !editForm.clientIds.includes(c.id)).length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">추가할 고객사가 없습니다</div>
                    ) : (
                      clients
                        .filter((c) => !editForm.clientIds.includes(c.id))
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))
                    )}
                  </SelectContent>
                </Select>
                {editForm.clientIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {editForm.clientIds.map((id) => (
                      <Badge key={id} variant="secondary" className="gap-1 font-normal">
                        {clientName(id)}
                        <button
                          type="button"
                          onClick={() =>
                            setEditForm((f) => ({ ...f, clientIds: f.clientIds.filter((x) => x !== id) }))
                          }
                          className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
                          aria-label="제거"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              {isAdmin && (
                <div className="space-y-2">
                  <Label>주민등록번호</Label>
                  <Input
                    value={editForm.resident_number}
                    onChange={(e) => setEditForm({ ...editForm, resident_number: e.target.value })}
                    placeholder="000000-0000000"
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">대표 / 이사만 조회·수정할 수 있습니다.</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>취소</Button>
              <Button onClick={handleSaveEdit}>저장</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
