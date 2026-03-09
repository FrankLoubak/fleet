-- Create maintenance_requests table
CREATE TABLE IF NOT EXISTS maintenance_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE NOT NULL,
  date DATE DEFAULT CURRENT_DATE NOT NULL,
  odometer INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Mecanica', 'Eletrica', 'Acessórios', 'Borracharia', 'Ar de serviço')),
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pendente', 'aprovada', 'rejeitada', 'concluida')) DEFAULT 'pendente',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Maintenance requests are viewable by everyone" ON maintenance_requests FOR SELECT USING (true);
CREATE POLICY "Users can manage their own maintenance requests" ON maintenance_requests FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all maintenance requests" ON maintenance_requests FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Admin')
);
