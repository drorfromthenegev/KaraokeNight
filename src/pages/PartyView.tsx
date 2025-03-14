import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Music, AlertCircle, CheckCircle2, Mic2, LogOut, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [submittedSongId, setSubmittedSongId] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  // New state variables for manual title input
  const [showManualTitleInput, setShowManualTitleInput] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  // Toast notification state
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'error' | 'warning' | 'success'>('error');
  const [showToast, setShowToast] = useState(false);
  
  const { 
    partyId,
    setPartyId, 
    setPasscode, 
    addSong, 
    queue, 
    setQueue,
    getUserQueuePosition 
  } = usePartyStore();

  // Add ref to store previous queue position
  const prevPositionRef = useRef<number>(-1);

  // Toast timer ref
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Show toast notification function
  const showToastMessage = (message: string, type: 'error' | 'warning' | 'success' = 'error') => {
    setToast(message);
    setToastType(type);
    setShowToast(true);
    
    // Clear any existing timer
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    
    // Set new timer to hide toast
    toastTimerRef.current = setTimeout(() => {
      setShowToast(false);
    }, 5000);
  };

  // Restore persisted values on mount
  useEffect(() => {
    const storedPartyId = localStorage.getItem('partyId');
    const storedSubmittedSongId = localStorage.getItem('submittedSongId');
    if (storedPartyId && !partyId) {
      setPartyId(storedPartyId);
      setJoined(true);
    }
    if (storedSubmittedSongId) {
      setSubmittedSongId(storedSubmittedSongId);
    }
  }, []); // Run once

  // Cleanup toast timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Check if party exists; if not, clear persisted data and return to join view
  useEffect(() => {
    if (!partyId) return;
    const checkParty = async () => {
      const { data, error } = await supabase
        .from('parties')
        .select('id')
        .eq('id', partyId)
        .single();
      if (error || !data) {
        localStorage.removeItem('partyId');
        localStorage.removeItem('submittedSongId');
        setPartyId('');
        setJoined(false);
      }
    };
    checkParty();
  }, [partyId, setPartyId]);

  // Subscribe and attach both postgres_changes and broadcast 'play' listeners
  useEffect(() => {
    const subscription = supabase.channel(`party:${partyId}`) 
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'songs' },
        async () => {
          const { data: updatedQueue } = await supabase
            .from('songs')
            .select('*')
            .eq('party_id', partyId)
            .order('created_at', { ascending: true });
          if (updatedQueue) {
            setQueue(updatedQueue);
          }
        }
      )
      .on('broadcast', { event: 'play' }, (payload) => {
        if (submittedSongId && payload?.payload?.song?.id === submittedSongId) {
          setIsPlaying(true);
        } else {
          setIsPlaying(false);
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [partyId, setQueue, submittedSongId]);

  useEffect(() => {
    if (name) {
      const position = getUserQueuePosition(name);
      if (position === -1) {
        setShowSubmission(true);
      } else {
        setShowSubmission(false);
        
        // Only show notification if position has changed and is within notification range
        if (position <= 2 && position !== prevPositionRef.current) {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(
              position === 1 
                ? "You're up next!" 
                : `You're ${position} songs away from performing!`
            );
          }
        }
        
        // Update the previous position
        prevPositionRef.current = position;
      }
    }
  }, [queue, name, getUserQueuePosition]);

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
        localStorage.setItem('partyId', data.id);
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
      
      // Check if video is unembeddable and no manual title has been provided
      if (title === 'Unknown Title' && !manualTitle) {
        setShowManualTitleInput(true);
        showToastMessage(
          "This video might not be embeddable. Please provide a title or try another video link.", 
          "warning"
        );
        return;
      }
      
      // Use manual title if provided, otherwise use the fetched title
      const finalTitle = manualTitle || title;
      
      const { data, error } = await supabase
        .from('songs')
        .insert([{
          party_id: partyId,
          title: finalTitle,
          youtube_url: videoId,
          submitted_by: name,
          order: 0
        }])
        .select()
        .single();
        
      if (error) throw error;
      if (data) {
        addSong(data);
        setSubmittedSongId(data.id);
        localStorage.setItem('submittedSongId', data.id);
        setYoutubeUrl('');
        setManualTitle('');
        setShowManualTitleInput(false);
        setError('');
        setSuccess('Song added successfully! Get ready to shine! ✨');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (error) {
      setError('Error submitting song. Please try again.');
    }
  };

  // New cancelSong function
  const cancelSong = async () => {
    try {
      if (!submittedSongId) return;
      await supabase
        .from('songs')
        .delete()
        .eq('id', submittedSongId);
      // Optionally remove song from queue here if required
      setSubmittedSongId(null);
      localStorage.removeItem('submittedSongId');
      setShowSubmission(true);
    } catch (error) {
      setError('Error cancelling song. Please try again.');
    }
  };

  // Add leaveParty function
  const leaveParty = async () => {
    try {
      // If user submitted a song, delete it
      if (submittedSongId) {
        await supabase
          .from('songs')
          .delete()
          .eq('id', submittedSongId);
      }
      
      // Clear local storage
      localStorage.removeItem('partyId');
      localStorage.removeItem('submittedSongId');
      
      // Reset state
      setPartyId('');
      setSubmittedSongId(null);
      setJoined(false);
      
      // Navigate to main page
      navigate('/');
    } catch (error) {
      setError('Error leaving party. Please try again.');
    }
  };

  const renderQueueStatus = () => {
    const position = submittedSongId 
      ? queue.findIndex(song => song.id === submittedSongId)
      : -1;

    if (isPlaying && position === 0) {
      return (
        <div className="text-center space-y-6">
          <div className="animate-pulse">
            <Mic2 className="w-16 h-16 text-green-600 mx-auto" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Your song is playing, rock on! 🎸</h2>
          <p className="text-gray-600">Time to steal the show!</p>
        </div>
      );
    }
    
    if (position === 0) {
      return (
        <div className="text-center space-y-6">
          <div className="animate-pulse">
            <Mic2 className="w-16 h-16 text-purple-600 mx-auto" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">It's Your Time to Shine! 🎤</h2>
          <p className="text-gray-600">Show them what you've got!</p>
          <div className="mt-8 text-lg font-medium text-purple-600">
            Now performing: {queue[0].title}
          </div>
        </div>
      );
    }

    if (position === -1) return null;
    return (
      <div className="text-center space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {position === 0 
            ? "You're Up Next! 🎉" 
            : `${position} ${position === 1 ? 'song' : 'songs'} until your performance`}
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
        {submittedSongId && (
          <button
            onClick={cancelSong}
            className="mt-4 py-2 px-4 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
          >
            Cancel Song
          </button>
        )}
      </div>
    );
  };

  // Toast component
  const ToastNotification = () => {
    if (!showToast) return null;
    
    const bgColor = {
      error: 'bg-red-50 border-red-200 text-red-700',
      warning: 'bg-amber-50 border-amber-200 text-amber-700',
      success: 'bg-green-50 border-green-200 text-green-700'
    }[toastType];
    
    return (
      <div className={`fixed top-4 right-4 p-4 rounded-lg border ${bgColor} shadow-lg max-w-xs animate-fadeIn`}>
        <div className="flex items-center">
          {toastType === 'error' && <AlertCircle className="w-5 h-5 mr-2" />}
          {toastType === 'warning' && <AlertCircle className="w-5 h-5 mr-2" />}
          {toastType === 'success' && <CheckCircle2 className="w-5 h-5 mr-2" />}
          <p>{toast}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center p-4">
      {/* Toast notification */}
      <ToastNotification />
      
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
            {/* Leave Party Button */}
            <div className="flex justify-end">
              <button
                onClick={leaveParty}
                className="flex items-center text-red-600 hover:text-red-800 transition-colors"
                aria-label="Leave party"
              >
                <LogOut className="w-5 h-5 mr-1" />
                Leave Party
              </button>
            </div>
            
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
                    
                    {/* Manual title input - only shown when needed */}
                    {showManualTitleInput && (
                      <div className="mt-4">
                        <label htmlFor="manualTitle" className="block text-sm font-medium text-gray-700 mb-1">
                          Song Title (required)
                        </label>
                        <input
                          type="text"
                          id="manualTitle"
                          value={manualTitle}
                          onChange={(e) => setManualTitle(e.target.value)}
                          placeholder="Enter song title"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        <p className="text-sm text-amber-600 mt-1">
                          The video might not be embeddable. Please provide a title.
                        </p>
                      </div>
                    )}
                    
                    <div className="mt-2">
                      <div className="text-amber-600 text-sm">
                        <p>⚠️ Please avoid videos from Karafun or Sing King channels if possible.</p>
                        <button 
                          onClick={() => setShowExplanation(!showExplanation)}
                          className="text-blue-600 hover:text-blue-800 text-xs flex items-center mt-1 focus:outline-none"
                        >
                          {showExplanation ? 'Hide explanation' : 'Why?'} 
                          {showExplanation ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                        </button>
                      </div>
                      {showExplanation && (
                        <div className="bg-amber-50 p-3 rounded-md mt-2 text-xs text-gray-700">
                          <p>Videos from these channels block embedding on external sites, making them difficult for our karaoke MC to play. Almost every song they offer has alternative karaoke versions on YouTube that will work better with our system.</p>
                          <p className="mt-2">You can still use these videos if you can't find alternatives, but it might cause a slight delay when your turn comes up. Your MC will appreciate the consideration!</p>
                        </div>
                      )}
                    </div>
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