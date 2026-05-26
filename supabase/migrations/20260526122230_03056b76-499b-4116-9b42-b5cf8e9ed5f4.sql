
-- Add fields to clients table
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS channeltalk_access_key text,
  ADD COLUMN IF NOT EXISTS channeltalk_secret text,
  ADD COLUMN IF NOT EXISTS manager_email text,
  ADD COLUMN IF NOT EXISTS monthly_fee numeric,
  ADD COLUMN IF NOT EXISTS contract_start_date date,
  ADD COLUMN IF NOT EXISTS report_show_tags boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS report_show_first_response boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS report_show_response_rate boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS report_top_comment text;

-- Report send history table
CREATE TABLE IF NOT EXISTS public.report_send_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  report_type text NOT NULL CHECK (report_type IN ('weekly_cs','invoice')),
  period_start date,
  period_end date,
  subject text,
  sent_to text,
  sent_by uuid,
  sent_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.report_send_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view report history"
  ON public.report_send_history FOR SELECT
  TO authenticated
  USING (is_manager_plus());

CREATE POLICY "Managers can insert report history"
  ON public.report_send_history FOR INSERT
  TO authenticated
  WITH CHECK (is_manager_plus());

CREATE POLICY "Managers can delete report history"
  ON public.report_send_history FOR DELETE
  TO authenticated
  USING (is_manager_plus());
