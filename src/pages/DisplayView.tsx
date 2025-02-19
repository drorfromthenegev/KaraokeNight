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
    <div className="min-h-screen bg-black">
      <div className="fixed top-0 left-0 right-0 bg-gradient-to-b from-black to-transparent z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center text-white">
            <div>
              {queue[0] && (
                <div>
                  <h2 className="text-xl font-bold">{queue[0].title}</h2>
                  <p className="text-sm opacity-75">Performed by {queue[0].submitted_by}</p>
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
        {queue[0] ? (
          <YouTube
            videoId={queue[0].youtube_url}
            opts={{
              height: '720',
              width: '1280',
              playerVars: {
                autoplay: 0,
                controls: 0,
                modestbranding: 1,
              },
            }}
            onReady={(event: YouTubeEvent) => {
              playerRef.current = event.target;
            }}
            onEnd={handleVideoEnd}  // Add onEnd handler
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
