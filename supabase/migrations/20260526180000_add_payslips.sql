-- 급여 명세서 발급/조회: 대표가 발급한 시점의 급여 계산 스냅샷
-- (이 파일만 실행하면 됩니다. 나머지 기존 마이그레이션은 이미 적용되어 있습니다.)
CREATE TABLE IF NOT EXISTS public.payslips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pay_month text NOT NULL,                           -- 'YYYY-MM'
  hourly_rate numeric NOT NULL DEFAULT 0,            -- 발급 시점 시급
  total_hours numeric NOT NULL DEFAULT 0,            -- 총 근무시간(보정 반영)
  base_pay numeric NOT NULL DEFAULT 0,               -- 기본급
  weekly_holiday_pay numeric NOT NULL DEFAULT 0,     -- 주휴수당
  total_pay numeric NOT NULL DEFAULT 0,              -- 총 지급액
  weekly_breakdown jsonb,                            -- [{ week, hours }]
  memo text,                                         -- 발급 시점 메모
  issued_at timestamptz NOT NULL DEFAULT now(),      -- 발급 일시
  issued_by uuid,                                    -- 발급자(대표)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, pay_month)
);

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

-- 본인 명세서는 누구나 조회 가능, 대표는 전체 조회 가능
DROP POLICY IF EXISTS "Users can view own payslips" ON public.payslips;
CREATE POLICY "Users can view own payslips"
  ON public.payslips FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- 발급(생성)은 대표만
DROP POLICY IF EXISTS "Only admins can create payslips" ON public.payslips;
CREATE POLICY "Only admins can create payslips"
  ON public.payslips FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 재발급(수정)은 대표만
DROP POLICY IF EXISTS "Only admins can update payslips" ON public.payslips;
CREATE POLICY "Only admins can update payslips"
  ON public.payslips FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 삭제는 대표만
DROP POLICY IF EXISTS "Only admins can delete payslips" ON public.payslips;
CREATE POLICY "Only admins can delete payslips"
  ON public.payslips FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- updated_at 트리거
DROP TRIGGER IF EXISTS update_payslips_updated_at ON public.payslips;
CREATE TRIGGER update_payslips_updated_at
  BEFORE UPDATE ON public.payslips
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_payslips_user_id ON public.payslips (user_id);
CREATE INDEX IF NOT EXISTS idx_payslips_pay_month ON public.payslips (pay_month);
