-- =============================================
-- CS Operation Hub - Database Schema
-- =============================================

-- 1. Create ENUMs
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'agent', 'contractor');
CREATE TYPE public.work_status AS ENUM ('active', 'freelancer', 'on_leave', 'resigned');
CREATE TYPE public.contract_status AS ENUM ('pilot', 'active', 'terminated');
CREATE TYPE public.channel_type AS ENUM ('channel_talk', 'kakao', 'phone', 'email', 'other');
CREATE TYPE public.consultation_status AS ENUM ('pending', 'in_progress', 'completed', 'escalated');
CREATE TYPE public.issue_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE public.issue_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'review', 'completed');

-- =============================================
-- 2. Base Tables
-- =============================================

-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  work_status work_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User Roles table (separate for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'agent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  business_number TEXT,
  industry TEXT,
  address TEXT,
  status contract_status NOT NULL DEFAULT 'pilot',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 3. Client Related Tables
-- =============================================

-- Client Contacts
CREATE TABLE public.client_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position TEXT,
  email TEXT,
  phone TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Client Contracts
CREATE TABLE public.client_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  monthly_fee DECIMAL(12, 2),
  fee_structure JSONB,
  contract_file_path TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Client Channels
CREATE TABLE public.client_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  channel_type channel_type NOT NULL,
  channel_identifier TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Client Assignments (who is assigned to which client)
CREATE TABLE public.client_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, user_id)
);

-- =============================================
-- 4. CS Operations Tables
-- =============================================

-- Consultations (상담 이력)
CREATE TABLE public.consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES public.client_channels(id) ON DELETE SET NULL,
  agent_id UUID NOT NULL REFERENCES public.profiles(id),
  customer_name TEXT,
  customer_contact TEXT,
  consultation_type TEXT,
  content TEXT NOT NULL,
  status consultation_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Issues (이슈/클레임)
CREATE TABLE public.issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  consultation_id UUID REFERENCES public.consultations(id) ON DELETE SET NULL,
  reported_by UUID NOT NULL REFERENCES public.profiles(id),
  assigned_to UUID REFERENCES public.profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  priority issue_priority NOT NULL DEFAULT 'medium',
  status issue_status NOT NULL DEFAULT 'open',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 5. Task Management Tables
-- =============================================

-- Tasks
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id UUID REFERENCES public.profiles(id),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  status task_status NOT NULL DEFAULT 'pending',
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Task Comments
CREATE TABLE public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 6. Helper Functions
-- =============================================

-- Get user's role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Check if user has role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Check if user is admin or manager
CREATE OR REPLACE FUNCTION public.is_manager_plus()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
  );
$$;

-- Check if user has access to specific client
CREATE OR REPLACE FUNCTION public.has_client_access(_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.is_manager_plus() OR 
    EXISTS (
      SELECT 1 FROM public.client_assignments
      WHERE client_id = _client_id AND user_id = auth.uid()
    );
$$;

-- =============================================
-- 7. Enable RLS on all tables
-- =============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 8. RLS Policies - Profiles
-- =============================================

CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Managers can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.is_manager_plus());

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "Managers can update profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.is_manager_plus())
WITH CHECK (public.is_manager_plus());

CREATE POLICY "System can insert profiles"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- =============================================
-- 9. RLS Policies - User Roles
-- =============================================

CREATE POLICY "Users can view own role"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Managers can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.is_manager_plus());

CREATE POLICY "Only admins can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 10. RLS Policies - Clients
-- =============================================

CREATE POLICY "Managers can manage clients"
ON public.clients FOR ALL
TO authenticated
USING (public.is_manager_plus())
WITH CHECK (public.is_manager_plus());

CREATE POLICY "Assigned users can view clients"
ON public.clients FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.client_assignments
    WHERE client_id = id AND user_id = auth.uid()
  )
);

-- =============================================
-- 11. RLS Policies - Client Related Tables
-- =============================================

-- Client Contacts
CREATE POLICY "Access client contacts"
ON public.client_contacts FOR SELECT
TO authenticated
USING (public.has_client_access(client_id));

CREATE POLICY "Managers can manage client contacts"
ON public.client_contacts FOR ALL
TO authenticated
USING (public.is_manager_plus())
WITH CHECK (public.is_manager_plus());

-- Client Contracts (sensitive - admin/manager only)
CREATE POLICY "Managers can view contracts"
ON public.client_contracts FOR SELECT
TO authenticated
USING (public.is_manager_plus());

CREATE POLICY "Admins can manage contracts"
ON public.client_contracts FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Client Channels
CREATE POLICY "Access client channels"
ON public.client_channels FOR SELECT
TO authenticated
USING (public.has_client_access(client_id));

CREATE POLICY "Managers can manage client channels"
ON public.client_channels FOR ALL
TO authenticated
USING (public.is_manager_plus())
WITH CHECK (public.is_manager_plus());

