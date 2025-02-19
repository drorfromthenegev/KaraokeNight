import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface Song {
  id: string;
  title: string;
  youtube_url: string;  
  submitted_by: string; 
  party_id: string;    
  created_at?: string; // now used for ordering; can be undefined on client insert
}

interface PartyState {
  partyId: string | null;
  passcode: string | null;
  queue: Song[];
  setPartyId: (id: string) => void;
  setPasscode: (passcode: string) => void;
  setQueue: (queue: Song[]) => void;
  addSong: (song: Song) => void;
  removeSong: (songId: string) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  getUserQueuePosition: (submittedBy: string) => number;
  playSong: () => void;
  pauseSong: () => void;
  rewindSong: () => void;
  skipSong: () => void;
  updateQueueFromPostgres: () => void;
}

export const usePartyStore = create<PartyState>((set, get) => ({
  partyId: null,
  passcode: null,
  queue: [],
  setPartyId: (id) => set({ partyId: id }),
  setPasscode: (passcode) => set({ passcode }),
  setQueue: (queue) => set({ queue }),
  addSong: (song) => set((state) => ({ queue: [...state.queue, song] })),
  removeSong: (songId) => set((state) => ({ 
    queue: state.queue.filter(song => song.id !== songId)
  })),
  reorderQueue: async (fromIndex, toIndex) => {
    const state = get();
    // Get current queue sorted by created_at (assume valid ISO strings)
    const sortedQueue = [...state.queue].sort((a, b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime());
    const songA = sortedQueue[fromIndex];
    const songB = sortedQueue[toIndex];
    if (!songA || !songB) return;
    const temp = songA.created_at;
    // Swap the created_at timestamps in the DB
    await supabase.from('songs').update({ created_at: songB.created_at }).eq('id', songA.id);
    await supabase.from('songs').update({ created_at: temp }).eq('id', songB.id);
    // Refresh local queue
    await state.updateQueueFromPostgres();
  },
  getUserQueuePosition: (submittedBy) => {
    const state = get();
    return state.queue.findIndex(song => song.submitted_by === submittedBy);
  },
  playSong: async () => {
    const state = get();
    await supabase
      .channel(`party:${state.partyId}`)
      .send({ type: 'broadcast', event: 'play' });
  },
  pauseSong: async () => {
    const state = get();
    await supabase
      .channel(`party:${state.partyId}`)
      .send({ type: 'broadcast', event: 'pause' });
  },
  rewindSong: async () => {
    const state = get();
    await supabase
      .channel(`party:${state.partyId}`)
      .send({ type: 'broadcast', event: 'rewind' });
  },
  skipSong: async () => {
    const state = get();
    await supabase
      .channel(`party:${state.partyId}`)
      .send({ type: 'broadcast', event: 'skip' });
  },
  updateQueueFromPostgres: async () => {
    const state = get();
    const { data: updatedQueue } = await supabase
      .from('songs')
      .select('*')
      .eq('party_id', state.partyId)
      .order('created_at', { ascending: true });
    if (updatedQueue) {
      set({ queue: updatedQueue });
    }
  }
}));
