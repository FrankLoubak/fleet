-- Update journeys table with validation fields
ALTER TABLE journeys 
ADD COLUMN IF NOT EXISTS validation_status TEXT DEFAULT 'validada' CHECK (validation_status IN ('pendente', 'validada')),
ADD COLUMN IF NOT EXISTS validated_by UUID REFERENCES profiles(id);

-- Update banco_de_horas table to use TEXT for time format instead of DECIMAL
-- First, drop the table if it was just created to recreate with correct type
DROP TABLE IF EXISTS banco_de_horas;

CREATE TABLE banco_de_horas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  journey_id UUID REFERENCES journeys(id) ON DELETE CASCADE NOT NULL,
  horas_adquiridas TEXT NOT NULL, -- Format "HH:MM"
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE banco_de_horas ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Banco de horas are viewable by everyone" ON banco_de_horas FOR SELECT USING (true);
CREATE POLICY "Users can manage their own banco de horas" ON banco_de_horas FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all banco de horas" ON banco_de_horas FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Admin')
);
