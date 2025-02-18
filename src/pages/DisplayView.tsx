import React, { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import YouTube from 'react-youtube';
import { usePartyStore } from '../store/partyStore';
import { supabase } from '../lib/supabase';

export function DisplayView() {
  const { partyId } = useParams();
  const { currentSong, passcode, setCurrentSong } = usePartyStore();
  const playerRef = useRef(null);

  useEffect(() => {
    const subscription = supabase
      .channel(`party:${partyId}`)
      .on('broadcast', { event: 'play' }, () => {
        playerRef.current?.playVideo();
      })
      .on('broadcast', { event: 'pause' }, () => {
        playerRef.current?.pauseVideo();
      })
      .on('broadcast', { event: 'rewind' }, () => {
        playerRef.current?.seekTo(0);
      })
      .on('broadcast', { event: 'skip' }, () => {
        playerRef.current?.stopVideo();
        setCurrentSong(null);
      })
      .on('broadcast', { event: 'setCurrentSong' }, (payload) => {
        setCurrentSong(payload.song);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [partyId, setCurrentSong]);

  return (
    <div className="min-h-screen bg-black">
      <div className="fixed top-0 left-0 right-0 bg-gradient-to-b from-black to-transparent z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center text-white">
            <div>
              {currentSong && (
                <div>
                  <h2 className="text-xl font-bold">{currentSong.title}</h2>
                  <p className="text-sm opacity-75">Performed by {currentSong.submittedBy}</p>
                </div>
              )}
            </div>
            <div className="bg-white/10 px-4 py-2 rounded-lg backdrop-blur-sm">
              <span className="font-medium">Passcode: {passcode}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="h-screen flex items-center justify-center">
        {currentSong ? (
          <YouTube
            videoId={currentSong.youtubeUrl}
            opts={{
              height: '720',
              width: '1280',
              playerVars: {
                autoplay: 1,
                controls: 0,
                modestbranding: 1,
              },
            }}
            onReady={(event) => {
              playerRef.current = event.target;
            }}
          />
        ) : (
          <div className="text-white text-center">
            <h2 className="text-2xl font-bold mb-2">Waiting for songs...</h2>
            <p className="opacity-75">Add songs using the party code: {passcode}</p>
          </div>
        )}
      </div>
    </div>
  );
}
