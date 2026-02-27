
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create has_role helper (security definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create photo category enum
CREATE TYPE public.photo_category AS ENUM ('full_body', 'face', 'hair', 'hands_wrist');

-- Create profile_photos table
CREATE TABLE public.profile_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category photo_category NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, category)
);
ALTER TABLE public.profile_photos ENABLE ROW LEVEL SECURITY;

-- Create tryon_requests table
CREATE TABLE public.tryon_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  page_url TEXT NOT NULL,
  image_url TEXT NOT NULL,
  title TEXT,
  price TEXT,
  retailer_domain TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  result_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tryon_requests ENABLE ROW LEVEL SECURITY;

-- Create click_events table
CREATE TABLE public.click_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_url TEXT NOT NULL,
  retailer_domain TEXT,
  click_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.click_events ENABLE ROW LEVEL SECURITY;

-- Create affiliate_merchants table
CREATE TABLE public.affiliate_merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE,
  network TEXT,
  affiliate_link_template TEXT,
  commission_rate NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.affiliate_merchants ENABLE ROW LEVEL SECURITY;

-- Create wallet status enum
CREATE TYPE public.wallet_status AS ENUM ('pending', 'available', 'paid');

-- Create wallet_ledger table
CREATE TABLE public.wallet_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status wallet_status NOT NULL DEFAULT 'pending',
  description TEXT,
  click_event_id UUID REFERENCES public.click_events(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;

-- Auto-create profile on signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tryon_requests_updated_at BEFORE UPDATE ON public.tryon_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_affiliate_merchants_updated_at BEFORE UPDATE ON public.affiliate_merchants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_wallet_ledger_updated_at BEFORE UPDATE ON public.wallet_ledger FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for user_roles
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can delete own profile" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- RLS Policies for profile_photos
CREATE POLICY "Users can view own photos" ON public.profile_photos FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own photos" ON public.profile_photos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own photos" ON public.profile_photos FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own photos" ON public.profile_photos FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- RLS Policies for tryon_requests
CREATE POLICY "Users can view own tryons" ON public.tryon_requests FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own tryons" ON public.tryon_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tryons" ON public.tryon_requests FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tryons" ON public.tryon_requests FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- RLS Policies for click_events
CREATE POLICY "Users can view own clicks" ON public.click_events FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert clicks" ON public.click_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- RLS Policies for affiliate_merchants
CREATE POLICY "Anyone can view merchants" ON public.affiliate_merchants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert merchants" ON public.affiliate_merchants FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update merchants" ON public.affiliate_merchants FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete merchants" ON public.affiliate_merchants FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for wallet_ledger
CREATE POLICY "Users can view own wallet" ON public.wallet_ledger FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert wallet entries" ON public.wallet_ledger FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update wallet entries" ON public.wallet_ledger FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Storage bucket for profile photos (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-photos', 'profile-photos', false);

-- Storage policies
CREATE POLICY "Users can upload own photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
