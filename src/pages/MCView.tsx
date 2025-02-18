import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Trash2, GripVertical, Play, Pause, Rewind, SkipForward } from 'lucide-react';
import { usePartyStore } from '../store/partyStore';
import { supabase } from '../lib/supabase';

export function MCView() {
  const { partyId } = useParams();
  const { queue, passcode, removeSong, reorderQueue, setCurrentSong } = usePartyStore();

  useEffect(() => {
    const subscription = supabase
      .channel(`party:${partyId}`)
      .on('*', (payload) => {
        console.log('Real-time update:', payload);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [partyId]);

  const playSong = async (songId) => {
    await supabase
      .channel(`party:${partyId}`)
      .send({
        type: 'broadcast',
        event: 'play',
        payload: { songId },
      });
    setCurrentSong(queue.find((song) => song.id === songId));
  };

  const pauseSong = async () => {
    await supabase
      .channel(`party:${partyId}`)
      .send({
        type: 'broadcast',
        event: 'pause',
      });
  };

  const rewindSong = async () => {
    await supabase
      .channel(`party:${partyId}`)
      .send({
        type: 'broadcast',
        event: 'rewind',
      });
  };

  const skipSong = async () => {
    await supabase
      .channel(`party:${partyId}`)
      .send({
        type: 'broadcast',
        event: 'skip',
      });
    const nextSong = queue[1];
    if (nextSong) {
      setCurrentSong(nextSong);
    }
  };

  const handleQueueUpdate = async () => {
    const { data: updatedQueue } = await supabase
      .from('songs')
      .select('*')
      .eq('party_id', partyId)
      .order('order', { ascending: true });

    if (updatedQueue) {
      setQueue(updatedQueue);
    }
  };

  useEffect(() => {
    const subscription = supabase
      .channel(`party:${partyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'songs'
        },
        handleQueueUpdate
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [partyId]);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">Party Control</h1>
            <div className="bg-purple-100 px-4 py-2 rounded-lg">
              <span className="text-purple-800 font-medium">Passcode: {passcode}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Queue</h2>
            <div className="space-y-4">
              {queue.map((song, index) => (
                <div
                  key={song.id}
                  className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg"
                >
                  <GripVertical className="text-gray-400 cursor-move" />
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{song.title}</h3>
                    <p className="text-sm text-gray-500">Added by {song.submittedBy}</p>
                  </div>
                  <button
                    onClick={() => removeSong(song.id)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-center space-x-4">
          <button
            onClick={() => playSong(queue[0]?.id)}
            className="flex items-center space-x-2 bg-purple-600 text-white px-8 py-4 rounded-lg font-medium hover:bg-purple-700 transition-colors"
          >
            <Play className="w-5 h-5" />
            <span>Play</span>
          </button>
          <button
            onClick={pauseSong}
            className="flex items-center space-x-2 bg-purple-600 text-white px-8 py-4 rounded-lg font-medium hover:bg-purple-700 transition-colors"
          >
            <Pause className="w-5 h-5" />
            <span>Pause</span>
          </button>
          <button
            onClick={rewindSong}
            className="flex items-center space-x-2 bg-purple-600 text-white px-8 py-4 rounded-lg font-medium hover:bg-purple-700 transition-colors"
          >
            <Rewind className="w-5 h-5" />
            <span>Rewind</span>
          </button>
          <button
            onClick={skipSong}
            className="flex items-center space-x-2 bg-purple-600 text-white px-8 py-4 rounded-lg font-medium hover:bg-purple-700 transition-colors"
          >
            <SkipForward className="w-5 h-5" />
            <span>Skip</span>
          </button>
        </div>
      </main>
    </div>
  );
}
