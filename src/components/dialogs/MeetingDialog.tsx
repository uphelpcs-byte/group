import { useEffect, useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Meeting = {
  id: string;
  title: string;
  description: string | null;
  meeting_date: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  status: string;
  created_by: string;
};

type MeetingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting: Meeting | null;
};

const initialFormData = {
  title: '',
  description: '',
  meeting_date: '',
  start_time: '',
  end_time: '',
  location: '',
  status: 'scheduled',
};

export function MeetingDialog({ open, onOpenChange, meeting }: MeetingDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    if (meeting) {
      setFormData({
        title: meeting.title,
        description: meeting.description || '',
        meeting_date: meeting.meeting_date,
        start_time: meeting.start_time.slice(0, 5),
        end_time: meeting.end_time?.slice(0, 5) || '',
        location: meeting.location || '',
        status: meeting.status,
      });
    } else {
      setFormData(initialFormData);
    }
  }, [meeting, open]);

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        title: data.title,
        description: data.description || null,
        meeting_date: data.meeting_date,
        start_time: data.start_time,
        end_time: data.end_time || null,
        location: data.location || null,
        status: data.status,
        created_by: user!.id,
      };

      if (meeting) {
        const { error } = await supabase
          .from('meetings')
          .update(payload)
          .eq('id', meeting.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('meetings').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      toast.success(meeting ? '회의가 수정되었습니다' : '회의가 등록되었습니다');
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || '저장 실패');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('회의 제목을 입력해주세요');
      return;
    }
    if (!formData.meeting_date) {
      toast.error('회의 날짜를 선택해주세요');
      return;
    }
    if (!formData.start_time) {
      toast.error('시작 시간을 입력해주세요');
      return;
    }
    mutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{meeting ? '회의 수정' : '새 회의 등록'}</DialogTitle>
          <DialogDescription>
            회의 정보를 입력해주세요.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="title">회의 제목 *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="예: 주간 CS 회의"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">설명</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="회의 목적이나 내용을 간략히 작성해주세요"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="meeting_date">날짜 *</Label>
              <Input
                id="meeting_date"
                type="date"
                value={formData.meeting_date}
                onChange={(e) => setFormData({ ...formData, meeting_date: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">상태</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">예정</SelectItem>
                  <SelectItem value="in_progress">진행중</SelectItem>
                  <SelectItem value="completed">완료</SelectItem>
                  <SelectItem value="cancelled">취소</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="start_time">시작 시간 *</Label>
              <Input
                id="start_time"
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="end_time">종료 시간</Label>
              <Input
                id="end_time"
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="location">장소</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="예: 회의실 A, Zoom 링크 등"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? '저장중...' : meeting ? '수정' : '등록'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
