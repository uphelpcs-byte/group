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

interface ConsultationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consultation?: {
    id: string;
    content: string;
    status: string;
    consultation_type: string | null;
    customer_name: string | null;
    customer_contact: string | null;
    client_id: string;
  } | null;
  onSuccess: () => void;
}

export function ConsultationDialog({ open, onOpenChange, consultation, onSuccess }: ConsultationDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  
  const [formData, setFormData] = useState({
    client_id: '',
    consultation_type: 'channel_talk',
    customer_name: '',
    customer_contact: '',
    content: '',
    status: 'pending' as 'pending' | 'in_progress' | 'completed' | 'escalated',
  });

  useEffect(() => {
    if (open) {
      fetchClients();
      if (consultation) {
        setFormData({
          client_id: consultation.client_id,
          consultation_type: consultation.consultation_type || 'channel_talk',
          customer_name: consultation.customer_name || '',
          customer_contact: consultation.customer_contact || '',
          content: consultation.content,
          status: consultation.status as 'pending' | 'in_progress' | 'completed' | 'escalated',
        });
      } else {
        setFormData({
          client_id: '',
          consultation_type: 'channel_talk',
          customer_name: '',
          customer_contact: '',
          content: '',
          status: 'pending',
        });
      }
    }
  }, [open, consultation]);

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('id, name').order('name');
    setClients(data || []);
  };

  const handleSubmit = async () => {
    if (!formData.client_id || !formData.content) {
      toast.error('고객사와 상담 내용을 입력해주세요');
      return;
    }

    setLoading(true);
    try {
      if (consultation) {
        // Update
        const { error } = await supabase
          .from('consultations')
          .update({
            client_id: formData.client_id,
            consultation_type: formData.consultation_type,
            customer_name: formData.customer_name || null,
            customer_contact: formData.customer_contact || null,
            content: formData.content,
            status: formData.status,
          })
          .eq('id', consultation.id);

        if (error) throw error;
        toast.success('상담이 수정되었습니다');
      } else {
        // Create
        const { error } = await supabase.from('consultations').insert({
          client_id: formData.client_id,
          agent_id: user!.id,
          consultation_type: formData.consultation_type,
          customer_name: formData.customer_name || null,
          customer_contact: formData.customer_contact || null,
          content: formData.content,
          status: formData.status,
        });

        if (error) throw error;
        toast.success('상담이 등록되었습니다');
      }

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error saving consultation:', error);
      toast.error('저장에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{consultation ? '상담 수정' : '상담 등록'}</DialogTitle>
          <DialogDescription>상담 내용을 입력하세요.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>고객사 *</Label>
            <Select value={formData.client_id} onValueChange={(v) => setFormData({ ...formData, client_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="고객사 선택" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>채널</Label>
              <Select value={formData.consultation_type} onValueChange={(v) => setFormData({ ...formData, consultation_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="channel_talk">채널톡</SelectItem>
                  <SelectItem value="kakao">카카오톡</SelectItem>
                  <SelectItem value="phone">전화</SelectItem>
                  <SelectItem value="email">이메일</SelectItem>
                  <SelectItem value="other">기타</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>상태</Label>
              <Select value={formData.status} onValueChange={(v: 'pending' | 'in_progress' | 'completed' | 'escalated') => setFormData({ ...formData, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">대기중</SelectItem>
                  <SelectItem value="in_progress">진행중</SelectItem>
                  <SelectItem value="completed">완료</SelectItem>
                  <SelectItem value="escalated">에스컬레이션</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>고객명</Label>
              <Input
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                placeholder="고객 이름"
              />
            </div>
            <div className="grid gap-2">
              <Label>연락처</Label>
              <Input
                value={formData.customer_contact}
                onChange={(e) => setFormData({ ...formData, customer_contact: e.target.value })}
                placeholder="전화번호 또는 이메일"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>상담 내용 *</Label>
            <Textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="상담 내용을 상세히 입력하세요"
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>취소</Button>
          <Button onClick={handleSubmit} disabled={loading || !formData.client_id || !formData.content}>
            {loading ? '저장중...' : (consultation ? '수정' : '등록')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
