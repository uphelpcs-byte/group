-- Create pilot_projects table
CREATE TABLE public.pilot_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create pilot_checkpoints table for tracking progress
CREATE TABLE public.pilot_checkpoints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pilot_id UUID NOT NULL REFERENCES public.pilot_projects(id) ON DELETE CASCADE,
  phase TEXT NOT NULL,
  checkpoint_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pilot_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_checkpoints ENABLE ROW LEVEL SECURITY;

-- RLS policies for pilot_projects
CREATE POLICY "Users with client access can view pilot projects"
ON public.pilot_projects FOR SELECT
USING (has_client_access(client_id));

CREATE POLICY "Managers can create pilot projects"
ON public.pilot_projects FOR INSERT
WITH CHECK (is_manager_plus());

CREATE POLICY "Managers can update pilot projects"
ON public.pilot_projects FOR UPDATE
USING (is_manager_plus())
WITH CHECK (is_manager_plus());

CREATE POLICY "Managers can delete pilot projects"
ON public.pilot_projects FOR DELETE
USING (is_manager_plus());

-- RLS policies for pilot_checkpoints
CREATE POLICY "Users with client access can view checkpoints"
ON public.pilot_checkpoints FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.pilot_projects pp 
  WHERE pp.id = pilot_id AND has_client_access(pp.client_id)
));

CREATE POLICY "Managers can manage checkpoints"
ON public.pilot_checkpoints FOR ALL
USING (is_manager_plus())
WITH CHECK (is_manager_plus());

-- Triggers for updated_at
CREATE TRIGGER update_pilot_projects_updated_at
BEFORE UPDATE ON public.pilot_projects
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_pilot_checkpoints_updated_at
BEFORE UPDATE ON public.pilot_checkpoints
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();