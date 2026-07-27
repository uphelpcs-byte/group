import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: any | null;
  onSuccess: () => void;
}

const emptyForm = {
  name: '',
  business_number: '',
  industry: '',
  address: '',
  status: 'pilot' as 'pilot' | 'active' | 'terminated',
  notes: '',
  channeltalk_access_key: '',
  channeltalk_secret: '',
  manager_email: '',
  monthly_fee: '',
  contract_start_date: '',
  contract_end_date: '',
  report_show_tags: true,
  report_show_first_response: true,
  report_show_response_rate: false,
  report_top_comment: '',
};

export function ClientDialog({ open, onOpenChange, client, onSuccess }: ClientDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    if (!open) return;
    if (client) {
      setFormData({
        name: client.name || '',
        business_number: client.business_number || '',
        industry: client.industry || '',
        address: client.address || '',
        status: (client.status as any) || 'pilot',
        notes: client.notes || '',
        channeltalk_access_key: client.channeltalk_access_key || '',
        channeltalk_secret: client.channeltalk_secret || '',
        manager_email: client.manager_email || '',
        monthly_fee: client.monthly_fee != null ? String(client.monthly_fee) : '',
        contract_start_date: client.contract_start_date || '',
        contract_end_date: client.contract_end_date || '',
        report_show_tags: client.report_show_tags ?? true,
        report_show_first_response: client.report_show_first_response ?? true,
        report_show_response_rate: client.report_show_response_rate ?? false,
        report_top_comment: client.report_top_comment || '',
      });
    } else {
      setFormData(emptyForm);
    }
  }, [open, client]);

  const maskKey = (v: string) => (v.length > 8 ? `${v.slice(0, 4)}••••${v.slice(-4)}` : v);

  const handleSubmit = async () => {
    if (!formData.name) {
      toast.error('회사명을 입력해주세요');
      return;
    }
    if (formData.manager_email && !/^\S+@\S+\.\S+$/.test(formData.manager_email)) {
      toast.error('담당자 이메일 형식이 올바르지 않습니다');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: formData.name,
        business_number: formData.business_number || null,
        industry: formData.industry || null,
        address: formData.address || null,
        status: formData.status,
        notes: formData.notes || null,
        channeltalk_access_key: formData.channeltalk_access_key || null,
        channeltalk_secret: formData.channeltalk_secret || null,
        manager_email: formData.manager_email || null,
        monthly_fee: formData.monthly_fee ? Number(formData.monthly_fee) : null,
        contract_start_date: formData.contract_start_date || null,
        contract_end_date: formData.contract_end_date || null,
        report_show_tags: formData.report_show_tags,
        report_show_first_response: formData.report_show_first_response,
        report_show_response_rate: formData.report_show_response_rate,
        report_top_comment: formData.report_top_comment || null,
      };

      if (client) {
        const { error } = await supabase.from('clients').update(payload).eq('id', client.id);
        if (error) throw error;
        toast.success('고객사 정보가 수정되었습니다');
      } else {
        const { error } = await supabase.from('clients').insert(payload);
        if (error) throw error;
        toast.success('고객사가 등록되었습니다');
      }

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error saving client:', error);
      toast.error('저장에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{client ? '고객사 수정' : '새 고객사 등록'}</DialogTitle>
          <DialogDescription>고객사 기본 정보 및 리포트 설정을 입력하세요.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>회사명 *</Label>
            <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="(주)회사명" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>사업자번호</Label>
              <Input value={formData.business_number} onChange={(e) => setFormData({ ...formData, business_number: e.target.value })} placeholder="000-00-00000" />
            </div>
            <div className="grid gap-2">
              <Label>업종</Label>
              <Input value={formData.industry} onChange={(e) => setFormData({ ...formData, industry: e.target.value })} placeholder="예: IT서비스" />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>주소</Label>
            <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="주소 입력" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>계약 상태</Label>
              <Select value={formData.status} onValueChange={(v: 'pilot' | 'active' | 'terminated') => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pilot">파일럿</SelectItem>
                  <SelectItem value="active">유료 계약</SelectItem>
                  <SelectItem value="terminated">종료</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>계약 시작일</Label>
              <Input type="date" value={formData.contract_start_date} onChange={(e) => setFormData({ ...formData, contract_start_date: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>계약 종료일 (선택)</Label>
            <Input type="date" value={formData.contract_end_date} onChange={(e) => setFormData({ ...formData, contract_end_date: e.target.value })} />
            <p className="text-xs text-muted-foreground">종료일을 설정하면 이후 월은 매출관리에서 자동 제외되고, 종료월은 영업일 기준으로 일할계산됩니다.</p>
          </div>

          <Separator className="my-2" />
          <div className="text-sm font-semibold">계약 및 담당자</div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>담당자 이메일</Label>
              <Input type="email" value={formData.manager_email} onChange={(e) => setFormData({ ...formData, manager_email: e.target.value })} placeholder="manager@company.com" />
            </div>
            <div className="grid gap-2">
              <Label>월 계약금액 (VAT 별도, 원)</Label>
              <Input type="number" value={formData.monthly_fee} onChange={(e) => setFormData({ ...formData, monthly_fee: e.target.value })} placeholder="예: 1000000" />
            </div>
          </div>

          <Separator className="my-2" />
          <div className="text-sm font-semibold">채널톡 연동</div>

          <div className="grid gap-2">
            <Label>채널톡 Access Key</Label>
            <Input
              value={formData.channeltalk_access_key}
              onChange={(e) => setFormData({ ...formData, channeltalk_access_key: e.target.value })}
              placeholder="x-access-key"
            />
            {client && formData.channeltalk_access_key && (
              <div className="text-xs text-muted-foreground">표시: {maskKey(formData.channeltalk_access_key)}</div>
            )}
          </div>
          <div className="grid gap-2">
            <Label>채널톡 Secret</Label>
            <Input
              type="password"
              value={formData.channeltalk_secret}
              onChange={(e) => setFormData({ ...formData, channeltalk_secret: e.target.value })}
              placeholder="x-access-secret"
            />
          </div>

          <Separator className="my-2" />
          <div className="text-sm font-semibold">리포트 설정</div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm">태그 표시</Label>
              <p className="text-xs text-muted-foreground">태그가 수집되지 않으면 자동으로 숨김</p>
            </div>
            <Switch checked={formData.report_show_tags} onCheckedChange={(v) => setFormData({ ...formData, report_show_tags: v })} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm">평균 첫 응답시간 표시</Label>
            </div>
            <Switch checked={formData.report_show_first_response} onCheckedChange={(v) => setFormData({ ...formData, report_show_first_response: v })} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm">응대율 KPI 표시</Label>
              <p className="text-xs text-muted-foreground">응대 수 / 인입 수 (%)</p>
            </div>
            <Switch checked={formData.report_show_response_rate} onCheckedChange={(v) => setFormData({ ...formData, report_show_response_rate: v })} />
          </div>

          <div className="grid gap-2">
            <Label>리포트 상단 코멘트 (선택)</Label>
            <Textarea
              value={formData.report_top_comment}
              onChange={(e) => setFormData({ ...formData, report_top_comment: e.target.value })}
              placeholder="이번 주 운영 코멘트를 입력하면 리포트 상단에 표시됩니다"
              rows={3}
            />
          </div>

          <Separator className="my-2" />
          <div className="grid gap-2">
            <Label>메모</Label>
            <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="추가 메모" rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>취소</Button>
          <Button onClick={handleSubmit} disabled={loading || !formData.name}>
            {loading ? '저장중...' : (client ? '수정' : '등록')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
