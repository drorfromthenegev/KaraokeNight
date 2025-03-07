import React, { useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import YouTube, { YouTubeProps } from 'react-youtube';
import { usePartyStore } from '../store/partyStore';
import { supabase } from '../lib/supabase';

interface YouTubeEvent {
  target: any;
}	

export function DisplayView() {
  const { partyId } = useParams<{ partyId: string }>();
  const playerRef = useRef<any>(null);
  const { queue, passcode, setQueue, removeSong } = usePartyStore();

  // Subscribe to DB changes and attach broadcast listeners
  useEffect(() => {

    const subscription = supabase.channel(`party:${partyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'songs'
        },
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
      .on('broadcast', { event: 'pause' }, () => {
        playerRef.current?.pauseVideo();
      })
      .on('broadcast', { event: 'play' }, () => {
        playerRef.current?.playVideo();
      })
      .on('broadcast', { event: 'rewind' }, () => {
        playerRef.current?.seekTo(0);
      })
      .on('broadcast', { event: 'skip' }, () => {
        playerRef.current?.stopVideo();
      })
      .subscribe();

    // Initial queue fetch
    const fetchQueue = async () => {
      const { data: initialQueue } = await supabase
        .from('songs')
        .select('*')
        .eq('party_id', partyId)
        .order('created_at', { ascending: true });
      if (initialQueue) {
        setQueue(initialQueue);
      }
    };
    fetchQueue();

    return () => {
      subscription.unsubscribe();
    };
  }, [partyId, setQueue]);

  const handleVideoEnd = async () => {
    if (queue[0]) {
      // Remove the song from the database
      await supabase
        .from('songs')
        .delete()
        .eq('id', queue[0].id);
      
      // Remove from local state
      removeSong(queue[0].id);
    }
  };

  return (
    <div className="min-h-screen h-screen flex flex-col bg-black">
      {/* Redesigned compact header with 3 columns */}
      <header className="bg-black py-4 px-6 border-b border-gray-800">
        <div className="flex justify-between items-center">
          {/* Left: Website URL */}
          <div className="text-white text-2xl font-bold w-1/4">
            {window.location.origin}
          </div>
          
          {/* Center: Song info */}
          <div className="text-white text-center flex-1">
            {queue[0] ? (
              <div>
                <h2 className="text-2xl font-semibold">{queue[0].title}</h2>
                <p className="text-lg opacity-75">Performed by {queue[0].submitted_by}</p>
              </div>
            ) : (
              <div className="text-xl">
                Waiting for songs...
              </div>
            )}
          </div>
          
          {/* Right: Passcode */}
          <div className="text-white text-2xl font-bold w-1/4 text-right">
            Party Code: <span className="text-purple-400">{passcode}</span>
          </div>
        </div>
      </header>

      {/* Fixed video container to take all available space */}
      <div className="flex-grow relative w-full">
        {queue[0] ? (
          <div className="absolute inset-0">
            <YouTube
              videoId={queue[0].youtube_url}
              opts={{
                playerVars: {
                  autoplay: 0,
                  controls: 0,
                  modestbranding: 1,
                },
              }}
              className="w-full h-full"
              containerClassName="w-full h-full"
              iframeClassName="w-full h-full"
              onReady={(event: YouTubeEvent) => {
                playerRef.current = event.target;
                
                // Apply styles directly to the iframe for full size
                const iframe = event.target.getIframe();
                if (iframe) {
                  iframe.style.width = '100%';
                  iframe.style.height = '100%';
                }
              }}
              onEnd={handleVideoEnd}
            />
          </div>
        ) : (
          <div className="text-white text-center p-8 h-full flex items-center justify-center">
            <div>
              <h2 className="text-4xl font-bold mb-4">Waiting for songs...</h2>
              <p className="text-2xl opacity-75">Add songs using the party code: {passcode}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
