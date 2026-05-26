import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { BillingRow } from '@/pages/Revenue';

interface InvoiceRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: BillingRow | null;
  billingMonth: string;
  onSuccess: () => void;
}

const today = () => format(new Date(), 'yyyy-MM-dd');

export function InvoiceRecordDialog({ open, onOpenChange, row, billingMonth, onSuccess }: InvoiceRecordDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [billedAmount, setBilledAmount] = useState('');
  const [invoiceIssued, setInvoiceIssued] = useState(false);
  const [invoiceIssuedDate, setInvoiceIssuedDate] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [paidDate, setPaidDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open || !row) return;
    setBilledAmount(String(Math.round(row.billedAmount)));
    setInvoiceIssued(row.invoiceIssued);
    setInvoiceIssuedDate(row.invoiceIssuedDate || '');
    setIsPaid(row.isPaid);
    setPaidDate(row.paidDate || '');
    setNotes(row.notes || '');
  }, [open, row]);

  if (!row) return null;

  const billedNum = Number(billedAmount) || 0;
  const vat = Math.round(billedNum * 0.1);
  const total = billedNum + vat;
  const fmt = (n: number) => n.toLocaleString('ko-KR');

  const handleSave = async () => {
    setLoading(true);
    try {
      const payload = {
        client_id: row.clientId,
        billing_month: billingMonth,
        base_amount: row.baseAmount,
        billed_amount: billedNum,
        is_prorated: row.isProrated,
        prorate_business_days: row.prorateBusinessDays,
        total_business_days: row.totalBusinessDays,
        invoice_issued: invoiceIssued,
        invoice_issued_date: invoiceIssued ? (invoiceIssuedDate || today()) : null,
        is_paid: isPaid,
        paid_date: isPaid ? (paidDate || today()) : null,
        notes: notes || null,
        created_by: user?.id ?? null,
      };

      const { error } = await supabase
        .from('client_invoices')
        .upsert(payload, { onConflict: 'client_id,billing_month' });
      if (error) throw error;

      toast.success('청구 내역이 저장되었습니다');
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error saving invoice:', error);
      toast.error(error.message || '저장에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{row.clientName} · {billingMonth}</DialogTitle>
          <DialogDescription>월 계약금액, 세금계산서 발행, 수금 현황을 기록합니다.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          <div className="rounded-md bg-muted p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">월 계약금액 (VAT 별도)</span>
              <span>{fmt(row.baseAmount)}원</span>
            </div>
            {row.isProrated && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">일할계산 (영업일)</span>
                <span>{row.prorateBusinessDays} / {row.totalBusinessDays}일</span>
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label>청구액 (VAT 별도, 원)</Label>
            <Input type="number" value={billedAmount} onChange={(e) => setBilledAmount(e.target.value)} />
            <div className="text-xs text-muted-foreground">
              VAT(10%) {fmt(vat)}원 · 합계 <span className="font-semibold text-foreground">{fmt(total)}원</span>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm">세금계산서 발행</Label>
            </div>
            <Switch checked={invoiceIssued} onCheckedChange={setInvoiceIssued} />
          </div>
          {invoiceIssued && (
            <div className="grid gap-2">
              <Label>발행일</Label>
              <Input type="date" value={invoiceIssuedDate} onChange={(e) => setInvoiceIssuedDate(e.target.value)} placeholder={today()} />
            </div>
          )}

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm">수금 완료</Label>
              <p className="text-xs text-muted-foreground">완납 처리 시 미수금에서 제외됩니다</p>
            </div>
            <Switch checked={isPaid} onCheckedChange={setIsPaid} />
          </div>
          {isPaid && (
            <div className="grid gap-2">
              <Label>수금일</Label>
              <Input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} placeholder={today()} />
            </div>
          )}

          <div className="grid gap-2">
            <Label>메모</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="비고" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>취소</Button>
          <Button onClick={handleSave} disabled={loading}>{loading ? '저장중...' : '저장'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
