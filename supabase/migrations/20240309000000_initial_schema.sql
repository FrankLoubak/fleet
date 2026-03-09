-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Admin', 'Motorista')),
  avatar TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plate TEXT NOT NULL UNIQUE,
  model TEXT NOT NULL,
  prefix TEXT NOT NULL,
  last_odometer INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create journeys table
CREATE TABLE IF NOT EXISTS journeys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  start_odometer INTEGER NOT NULL,
  end_odometer INTEGER,
  distance_traveled INTEGER,
  status TEXT NOT NULL CHECK (status IN ('aberta', 'encerrada')) DEFAULT 'aberta',
  observations TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create refuelings table
CREATE TABLE IF NOT EXISTS refuelings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE DEFAULT CURRENT_DATE NOT NULL,
  odometer INTEGER NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  fuel_type TEXT NOT NULL CHECK (fuel_type IN ('Gasolina', 'Álcool', 'Diesel')),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE NOT NULL,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create maintenances table
CREATE TABLE IF NOT EXISTS maintenances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE DEFAULT CURRENT_DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Mecanica', 'Eletrica', 'Acessórios', 'Borracharia', 'Ar de serviço')),
  provider TEXT NOT NULL,
  mileage INTEGER NOT NULL,
  description TEXT NOT NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE refuelings ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenances ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Profiles: Users can read all profiles, but only update their own
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Vehicles: Everyone can read, only admins can insert/update/delete
CREATE POLICY "Vehicles are viewable by everyone" ON vehicles FOR SELECT USING (true);
CREATE POLICY "Admins can manage vehicles" ON vehicles FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Admin')
);

-- Journeys: Everyone can read, users can manage their own journeys
CREATE POLICY "Journeys are viewable by everyone" ON journeys FOR SELECT USING (true);
CREATE POLICY "Users can manage their own journeys" ON journeys FOR ALL USING (auth.uid() = user_id);

-- Refuelings: Everyone can read, users can insert refuelings
CREATE POLICY "Refuelings are viewable by everyone" ON refuelings FOR SELECT USING (true);
CREATE POLICY "Users can insert refuelings" ON refuelings FOR INSERT WITH CHECK (true);

-- Maintenances: Everyone can read, users can insert maintenances
CREATE POLICY "Maintenances are viewable by everyone" ON maintenances FOR SELECT USING (true);
CREATE POLICY "Users can insert maintenances" ON maintenances FOR INSERT WITH CHECK (true);

-- Create a trigger to create a profile after a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (new.id, new.raw_user_meta_data->>'name', new.email, COALESCE(new.raw_user_meta_data->>'role', 'Motorista'));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
