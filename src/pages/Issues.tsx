import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getIssuePriorityBadge, getIssueStatusBadge } from '@/components/ui/status-badge';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import { IssueDialog } from '@/components/dialogs/IssueDialog';
import { DeleteConfirmDialog } from '@/components/dialogs/DeleteConfirmDialog';
import type { Tables } from '@/integrations/supabase/types';

type Issue = Tables<'issues'> & {
  client?: { name: string } | null;
  reported_by_profile?: { full_name: string } | null;
  assigned_to_profile?: { full_name: string } | null;
  consultation?: { customer_name: string | null } | null;
};

export default function Issues() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [issueToDelete, setIssueToDelete] = useState<Issue | null>(null);

  const isManagerPlus = role === 'admin' || role === 'director' || role === 'manager';

  const { data: issues, isLoading } = useQuery({
    queryKey: ['issues', statusFilter, priorityFilter],
    queryFn: async () => {
      let query = supabase
        .from('issues')
        .select(`
          *,
          client:clients(name),
          reported_by_profile:profiles!issues_reported_by_fkey(full_name),
          assigned_to_profile:profiles!issues_assigned_to_fkey(full_name),
          consultation:consultations(customer_name)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as 'open' | 'in_progress' | 'resolved' | 'closed');
      }
      if (priorityFilter !== 'all') {
        query = query.eq('priority', priorityFilter as 'low' | 'medium' | 'high' | 'critical');
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Issue[];
    },
  });

  const filteredIssues = issues?.filter(issue =>
    issue.title.toLowerCase().includes(search.toLowerCase()) ||
    issue.client?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (issue: Issue) => {
    setSelectedIssue(issue);
    setDialogOpen(true);
  };

  const handleDelete = (issue: Issue) => {
    setIssueToDelete(issue);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!issueToDelete) return;
    
    const { error } = await supabase
      .from('issues')
      .delete()
      .eq('id', issueToDelete.id);

    if (error) {
      toast.error('이슈 삭제에 실패했습니다');
    } else {
      toast.success('이슈가 삭제되었습니다');
      queryClient.invalidateQueries({ queryKey: ['issues'] });
    }
    setDeleteDialogOpen(false);
    setIssueToDelete(null);
  };

  const handleStatusChange = async (issue: Issue, newStatus: 'open' | 'in_progress' | 'resolved' | 'closed') => {
    const updateData: { status: typeof newStatus; resolved_at?: string | null } = { status: newStatus };
    
    if (newStatus === 'resolved' || newStatus === 'closed') {
      updateData.resolved_at = new Date().toISOString();
    } else {
      updateData.resolved_at = null;
    }

    const { error } = await supabase
      .from('issues')
      .update(updateData)
      .eq('id', issue.id);

    if (error) {
      toast.error('상태 변경에 실패했습니다');
    } else {
      toast.success('상태가 변경되었습니다');
      queryClient.invalidateQueries({ queryKey: ['issues'] });
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedIssue(null);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">이슈 관리</h1>
            <p className="text-muted-foreground">상담 중 발생한 이슈와 클레임을 관리합니다</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            이슈 등록
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="이슈 제목, 고객사 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 상태</SelectItem>
              <SelectItem value="open">대기</SelectItem>
              <SelectItem value="in_progress">처리중</SelectItem>
              <SelectItem value="resolved">해결됨</SelectItem>
              <SelectItem value="closed">종료</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="우선순위" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 우선순위</SelectItem>
              <SelectItem value="critical">긴급</SelectItem>
              <SelectItem value="high">높음</SelectItem>
              <SelectItem value="medium">보통</SelectItem>
              <SelectItem value="low">낮음</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>우선순위</TableHead>
                <TableHead>제목</TableHead>
                <TableHead>고객사</TableHead>
                <TableHead>보고자</TableHead>
                <TableHead>담당자</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>등록일</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10">
                    로딩중...
                  </TableCell>
                </TableRow>
              ) : filteredIssues?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10">
                    <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">등록된 이슈가 없습니다</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredIssues?.map((issue) => (
                  <TableRow key={issue.id}>
                    <TableCell>
                      {getIssuePriorityBadge(issue.priority)}
                    </TableCell>
                    <TableCell className="font-medium max-w-[250px] truncate">
                      {issue.title}
                    </TableCell>
                    <TableCell>{issue.client?.name || '-'}</TableCell>
                    <TableCell>{issue.reported_by_profile?.full_name || '-'}</TableCell>
                    <TableCell>{issue.assigned_to_profile?.full_name || '-'}</TableCell>
                    <TableCell>
                      {getIssueStatusBadge(issue.status)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(issue.created_at), 'MM.dd', { locale: ko })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(issue)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            수정
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleStatusChange(issue, 'open')}
                            disabled={issue.status === 'open'}
                          >
                            대기로 변경
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleStatusChange(issue, 'in_progress')}
                            disabled={issue.status === 'in_progress'}
                          >
                            처리중으로 변경
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleStatusChange(issue, 'resolved')}
                            disabled={issue.status === 'resolved'}
                          >
                            해결됨으로 변경
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleStatusChange(issue, 'closed')}
                            disabled={issue.status === 'closed'}
                          >
                            종료로 변경
                          </DropdownMenuItem>
                          {isManagerPlus && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleDelete(issue)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                삭제
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
        </div>
      </div>

      <IssueDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        issue={selectedIssue}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="이슈 삭제"
        description="이 이슈를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
      />
    </AppLayout>
  );
}
