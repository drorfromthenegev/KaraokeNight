import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface Song {
  id: string;
  title: string;
  youtube_url: string;  // Changed to match Supabase schema
  submitted_by: string; // Changed to match Supabase schema
  order: number;
  party_id: string;    // Added to match Supabase schema
}

interface PartyState {
  partyId: string | null;
  passcode: string | null;
  currentSong: Song | null;
  queue: Song[];
  setPartyId: (id: string) => void;
  setPasscode: (passcode: string) => void;
  setCurrentSong: (song: Song | null) => void;
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
  currentSong: null,
  queue: [],
  setPartyId: (id) => set({ partyId: id }),
  setPasscode: (passcode) => set({ passcode }),
  setCurrentSong: (song) => set({ currentSong: song }),
  setQueue: (queue) => set({ queue }),
  addSong: (song) => set((state) => ({ queue: [...state.queue, song] })),
  removeSong: (songId) => set((state) => ({
    queue: state.queue.filter((song) => song.id !== songId)
  })),
  reorderQueue: (fromIndex, toIndex) => set((state) => {
    const newQueue = [...state.queue];
    const [movedSong] = newQueue.splice(fromIndex, 1);
    newQueue.splice(toIndex, 0, movedSong);
    return { queue: newQueue };
  }),
  getUserQueuePosition: (submittedBy) => {
    const state = get();
    return state.queue.findIndex(song => song.submitted_by === submittedBy);
  },
  playSong: async () => {
    const state = get();
    await supabase
      .channel(`party:${state.partyId}`)
      .send({
        type: 'broadcast',
        event: 'play',
      });
  },
  pauseSong: async () => {
    const state = get();
    await supabase
      .channel(`party:${state.partyId}`)
      .send({
        type: 'broadcast',
        event: 'pause',
      });
  },
  rewindSong: async () => {
    const state = get();
    await supabase
      .channel(`party:${state.partyId}`)
      .send({
        type: 'broadcast',
        event: 'rewind',
      });
  },
  skipSong: async () => {
    const state = get();
    await supabase
      .channel(`party:${state.partyId}`)
      .send({
        type: 'broadcast',
        event: 'skip',
      });
    const nextSong = state.queue[1];
    if (nextSong) {
      set({ currentSong: nextSong });
    }
  },
  updateQueueFromPostgres: async () => {
    const state = get();
    const { data: updatedQueue } = await supabase
      .from('songs')
      .select('*')
      .eq('party_id', state.partyId)
      .order('order', { ascending: true });

    if (updatedQueue) {
      set({ queue: updatedQueue });
    }
  }
}));
