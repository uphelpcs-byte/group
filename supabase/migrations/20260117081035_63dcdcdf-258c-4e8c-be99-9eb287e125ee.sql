-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Users with client access can view pilot projects" ON public.pilot_projects;

-- Create new policy allowing all authenticated users to view pilot projects
CREATE POLICY "All authenticated users can view pilot projects"
ON public.pilot_projects
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Also update pilot_checkpoints to allow all authenticated users to view
DROP POLICY IF EXISTS "Users with client access can view checkpoints" ON public.pilot_checkpoints;

CREATE POLICY "All authenticated users can view checkpoints"
ON public.pilot_checkpoints
FOR SELECT
USING (auth.uid() IS NOT NULL);