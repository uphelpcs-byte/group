-- Create work_tools table for storing tool credentials
CREATE TABLE public.work_tools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT,
  login_id TEXT,
  login_password TEXT,
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.work_tools ENABLE ROW LEVEL SECURITY;

-- RLS policies - only managers can manage tools, all authenticated users can view
CREATE POLICY "All authenticated users can view tools"
ON public.work_tools
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can create tools"
ON public.work_tools
FOR INSERT
WITH CHECK (is_manager_plus());

CREATE POLICY "Managers can update tools"
ON public.work_tools
FOR UPDATE
USING (is_manager_plus())
WITH CHECK (is_manager_plus());

CREATE POLICY "Managers can delete tools"
ON public.work_tools
FOR DELETE
USING (is_manager_plus());

-- Add trigger for updated_at
CREATE TRIGGER update_work_tools_updated_at
BEFORE UPDATE ON public.work_tools
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();