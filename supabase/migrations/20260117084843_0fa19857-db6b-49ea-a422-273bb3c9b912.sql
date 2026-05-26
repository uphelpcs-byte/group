-- Create meetings table
CREATE TABLE public.meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  meeting_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create meeting_agendas table
CREATE TABLE public.meeting_agendas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  item_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create meeting_notes table
CREATE TABLE public.meeting_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create meeting_action_items table (checklist)
CREATE TABLE public.meeting_action_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  assignee_id UUID REFERENCES public.profiles(id),
  is_completed BOOLEAN NOT NULL DEFAULT false,
  due_date DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create meeting_participants table
CREATE TABLE public.meeting_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(meeting_id, user_id)
);

-- Enable RLS
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_agendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for meetings
CREATE POLICY "All authenticated users can view meetings"
ON public.meetings FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create meetings"
ON public.meetings FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator or managers can update meetings"
ON public.meetings FOR UPDATE
USING (created_by = auth.uid() OR is_manager_plus())
WITH CHECK (created_by = auth.uid() OR is_manager_plus());

CREATE POLICY "Managers can delete meetings"
ON public.meetings FOR DELETE
USING (is_manager_plus());

-- RLS Policies for meeting_agendas
CREATE POLICY "All authenticated users can view agendas"
ON public.meeting_agendas FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Creator or managers can manage agendas"
ON public.meeting_agendas FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.meetings m 
    WHERE m.id = meeting_id AND (m.created_by = auth.uid() OR is_manager_plus())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.meetings m 
    WHERE m.id = meeting_id AND (m.created_by = auth.uid() OR is_manager_plus())
  )
);

-- RLS Policies for meeting_notes
CREATE POLICY "All authenticated users can view notes"
ON public.meeting_notes FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create notes"
ON public.meeting_notes FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator can update own notes"
ON public.meeting_notes FOR UPDATE
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creator or managers can delete notes"
ON public.meeting_notes FOR DELETE
USING (created_by = auth.uid() OR is_manager_plus());

-- RLS Policies for meeting_action_items
CREATE POLICY "All authenticated users can view action items"
ON public.meeting_action_items FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Creator or managers can manage action items"
ON public.meeting_action_items FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.meetings m 
    WHERE m.id = meeting_id AND (m.created_by = auth.uid() OR is_manager_plus())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.meetings m 
    WHERE m.id = meeting_id AND (m.created_by = auth.uid() OR is_manager_plus())
  )
);

CREATE POLICY "Assignee can update their action items"
ON public.meeting_action_items FOR UPDATE
USING (assignee_id = auth.uid())
WITH CHECK (assignee_id = auth.uid());

-- RLS Policies for meeting_participants
CREATE POLICY "All authenticated users can view participants"
ON public.meeting_participants FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Creator or managers can manage participants"
ON public.meeting_participants FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.meetings m 
    WHERE m.id = meeting_id AND (m.created_by = auth.uid() OR is_manager_plus())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.meetings m 
    WHERE m.id = meeting_id AND (m.created_by = auth.uid() OR is_manager_plus())
  )
);

-- Add updated_at triggers
CREATE TRIGGER update_meetings_updated_at
BEFORE UPDATE ON public.meetings
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_meeting_notes_updated_at
BEFORE UPDATE ON public.meeting_notes
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_meeting_action_items_updated_at
BEFORE UPDATE ON public.meeting_action_items
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();