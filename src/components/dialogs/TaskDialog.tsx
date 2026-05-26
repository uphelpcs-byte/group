import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Client {
  id: string;
  name: string;
}

interface Profile {
  id: string;
  full_name: string;
}

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    due_date: string | null;
    assignee_id: string | null;
    client_id: string | null;
  } | null;
  onSuccess: () => void;
}

export function TaskDialog({ open, onOpenChange, task, onSuccess }: TaskDialogProps) {
  const { user, isManagerPlus } = useAuth();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    client_id: '',
    assignee_id: '',
    due_date: '',
    status: 'pending' as 'pending' | 'in_progress' | 'review' | 'completed',
  });

  useEffect(() => {
    if (open) {
      fetchClients();
      fetchProfiles();
      if (task) {
        setFormData({
          title: task.title,
          description: task.description || '',
          client_id: task.client_id || '',
          assignee_id: task.assignee_id || '',
          due_date: task.due_date || '',
          status: task.status as 'pending' | 'in_progress' | 'review' | 'completed',
        });
      } else {
        setFormData({
          title: '',
          description: '',
          client_id: '',
          assignee_id: user?.id || '',
          due_date: '',
          status: 'pending',
        });
      }
    }
  }, [open, task, user]);

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('id, name').order('name');
    setClients(data || []);
  };

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name').order('full_name');
    setProfiles(data || []);
  };

  const handleSubmit = async () => {
    if (!formData.title) {
      toast.error('업무명을 입력해주세요');
      return;
    }

    setLoading(true);
    try {
      if (task) {
        // Update
        const { error } = await supabase
          .from('tasks')
          .update({
            title: formData.title,
            description: formData.description || null,
            client_id: formData.client_id || null,
            assignee_id: formData.assignee_id || null,
            due_date: formData.due_date || null,
            status: formData.status,
            completed_at: formData.status === 'completed' ? new Date().toISOString() : null,
          })
          .eq('id', task.id);

        if (error) throw error;
        toast.success('업무가 수정되었습니다');
      } else {
        // Create
        const { error } = await supabase.from('tasks').insert({
          title: formData.title,
          description: formData.description || null,
          client_id: formData.client_id || null,
          assignee_id: formData.assignee_id || null,
          due_date: formData.due_date || null,
          status: formData.status,
          created_by: user!.id,
        });

        if (error) throw error;
        toast.success('업무가 등록되었습니다');
      }

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error saving task:', error);
      toast.error('저장에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{task ? '업무 수정' : '업무 추가'}</DialogTitle>
          <DialogDescription>업무 정보를 입력하세요.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>업무명 *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="업무 제목"
            />
          </div>
          <div className="grid gap-2">
            <Label>설명</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="업무에 대한 상세 설명"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>고객사</Label>
              <Select value={formData.client_id || "none"} onValueChange={(v) => setFormData({ ...formData, client_id: v === "none" ? "" : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="선택 (옵션)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">없음</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>담당자</Label>
              <Select value={formData.assignee_id || "none"} onValueChange={(v) => setFormData({ ...formData, assignee_id: v === "none" ? "" : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="담당자 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">미배정</SelectItem>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>{profile.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>마감일</Label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>상태</Label>
              <Select value={formData.status} onValueChange={(v: 'pending' | 'in_progress' | 'review' | 'completed') => setFormData({ ...formData, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">대기중</SelectItem>
                  <SelectItem value="in_progress">진행중</SelectItem>
                  <SelectItem value="review">검토중</SelectItem>
                  <SelectItem value="completed">완료</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>취소</Button>
          <Button onClick={handleSubmit} disabled={loading || !formData.title}>
            {loading ? '저장중...' : (task ? '수정' : '등록')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
