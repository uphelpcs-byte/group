-- 급여 설정 테이블 (구성원별 시급)
CREATE TABLE public.payroll_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hourly_rate numeric NOT NULL DEFAULT 0,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  UNIQUE(user_id, effective_from)
);

-- RLS 활성화
ALTER TABLE public.payroll_settings ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 관리자만 조회
CREATE POLICY "Only admins can view payroll settings"
  ON public.payroll_settings FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS 정책: 관리자만 생성
CREATE POLICY "Only admins can create payroll settings"
  ON public.payroll_settings FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS 정책: 관리자만 수정
CREATE POLICY "Only admins can update payroll settings"
  ON public.payroll_settings FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS 정책: 관리자만 삭제
CREATE POLICY "Only admins can delete payroll settings"
  ON public.payroll_settings FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- updated_at 트리거
CREATE TRIGGER update_payroll_settings_updated_at
  BEFORE UPDATE ON public.payroll_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();