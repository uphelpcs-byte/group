-- 미팅 일정 관리 (대표/이사 전용) + 하루전/당일 알림
-- (이 파일만 실행하면 됩니다. 나머지 기존 마이그레이션은 이미 적용되어 있습니다.)

CREATE TABLE IF NOT EXISTS public.meeting_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,              -- 업체명
  location text,                           -- 장소
  meeting_date date NOT NULL,              -- 날짜
  meeting_time time NOT NULL,              -- 시간
  agenda text,                             -- 아젠다
  reminded_d1 boolean NOT NULL DEFAULT false,    -- 하루 전 알림 발송 여부
  reminded_dday boolean NOT NULL DEFAULT false,  -- 당일 알림 발송 여부
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_schedules ENABLE ROW LEVEL SECURITY;

-- 대표(admin)만 조회/생성/수정/삭제
DROP POLICY IF EXISTS "Only admins can view meetings" ON public.meeting_schedules;
CREATE POLICY "Only admins can view meetings"
  ON public.meeting_schedules FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Only admins can create meetings" ON public.meeting_schedules;
CREATE POLICY "Only admins can create meetings"
  ON public.meeting_schedules FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Only admins can update meetings" ON public.meeting_schedules;
CREATE POLICY "Only admins can update meetings"
  ON public.meeting_schedules FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Only admins can delete meetings" ON public.meeting_schedules;
CREATE POLICY "Only admins can delete meetings"
  ON public.meeting_schedules FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS update_meeting_schedules_updated_at ON public.meeting_schedules;
CREATE TRIGGER update_meeting_schedules_updated_at
  BEFORE UPDATE ON public.meeting_schedules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_meeting_schedules_date ON public.meeting_schedules (meeting_date);

-- ============================================================
-- 미팅 알림 처리 (하루 전 / 당일) — 클라이언트가 앱 진입 시 호출
-- 플래그(reminded_d1/dday)로 중복 발송 방지. KST 기준 날짜 비교.
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_meeting_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m record;
  admin_id uuid;
  today_kst date := (now() AT TIME ZONE 'Asia/Seoul')::date;
BEGIN
  -- 하루 전(D-1)
  FOR m IN
    UPDATE public.meeting_schedules
    SET reminded_d1 = true
    WHERE meeting_date = today_kst + 1 AND reminded_d1 = false
    RETURNING company_name, location, meeting_time
  LOOP
    FOR admin_id IN SELECT user_id FROM public.user_roles WHERE role = 'admin'::app_role LOOP
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (
        admin_id, 'meeting_d1', '내일 미팅 일정',
        m.company_name || ' · ' || to_char(m.meeting_time, 'HH24:MI')
          || COALESCE(' · ' || NULLIF(m.location, ''), ''),
        '/meetings-schedule'
      );
    END LOOP;
  END LOOP;

  -- 당일(D-day)
  FOR m IN
    UPDATE public.meeting_schedules
    SET reminded_dday = true
    WHERE meeting_date = today_kst AND reminded_dday = false
    RETURNING company_name, location, meeting_time
  LOOP
    FOR admin_id IN SELECT user_id FROM public.user_roles WHERE role = 'admin'::app_role LOOP
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (
        admin_id, 'meeting_dday', '오늘 미팅 일정',
        m.company_name || ' · ' || to_char(m.meeting_time, 'HH24:MI')
          || COALESCE(' · ' || NULLIF(m.location, ''), ''),
        '/meetings-schedule'
      );
    END LOOP;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_meeting_reminders() TO authenticated;
