-- Username-based login: secure server-side username → email lookup
CREATE OR REPLACE FUNCTION public.get_email_by_username(uname text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN (
    SELECT u.email FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE lower(p.username) = lower(uname)
    LIMIT 1
  );
END;
$$;

-- Set Darklight username
UPDATE public.profiles SET username = 'Darklight'
WHERE id = (SELECT id FROM auth.users WHERE email = 'deric.o.ortiz@gmail.com');
