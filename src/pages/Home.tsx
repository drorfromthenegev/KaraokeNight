import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Music, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { usePartyStore } from '../store/partyStore';

export function Home() {
  const navigate = useNavigate();
  const [passcodeInput, setPasscodeInput] = useState('');
  const [error, setError] = useState('');
  const setPartyId = usePartyStore((state) => state.setPartyId);
  const setPasscode = usePartyStore((state) => state.setPasscode);

  const createParty = async () => {
    try {
      const passcode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { data, error } = await supabase
        .from('parties')
        .insert([{ passcode }])
        .select()
        .single();

      if (error) throw error;

      setPartyId(data.id);
      setPasscode(passcode);
      navigate(`/mc/${data.id}`);
    } catch (error) {
      console.error('Error creating party:', error);
      setError('Failed to create party. Please try again.');
    }
  };

  const joinPartyAsDisplay = async () => {
    try {
      const { data, error } = await supabase
        .from('parties')
        .select()
        .eq('passcode', passcodeInput.toUpperCase())
        .single();

      if (error) throw error;

      if (data) {
        setPartyId(data.id);
        setPasscode(data.passcode);
        navigate(`/display/${data.id}`);
      } else {
        setError('Invalid party code');
      }
    } catch (error) {
      setError('Invalid party code');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-2xl p-8">
        <div className="space-y-6">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
              <Music className="w-8 h-8 text-purple-600" />
            </div>
            <h1 className="mt-4 text-3xl font-bold text-gray-900">Karaoke Party</h1>
            <p className="mt-2 text-gray-600">Host, join, or display a karaoke party</p>
          </div>

          {error && (
            <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Host and Join buttons on the same row */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={createParty}
                className="py-3 px-4 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
              >
                Host a Party
              </button>
              
              <button
                onClick={() => navigate('/party')}
                className="py-3 px-4 bg-gray-100 text-gray-900 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Join Party
              </button>
            </div>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">or</span>
              </div>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                value={passcodeInput}
                onChange={(e) => setPasscodeInput(e.target.value)}
                placeholder="Enter party code"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              
              {/* Display View button on its own row */}
              <button
                onClick={joinPartyAsDisplay}
                className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Display View
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}