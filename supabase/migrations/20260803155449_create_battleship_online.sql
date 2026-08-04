/*
# Create Battleship online multiplayer tables

## Purpose
Enables real-time online battleship games between two players using
room codes. No sign-in required — players are identified by a random
session token stored in localStorage.

## New Tables

### rooms
- `id` (uuid, PK) — room identifier
- `code` (text, unique, 6 chars) — human-shareable room code (e.g. "A3K7Q2")
- `status` (text) — 'waiting' | 'placing' | 'playing' | 'finished'
- `host_token` (text) — session token of room creator
- `host_name` (text) — display name of host
- `host_ships` (jsonb) — host's fleet (ship placements)
- `host_shots` (jsonb) — shots the host has received (key->result)
- `guest_token` (text) — session token of joining player
- `guest_name` (text) — display name of guest
- `guest_ships` (jsonb) — guest's fleet
- `guest_shots` (jsonb) — shots the guest has received
- `turn` (text) — 'host' | 'guest' — whose turn it is
- `winner` (text, nullable) — 'host' | 'guest' | null
- `host_ready` (boolean, default false) — host finished placement
- `guest_ready` (boolean, default false) — guest finished placement
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### shots
- `id` (uuid, PK)
- `room_id` (uuid, FK -> rooms.id ON DELETE CASCADE)
- `attacker` (text) — 'host' | 'guest'
- `row` (int) — 0-indexed row
- `col` (int) — 0-indexed col
- `result` (text) — 'hit' | 'miss' | 'sunk'
- `created_at` (timestamptz, default now())

## Security (RLS)
- Enable RLS on all tables.
- Allow anon + authenticated full CRUD — this is a no-auth multiplayer app
  where any client must be able to create rooms, join them, and fire shots.
  Ownership/turn enforcement is done in application logic; the DB is
  intentionally open for the real-time multiplayer use case.
- Add indexes on room lookups and shot history.
*/

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
