import React, { useEffect, useRef } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Maximize, Minimize } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PeerStream } from "@/store/useGroupCallStore";

interface GroupActiveCallUIProps {
  localStream: MediaStream | null;
  peers: Map<string, PeerStream>;
  isLocalMuted: boolean;
  isLocalVideoOff: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
}

const VideoPlayer = ({ stream, isLocal, user, isVideoOff, isMuted }: { stream: MediaStream | null, isLocal?: boolean, user: any, isVideoOff?: boolean, isMuted?: boolean }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative w-full h-full bg-zinc-900 rounded-2xl overflow-hidden flex items-center justify-center border border-white/10 group">
      {(isVideoOff || !stream) ? (
        <Avatar className="w-24 h-24 sm:w-32 sm:h-32 shadow-xl border-4 border-zinc-800">
          <AvatarImage src={user?.avatar || undefined} />
          <AvatarFallback className="text-4xl">{(user?.username || user?.email || '?').charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`w-full h-full object-cover ${isLocal ? 'scale-x-[-1]' : ''}`}
        />
      )}
      
      {/* Name Badge */}
      <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg flex items-center gap-2">
        <span className="text-white text-sm font-medium">{isLocal ? "You" : (user?.username || user?.email)}</span>
        {isMuted && <MicOff className="w-4 h-4 text-red-400" />}
      </div>
    </div>
  );
};

export default function GroupActiveCallUI({
  localStream,
  peers,
  isLocalMuted,
  isLocalVideoOff,
  onToggleMute,
  onToggleVideo,
  onEndCall
}: GroupActiveCallUIProps) {
  
  // Calculate grid layout based on number of participants
  const totalParticipants = peers.size + 1; // +1 for local
  let gridClass = "grid-cols-1 md:grid-cols-2";
  
  if (totalParticipants === 1) gridClass = "grid-cols-1";
  else if (totalParticipants === 2) gridClass = "grid-cols-1 md:grid-cols-2";
  else if (totalParticipants <= 4) gridClass = "grid-cols-2";
  else if (totalParticipants <= 6) gridClass = "grid-cols-2 md:grid-cols-3";
  else gridClass = "grid-cols-3 md:grid-cols-4";

  const hasVideoTrack = localStream ? localStream.getVideoTracks().length > 0 : false;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0a0a0a] animate-in fade-in duration-300">
      
      {/* Top Bar */}
      <div className="flex justify-between items-center p-6 absolute top-0 left-0 right-0 z-10 bg-linear-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
          <span className="text-white font-medium text-lg tracking-wide">Group Call</span>
          <span className="text-white/60 text-sm bg-white/10 px-2 py-0.5 rounded-full ml-2">
            {totalParticipants} in call
          </span>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 p-4 sm:p-8 pt-20 pb-32 flex items-center justify-center">
        <div className={`w-full max-w-7xl h-full grid gap-4 ${gridClass}`}>
          {/* Local Participant */}
          <VideoPlayer 
            stream={localStream} 
            isLocal 
            user={{ username: 'You' }} 
            isVideoOff={isLocalVideoOff} 
            isMuted={isLocalMuted} 
          />
          
          {/* Remote Peers */}
          {Array.from(peers.values()).map(peer => (
            <VideoPlayer 
              key={peer.userId} 
              stream={peer.stream} 
              user={peer.user} 
              isVideoOff={peer.isVideoOff} 
              isMuted={peer.isMuted} 
            />
          ))}
        </div>
      </div>

      {/* Floating Controls */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-xl border border-white/10 px-8 py-4 rounded-full flex items-center gap-6 shadow-2xl">
        <button 
          onClick={onToggleMute}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
            isLocalMuted 
              ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' 
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          {isLocalMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        {hasVideoTrack && (
          <button 
            onClick={onToggleVideo}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              isLocalVideoOff 
                ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' 
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {isLocalVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
          </button>
        )}

        <div className="w-px h-8 bg-white/20 mx-2" />

        <button 
          onClick={onEndCall}
          className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg transition-transform hover:scale-110 active:scale-95"
        >
          <PhoneOff className="w-7 h-7" />
        </button>
      </div>

    </div>
  );
}
