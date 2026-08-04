-- rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'waiting',
  host_token text NOT NULL,
  host_name text NOT NULL DEFAULT 'Oyunçu 1',
  host_ships jsonb NOT NULL DEFAULT '[]'::jsonb,
  host_shots jsonb NOT NULL DEFAULT '{}'::jsonb,
  guest_token text,
  guest_name text,
  guest_ships jsonb NOT NULL DEFAULT '[]'::jsonb,
  guest_shots jsonb NOT NULL DEFAULT '{}'::jsonb,
  turn text NOT NULL DEFAULT 'host',
  winner text,
  host_ready boolean NOT NULL DEFAULT false,
  guest_ready boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_rooms" ON rooms;
CREATE POLICY "anon_select_rooms" ON rooms FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_rooms" ON rooms;
CREATE POLICY "anon_insert_rooms" ON rooms FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_rooms" ON rooms;
CREATE POLICY "anon_update_rooms" ON rooms FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_rooms" ON rooms;
CREATE POLICY "anon_delete_rooms" ON rooms FOR DELETE
  TO anon, authenticated USING (true);

-- shots table (event log for real-time shot feed)
CREATE TABLE IF NOT EXISTS shots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  attacker text NOT NULL,
  row int NOT NULL,
  col int NOT NULL,
  result text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_shots" ON shots;
CREATE POLICY "anon_select_shots" ON shots FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_shots" ON shots;
CREATE POLICY "anon_insert_shots" ON shots FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_shots" ON shots;
CREATE POLICY "anon_update_shots" ON shots FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_shots" ON shots;
CREATE POLICY "anon_delete_shots" ON shots FOR DELETE
  TO anon, authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_shots_room_id ON shots(room_id);
CREATE INDEX IF NOT EXISTS idx_shots_room_created ON shots(room_id, created_at);

-- Enable realtime publication for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE shots;