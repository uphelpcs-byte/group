-- 휴무 신청 + 알림 시스템
-- (이 파일만 실행하면 됩니다. 나머지 기존 마이그레이션은 이미 적용되어 있습니다.)

-- ============================================================
-- 1) 휴무 신청 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leave_date date NOT NULL,                          -- 휴무 날짜
  is_all_day boolean NOT NULL DEFAULT true,          -- 종일 여부
  start_time time,                                   -- 시간지정 시 시작
  end_time time,                                     -- 시간지정 시 종료
  reason text,                                       -- 신청 사유
  status text NOT NULL DEFAULT 'pending',            -- pending | approved | rejected
  reject_reason text,                                -- 반려 사유
  reviewed_by uuid,                                  -- 처리한 대표
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- 본인 신청 + 대표는 전체 조회
DROP POLICY IF EXISTS "view own leave or admin" ON public.leave_requests;
CREATE POLICY "view own leave or admin"
  ON public.leave_requests FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- 본인만 신청 생성
DROP POLICY IF EXISTS "create own leave" ON public.leave_requests;
CREATE POLICY "create own leave"
  ON public.leave_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 본인은 대기중일 때만 수정(날짜/시간 변경)
DROP POLICY IF EXISTS "update own pending leave" ON public.leave_requests;
CREATE POLICY "update own pending leave"
  ON public.leave_requests FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- 대표는 승인/반려(상태 변경) 가능
DROP POLICY IF EXISTS "admin update leave" ON public.leave_requests;
CREATE POLICY "admin update leave"
  ON public.leave_requests FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 본인은 대기중일 때 철회(삭제) 가능
DROP POLICY IF EXISTS "delete own pending leave" ON public.leave_requests;
CREATE POLICY "delete own pending leave"
  ON public.leave_requests FOR DELETE
  USING (auth.uid() = user_id AND status = 'pending');

-- 대표는 삭제 가능
DROP POLICY IF EXISTS "admin delete leave" ON public.leave_requests;
CREATE POLICY "admin delete leave"
  ON public.leave_requests FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS update_leave_requests_updated_at ON public.leave_requests;
CREATE TRIGGER update_leave_requests_updated_at
  BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id ON public.leave_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests (status);

-- ============================================================
-- 2) 알림 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- 수신자
  type text NOT NULL,                                -- leave_submitted | leave_approved | leave_rejected
  title text NOT NULL,
  body text,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 본인 알림만 조회
DROP POLICY IF EXISTS "view own notifications" ON public.notifications;
CREATE POLICY "view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- 본인 알림만 읽음 처리
DROP POLICY IF EXISTS "update own notifications" ON public.notifications;
CREATE POLICY "update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 본인 알림 삭제
DROP POLICY IF EXISTS "delete own notifications" ON public.notifications;
CREATE POLICY "delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, is_read);

-- ============================================================
-- 3) 알림 생성 트리거 (SECURITY DEFINER로 RLS 우회)
-- ============================================================

-- 신규 휴무 신청 → 모든 대표에게 알림
CREATE OR REPLACE FUNCTION public.notify_leave_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_id uuid;
  requester_name text;
  time_label text;
BEGIN
  SELECT COALESCE(full_name, email) INTO requester_name
    FROM public.profiles WHERE id = NEW.user_id;

  IF NEW.is_all_day THEN
    time_label := '종일';
  ELSE
    time_label := to_char(NEW.start_time, 'HH24:MI') || '~' || to_char(NEW.end_time, 'HH24:MI');
  END IF;

  FOR admin_id IN
    SELECT user_id FROM public.user_roles WHERE role = 'admin'::app_role
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      admin_id,
      'leave_submitted',
      '새 휴무 신청',
      COALESCE(requester_name, '상담원') || '님이 ' ||
        to_char(NEW.leave_date, 'MM/DD') || ' (' || time_label || ') 휴무를 신청했습니다',
      '/leave'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_leave_submitted ON public.leave_requests;
CREATE TRIGGER trg_notify_leave_submitted
  AFTER INSERT ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_leave_submitted();

-- 승인/반려 → 신청자에게 알림
CREATE OR REPLACE FUNCTION public.notify_leave_reviewed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected') THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      NEW.user_id,
      'leave_' || NEW.status,
      CASE NEW.status WHEN 'approved' THEN '휴무 신청 승인' ELSE '휴무 신청 반려' END,
      to_char(NEW.leave_date, 'MM/DD') || ' 휴무 신청이 ' ||
        CASE NEW.status WHEN 'approved' THEN '승인되었습니다' ELSE '반려되었습니다' END ||
        COALESCE(' (사유: ' || NULLIF(NEW.reject_reason, '') || ')', ''),
      '/leave'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_leave_reviewed ON public.leave_requests;
CREATE TRIGGER trg_notify_leave_reviewed
  AFTER UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_leave_reviewed();
