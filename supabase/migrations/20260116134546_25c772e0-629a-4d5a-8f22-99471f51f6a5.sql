-- 스케줄 가용성 테이블 (상담원이 근무 가능한 시간대 등록)
CREATE TABLE public.schedule_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, work_date, start_time, end_time)
);

-- 확정된 스케줄 테이블 (관리자가 확정 배정)
CREATE TABLE public.schedule_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  availability_id uuid NOT NULL REFERENCES public.schedule_availability(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  assigned_by uuid NOT NULL REFERENCES auth.users(id),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS 활성화
ALTER TABLE public.schedule_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_assignments ENABLE ROW LEVEL SECURITY;

-- schedule_availability RLS 정책
CREATE POLICY "Users can view own availability"
  ON public.schedule_availability FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Managers can view all availability"
  ON public.schedule_availability FOR SELECT
  USING (is_manager_plus());

CREATE POLICY "Users can create own availability"
  ON public.schedule_availability FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own availability"
  ON public.schedule_availability FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own availability"
  ON public.schedule_availability FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Managers can delete any availability"
  ON public.schedule_availability FOR DELETE
  USING (is_manager_plus());

-- schedule_assignments RLS 정책
CREATE POLICY "Users can view own assignments"
  ON public.schedule_assignments FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Managers can view all assignments"
  ON public.schedule_assignments FOR SELECT
  USING (is_manager_plus());

CREATE POLICY "Managers can create assignments"
  ON public.schedule_assignments FOR INSERT
  WITH CHECK (is_manager_plus());

CREATE POLICY "Managers can update assignments"
  ON public.schedule_assignments FOR UPDATE
  USING (is_manager_plus())
  WITH CHECK (is_manager_plus());

CREATE POLICY "Managers can delete assignments"
  ON public.schedule_assignments FOR DELETE
  USING (is_manager_plus());

-- updated_at 트리거
CREATE TRIGGER update_schedule_availability_updated_at
  BEFORE UPDATE ON public.schedule_availability
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_schedule_assignments_updated_at
  BEFORE UPDATE ON public.schedule_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();