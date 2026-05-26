-- 근태 기록 테이블
CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clock_in timestamp with time zone NOT NULL DEFAULT now(),
  clock_out timestamp with time zone,
  work_date date NOT NULL DEFAULT CURRENT_DATE,
  total_hours numeric GENERATED ALWAYS AS (
    CASE WHEN clock_out IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600 
    ELSE NULL END
  ) STORED,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS 활성화
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 본인 기록 조회
CREATE POLICY "Users can view own attendance"
  ON public.attendance_records FOR SELECT
  USING (user_id = auth.uid());

-- RLS 정책: 관리자 전체 조회
CREATE POLICY "Managers can view all attendance"
  ON public.attendance_records FOR SELECT
  USING (is_manager_plus());

-- RLS 정책: 본인 기록 생성
CREATE POLICY "Users can create own attendance"
  ON public.attendance_records FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- RLS 정책: 본인 기록 수정 (퇴근 처리)
CREATE POLICY "Users can update own attendance"
  ON public.attendance_records FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS 정책: 관리자 수정
CREATE POLICY "Managers can update attendance"
  ON public.attendance_records FOR UPDATE
  USING (is_manager_plus())
  WITH CHECK (is_manager_plus());

-- RLS 정책: 관리자 삭제
CREATE POLICY "Managers can delete attendance"
  ON public.attendance_records FOR DELETE
  USING (is_manager_plus());

-- updated_at 트리거
CREATE TRIGGER update_attendance_records_updated_at
  BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();