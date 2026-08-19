
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_staff()
RETURNS TABLE (user_id uuid, email text, role public.app_role, created_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY
    SELECT ur.user_id, u.email::text, ur.role, ur.created_at
    FROM public.user_roles ur
    JOIN auth.users u ON u.id = ur.user_id
    ORDER BY u.email, ur.role;
END; $$;

REVOKE ALL ON FUNCTION public.admin_list_staff() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_staff() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_assign_role(_email text, _role public.app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT id INTO target FROM auth.users WHERE lower(email) = lower(trim(_email)) LIMIT 1;
  IF target IS NULL THEN
    RAISE EXCEPTION 'Aucun compte inscrit avec cet e-mail';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (target, _role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN true;
END; $$;

REVOKE ALL ON FUNCTION public.admin_assign_role(text, public.app_role) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_role(text, public.app_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_revoke_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _user_id = auth.uid() AND _role = 'admin'::public.app_role THEN
    RAISE EXCEPTION 'Vous ne pouvez pas retirer votre propre rÃ´le admin';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;
  RETURN true;
END; $$;

REVOKE ALL ON FUNCTION public.admin_revoke_role(uuid, public.app_role) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_revoke_role(uuid, public.app_role) TO authenticated;

DROP POLICY IF EXISTS "Managers manage categories" ON public.categories;
CREATE POLICY "Managers manage categories" ON public.categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'gerant'))
  WITH CHECK (public.has_role(auth.uid(), 'gerant'));

DROP POLICY IF EXISTS "Managers manage menu items" ON public.menu_items;
CREATE POLICY "Managers manage menu items" ON public.menu_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'gerant'))
  WITH CHECK (public.has_role(auth.uid(), 'gerant'));

DROP POLICY IF EXISTS "Waiters update menu items" ON public.menu_items;
CREATE POLICY "Waiters update menu items" ON public.menu_items
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'serveur'))
  WITH CHECK (public.has_role(auth.uid(), 'serveur'));
