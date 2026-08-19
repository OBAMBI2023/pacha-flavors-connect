
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories are viewable by everyone" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admins manage categories" ON public.categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  subtitle text,
  description text NOT NULL DEFAULT '',
  price numeric(10,2),
  image_path text,
  available boolean NOT NULL DEFAULT true,
  daily boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.menu_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;
GRANT ALL ON public.menu_items TO service_role;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Menu items are viewable by everyone" ON public.menu_items FOR SELECT USING (true);
CREATE POLICY "Admins manage menu items" ON public.menu_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER menu_items_updated_at BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Menu images are readable by everyone" ON storage.objects FOR SELECT USING (bucket_id = 'menu-images');
CREATE POLICY "Admins upload menu images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'menu-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update menu images" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'menu-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete menu images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'menu-images' AND public.has_role(auth.uid(), 'admin'));

INSERT INTO public.categories (slug, label, position) VALUES
  ('plats', 'Plats', 1),
  ('poulet', 'Poulet', 2),
  ('poisson', 'Poisson', 3),
  ('grillades', 'Grillades', 4),
  ('accompagnements', 'Accompagnements', 5),
  ('boissons', 'Boissons', 6),
  ('desserts', 'Desserts', 7);

INSERT INTO public.menu_items (slug, category_id, name, subtitle, description, price, available, daily, position)
VALUES
  ('tchep', (SELECT id FROM public.categories WHERE slug='plats'), 'Tchep', 'Poisson & poulet', 'Riz parfumé mijoté aux légumes frais, poisson et poulet tendres, épices locales.', NULL, true, true, 1),
  ('alloco-poulet-poisson', (SELECT id FROM public.categories WHERE slug='plats'), 'Alloco', 'Poulet et poisson', 'Bananes plantains dorées, servies avec poulet et poisson, sauce oignons épicée.', NULL, true, true, 2),
  ('placali-kope', (SELECT id FROM public.categories WHERE slug='plats'), 'Placali', 'Sauce kopè graine', 'Placali généreux accompagné d''une sauce kopè graine riche et parfumée.', NULL, true, true, 3),
  ('foutou-graine', (SELECT id FROM public.categories WHERE slug='plats'), 'Foutou', 'Sauce graine', 'Foutou traditionnel servi avec une sauce graine mijotée longuement.', NULL, true, true, 4),
  ('poulet-braise', (SELECT id FROM public.categories WHERE slug='poulet'), 'Poulet braisé', 'Accompagnement au choix', 'Poulet mariné aux épices, braisé lentement, servi avec l''accompagnement de votre choix.', NULL, true, false, 5),
  ('poisson-braise', (SELECT id FROM public.categories WHERE slug='poisson'), 'Poisson braisé', 'Sauce oignons', 'Poisson frais braisé, sauce oignons maison et attiéké ou alloco.', NULL, true, false, 6),
  ('brochettes', (SELECT id FROM public.categories WHERE slug='grillades'), 'Brochettes grillées', 'Au feu de bois', 'Brochettes marinées et grillées au charbon, servies avec sauce piquante.', NULL, true, false, 7),
  ('attieke', (SELECT id FROM public.categories WHERE slug='accompagnements'), 'Attiéké', NULL, 'Semoule de manioc fraîche, en accompagnement.', NULL, true, false, 8),
  ('alloco-simple', (SELECT id FROM public.categories WHERE slug='accompagnements'), 'Alloco nature', NULL, 'Bananes plantains frites, croustillantes et fondantes.', NULL, true, false, 9),
  ('riz-blanc', (SELECT id FROM public.categories WHERE slug='accompagnements'), 'Riz blanc', NULL, 'Riz blanc parfumé, en accompagnement.', NULL, true, false, 10),
  ('eau', (SELECT id FROM public.categories WHERE slug='boissons'), 'Eau minérale', NULL, 'Bouteille d''eau fraîche.', NULL, true, false, 11),
  ('jus-bissap', (SELECT id FROM public.categories WHERE slug='boissons'), 'Jus local', 'Bissap / gingembre', 'Jus naturel préparé maison, servi bien frais.', NULL, true, false, 12),
  ('soda', (SELECT id FROM public.categories WHERE slug='boissons'), 'Sodas', NULL, 'Boissons gazeuses au choix.', NULL, true, false, 13),
  ('dessert-fruits', (SELECT id FROM public.categories WHERE slug='desserts'), 'Assiette de fruits frais', NULL, 'Sélection de fruits de saison découpés.', NULL, true, false, 14);
