-- Enable realtime for consultations table
ALTER PUBLICATION supabase_realtime ADD TABLE public.consultations;

-- Enable realtime for issues table
ALTER PUBLICATION supabase_realtime ADD TABLE public.issues;

-- Enable realtime for tasks table
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;