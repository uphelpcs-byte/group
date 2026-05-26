
-- Add meal break columns to attendance_records
ALTER TABLE public.attendance_records
  ADD COLUMN meal_out timestamp with time zone DEFAULT NULL,
  ADD COLUMN meal_in timestamp with time zone DEFAULT NULL,
  ADD COLUMN meal_duration numeric DEFAULT NULL;
