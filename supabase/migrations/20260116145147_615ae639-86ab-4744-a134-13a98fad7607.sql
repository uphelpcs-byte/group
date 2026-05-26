-- Add department and position columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN department TEXT CHECK (department IN ('CS운영팀', '영업팀')),
ADD COLUMN position TEXT CHECK (position IN ('이사', '팀장', '사원'));

-- Update the handle_new_user trigger to include department and position
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, department, position)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'department',
    new.raw_user_meta_data ->> 'position'
  );
  RETURN new;
END;
$$;