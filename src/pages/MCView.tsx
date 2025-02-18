import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Trash2, GripVertical, Play } from 'lucide-react';
import { usePartyStore } from '../store/partyStore';
import { supabase } from '../lib/supabase';

export function MCView() {
  const { partyId } = useParams();
  const { queue, passcode, removeSong, reorderQueue } = usePartyStore();

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

        <div className="mt-8 flex justify-center">
          <button className="flex items-center space-x-2 bg-purple-600 text-white px-8 py-4 rounded-lg font-medium hover:bg-purple-700 transition-colors">
            <Play className="w-5 h-5" />
            <span>Play Next Song</span>
          </button>
        </div>
      </main>
    </div>
  );
}