-- Client Assignments
CREATE POLICY "View own assignments"
ON public.client_assignments FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Managers can view all assignments"
ON public.client_assignments FOR SELECT
TO authenticated
USING (public.is_manager_plus());

CREATE POLICY "Managers can manage assignments"
ON public.client_assignments FOR ALL
TO authenticated
USING (public.is_manager_plus())
WITH CHECK (public.is_manager_plus());

-- =============================================
-- 12. RLS Policies - CS Operations
-- =============================================

-- Consultations
CREATE POLICY "View consultations for accessible clients"
ON public.consultations FOR SELECT
TO authenticated
USING (public.has_client_access(client_id));

CREATE POLICY "Create consultations for accessible clients"
ON public.consultations FOR INSERT
TO authenticated
WITH CHECK (public.has_client_access(client_id) AND agent_id = auth.uid());

CREATE POLICY "Update own consultations"
ON public.consultations FOR UPDATE
TO authenticated
USING (agent_id = auth.uid() OR public.is_manager_plus())
WITH CHECK (agent_id = auth.uid() OR public.is_manager_plus());

CREATE POLICY "Managers can delete consultations"
ON public.consultations FOR DELETE
TO authenticated
USING (public.is_manager_plus());

-- Issues
CREATE POLICY "View issues for accessible clients"
ON public.issues FOR SELECT
TO authenticated
USING (public.has_client_access(client_id));

CREATE POLICY "Create issues for accessible clients"
ON public.issues FOR INSERT
TO authenticated
WITH CHECK (public.has_client_access(client_id) AND reported_by = auth.uid());

CREATE POLICY "Update assigned or own issues"
ON public.issues FOR UPDATE
TO authenticated
USING (assigned_to = auth.uid() OR reported_by = auth.uid() OR public.is_manager_plus())
WITH CHECK (assigned_to = auth.uid() OR reported_by = auth.uid() OR public.is_manager_plus());

CREATE POLICY "Managers can delete issues"
ON public.issues FOR DELETE
TO authenticated
USING (public.is_manager_plus());

-- =============================================
-- 13. RLS Policies - Tasks
-- =============================================

CREATE POLICY "View tasks for accessible clients"
ON public.tasks FOR SELECT
TO authenticated
USING (
  client_id IS NULL AND (created_by = auth.uid() OR assignee_id = auth.uid() OR public.is_manager_plus())
  OR public.has_client_access(client_id)
);

CREATE POLICY "Create tasks"
ON public.tasks FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid() AND (
    client_id IS NULL OR public.has_client_access(client_id)
  )
);

CREATE POLICY "Update own or assigned tasks"
ON public.tasks FOR UPDATE
TO authenticated
USING (created_by = auth.uid() OR assignee_id = auth.uid() OR public.is_manager_plus())
WITH CHECK (created_by = auth.uid() OR assignee_id = auth.uid() OR public.is_manager_plus());

CREATE POLICY "Managers can delete tasks"
ON public.tasks FOR DELETE
TO authenticated
USING (public.is_manager_plus());

-- Task Comments
CREATE POLICY "View task comments"
ON public.task_comments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id AND (
      t.client_id IS NULL AND (t.created_by = auth.uid() OR t.assignee_id = auth.uid() OR public.is_manager_plus())
      OR public.has_client_access(t.client_id)
    )
  )
);

CREATE POLICY "Create task comments"
ON public.task_comments FOR INSERT
TO authenticated
WITH CHECK (author_id = auth.uid());

CREATE POLICY "Update own comments"
ON public.task_comments FOR UPDATE
TO authenticated
USING (author_id = auth.uid())
WITH CHECK (author_id = auth.uid());

CREATE POLICY "Delete own comments or managers"
ON public.task_comments FOR DELETE
TO authenticated
USING (author_id = auth.uid() OR public.is_manager_plus());

-- =============================================
-- 14. Updated At Trigger
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_client_contracts_updated_at
  BEFORE UPDATE ON public.client_contracts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_consultations_updated_at
  BEFORE UPDATE ON public.consultations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_issues_updated_at
  BEFORE UPDATE ON public.issues
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- 15. New User Trigger (Create Profile)
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  
  -- Default role is 'agent'
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'agent');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- 16. Indexes for Performance
-- =============================================

CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_client_assignments_user_id ON public.client_assignments(user_id);
CREATE INDEX idx_client_assignments_client_id ON public.client_assignments(client_id);
CREATE INDEX idx_consultations_client_id ON public.consultations(client_id);
CREATE INDEX idx_consultations_agent_id ON public.consultations(agent_id);
CREATE INDEX idx_consultations_status ON public.consultations(status);
CREATE INDEX idx_issues_client_id ON public.issues(client_id);
CREATE INDEX idx_issues_status ON public.issues(status);
CREATE INDEX idx_tasks_client_id ON public.tasks(client_id);
CREATE INDEX idx_tasks_assignee_id ON public.tasks(assignee_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);