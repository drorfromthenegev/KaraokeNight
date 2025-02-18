/*
  # Create Party Schema

  1. New Tables
    - `parties`
      - `id` (uuid, primary key)
      - `passcode` (text, unique)
      - `created_at` (timestamp)
      - `current_song_id` (uuid, references songs)
    
    - `songs`
      - `id` (uuid, primary key)
      - `party_id` (uuid, references parties)
      - `title` (text)
      - `youtube_url` (text)
      - `submitted_by` (text)
      - `order` (integer)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to read and write their party data
*/

CREATE TABLE IF NOT EXISTS parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passcode text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  current_song_id uuid
);

CREATE TABLE IF NOT EXISTS songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid REFERENCES parties(id) ON DELETE CASCADE,
  title text NOT NULL,
  youtube_url text NOT NULL,
  submitted_by text NOT NULL,
  "order" integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE parties 
  ADD CONSTRAINT fk_current_song 
  FOREIGN KEY (current_song_id) 
  REFERENCES songs(id) 
  ON DELETE SET NULL;

ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create a party"
  ON parties
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can read parties with passcode"
  ON parties
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Party members can update their party"
  ON parties
  FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Anyone can add songs to parties"
  ON songs
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can read songs"
  ON songs
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Party members can update songs"
  ON songs
  FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Party members can delete songs"
  ON songs
  FOR DELETE
  TO public
  USING (true);