-- 매출 관리: 고객사 월별 청구/수금 내역
-- (이 파일만 실행하면 됩니다. 나머지 기존 마이그레이션은 이미 적용되어 있습니다.)
CREATE TABLE IF NOT EXISTS public.client_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  billing_month text NOT NULL,                       -- 'YYYY-MM'
  base_amount numeric NOT NULL DEFAULT 0,            -- 월 계약금액 (VAT 별도)
  billed_amount numeric NOT NULL DEFAULT 0,          -- 실제 청구액 (일할계산 반영, VAT 별도)
  is_prorated boolean NOT NULL DEFAULT false,        -- 일할계산 적용 여부
  prorate_business_days integer,                     -- 청구 대상 영업일수
  total_business_days integer,                       -- 해당 월 전체 영업일수
  invoice_issued boolean NOT NULL DEFAULT false,     -- 세금계산서 발행 여부
  invoice_issued_date date,                          -- 세금계산서 발행일
  is_paid boolean NOT NULL DEFAULT false,            -- 수금(완납) 여부
  paid_date date,                                    -- 수금일
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE(client_id, billing_month)
);

ALTER TABLE public.client_invoices ENABLE ROW LEVEL SECURITY;

-- 대표(admin)만 조회/생성/수정/삭제 (매출·인건비·손익은 민감 정보)
DROP POLICY IF EXISTS "Only admins can view client invoices" ON public.client_invoices;
CREATE POLICY "Only admins can view client invoices"
  ON public.client_invoices FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Only admins can create client invoices" ON public.client_invoices;
CREATE POLICY "Only admins can create client invoices"
  ON public.client_invoices FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Only admins can update client invoices" ON public.client_invoices;
CREATE POLICY "Only admins can update client invoices"
  ON public.client_invoices FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Only admins can delete client invoices" ON public.client_invoices;
CREATE POLICY "Only admins can delete client invoices"
  ON public.client_invoices FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- updated_at 트리거
DROP TRIGGER IF EXISTS update_client_invoices_updated_at ON public.client_invoices;
CREATE TRIGGER update_client_invoices_updated_at
  BEFORE UPDATE ON public.client_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_client_invoices_billing_month
  ON public.client_invoices (billing_month);
CREATE INDEX IF NOT EXISTS idx_client_invoices_client_id
  ON public.client_invoices (client_id);
