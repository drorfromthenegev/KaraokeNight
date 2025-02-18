import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Music, AlertCircle, CheckCircle2, Mic2 } from 'lucide-react';
import { usePartyStore } from '../store/partyStore';
import { supabase } from '../lib/supabase';

export function PartyView() {
  const navigate = useNavigate();
  const [passcodeInput, setPasscodeInput] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [joined, setJoined] = useState(false);
  const [showSubmission, setShowSubmission] = useState(true);
  const { 
    partyId,
    setPartyId, 
    setPasscode, 
    addSong, 
    queue, 
    currentSong,
    setQueue,
    setCurrentSong,
    getUserQueuePosition 
  } = usePartyStore();

  useEffect(() => {
    if (joined && partyId) {
      const subscription = supabase
        .channel(`party:${partyId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'songs'
          },
          async (payload) => {
            const { data: updatedQueue } = await supabase
              .from('songs')
              .select('*')
              .eq('party_id', partyId)
              .order('order', { ascending: true });

            if (updatedQueue) {
              setQueue(updatedQueue);
            }
          }
        )
        .subscribe();

      // Initial queue fetch
      const fetchQueue = async () => {
        const { data: initialQueue } = await supabase
          .from('songs')
          .select('*')
          .eq('party_id', partyId)
          .order('order', { ascending: true });

        if (initialQueue) {
          setQueue(initialQueue);
        }
      };

      fetchQueue();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [joined, partyId, setQueue]);

  useEffect(() => {
    if (name) {
      const position = getUserQueuePosition(name);
      if (position === -1) {
        setShowSubmission(true);
      } else {
        setShowSubmission(false);
        
        if (currentSong?.submitted_by === name) {
          // Show "You're up!" screen
        } else if (position <= 2 && position !== -1) {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(
              position === 0 
                ? "You're up next!" 
                : `You're ${position + 1} songs away from performing!`
            );
          }
        }
      }
    }
  }, [queue, currentSong, name, getUserQueuePosition]);

  const joinParty = async () => {
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
        setJoined(true);
        setError('');

        if ('Notification' in window) {
          Notification.requestPermission();
        }
      } else {
        setError('Invalid party code');
      }
    } catch (error) {
      setError('Invalid party code');
    }
  };

  const extractVideoId = (url: string) => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  const getVideoTitle = async (videoId: string) => {
    try {
      const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
      const data = await response.json();
      return data.title || 'Unknown Title';
    } catch (error) {
      return 'Unknown Title';
    }
  };

  const submitSong = async () => {
    try {
      if (!name.trim()) {
        setError('Please enter your name');
        return;
      }

      if (!partyId) {
        setError('Party ID is missing');
        return;
      }

      const videoId = extractVideoId(youtubeUrl);
      if (!videoId) {
        setError('Invalid YouTube URL');
        return;
      }

      const title = await getVideoTitle(videoId);
      const { data: existingSongs } = await supabase
        .from('songs')
        .select('order')
        .eq('party_id', partyId)
        .order('order', { ascending: false })
        .limit(1);

      const nextOrder = existingSongs && existingSongs.length > 0 ? existingSongs[0].order + 1 : 0;

      const { data, error } = await supabase
        .from('songs')
        .insert([{
          party_id: partyId,
          title,
          youtube_url: videoId,
          submitted_by: name,
          order: nextOrder
        }])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        addSong(data);
        setYoutubeUrl('');
        setError('');
        setSuccess('Song added successfully! Get ready to shine! ✨');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (error) {
      setError('Error submitting song. Please try again.');
    }
  };

  const renderQueueStatus = () => {
    const position = getUserQueuePosition(name);
    const isCurrentSinger = currentSong?.submitted_by === name;

    if (isCurrentSinger) {
      return (
        <div className="text-center space-y-6">
          <div className="animate-pulse">
            <Mic2 className="w-16 h-16 text-purple-600 mx-auto" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">It's Your Time to Shine! 🎤</h2>
          <p className="text-gray-600">Show them what you've got!</p>
          <div className="mt-8 text-lg font-medium text-purple-600">
            Now performing: {currentSong.title}
          </div>
        </div>
      );
    }

    if (position === -1) {
      return null;
    }

    return (
      <div className="text-center space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {position === 0 
            ? "You're Up Next! 🎉" 
            : `${position + 1} ${position === 1 ? 'song' : 'songs'} until your performance`}
        </h2>
        <div className="relative pt-1">
          <div className="overflow-hidden h-2 text-xs flex rounded bg-purple-200">
            <div
              style={{ width: `${100 - (position * 25)}%` }}
              className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-purple-500 transition-all duration-500"
            ></div>
          </div>
        </div>
        <p className="text-gray-600">
          {position <= 2 
            ? "Time to warm up those vocal cords! 🎵" 
            : "Take your time to practice! 🎼"}
        </p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-2xl p-8">
        {!joined ? (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
                <Music className="w-8 h-8 text-purple-600" />
              </div>
              <h1 className="mt-4 text-2xl font-bold text-gray-900">Join a Party</h1>
              <p className="mt-2 text-gray-600">Enter the party passcode to join</p>
            </div>

            {error && (
              <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <input
                type="text"
                value={passcodeInput}
                onChange={(e) => setPasscodeInput(e.target.value)}
                placeholder="Enter party code"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />

              <button
                onClick={joinParty}
                className="w-full py-3 px-4 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
              >
                Join Party
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {renderQueueStatus()}

            {showSubmission && (
              <>
                <h2 className="text-xl font-bold text-gray-900">Submit a Song</h2>

                {error && (
                  <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
                    <AlertCircle className="w-5 h-5" />
                    <span>{error}</span>
                  </div>
                )}

                {success && (
                  <div className="flex items-center space-x-2 text-green-600 bg-green-50 p-3 rounded-lg">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>{success}</span>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                      Your Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label htmlFor="youtube" className="block text-sm font-medium text-gray-700 mb-1">
                      YouTube URL
                    </label>
                    <input
                      type="text"
                      id="youtube"
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      placeholder="Paste YouTube URL"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  <button
                    onClick={submitSong}
                    className="w-full py-3 px-4 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
                  >
                    Add to Queue
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}