import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CallerInfo } from "@/store/useCallStore";

interface ActiveCallUIProps {
  peer: CallerInfo;
  callType: 'audio' | 'video';
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onEndCall: () => void;
}

export default function ActiveCallUI({ peer, callType, localStream, remoteStream, onEndCall }: ActiveCallUIProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'audio');
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Timer
  useEffect(() => {
    const timer = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#070B14] flex flex-col overflow-hidden animate-in fade-in duration-300">
      
      {/* Remote Video / Audio Avatar */}
      <div className="flex-1 relative bg-[#070B14] flex items-center justify-center">
        {callType === 'video' && (
          <video 
            ref={remoteVideoRef} 
            autoPlay 
            playsInline 
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        
        {/* Fallback if audio or remote video is off (we simulate it with just the avatar if no track) */}
        {(!remoteStream || callType === 'audio' || remoteStream.getVideoTracks().length === 0 || !remoteStream.getVideoTracks()[0].enabled) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#070B14] z-10 overflow-hidden">
            <div className="absolute inset-0 bg-[url('/cyber-grid.svg')] opacity-[0.03] bg-repeat bg-size-[32px_32px]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40vw] h-[40vw] bg-neon-cyan/10 rounded-full blur-[100px] pointer-events-none animate-pulse" />
            <Avatar className="w-32 h-32 mb-6 border-2 border-neon-cyan/50 shadow-[0_0_30px_rgba(0,229,255,0.3)] relative z-20">
              <AvatarImage src={peer.avatar || undefined} />
              <AvatarFallback className="text-4xl bg-black/40 text-neon-cyan">{(peer.username || peer.email || '?').charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <h2 className="text-3xl font-bold font-heading text-white neon-text-glow relative z-20">{peer.username || peer.email}</h2>
            <p className="text-neon-cyan mt-3 text-lg font-mono tracking-widest relative z-20">{formatTime(duration)}</p>
          </div>
        )}

        {/* Local Video Picture-in-Picture */}
        {callType === 'video' && (
          <div className="absolute bottom-6 right-6 w-32 h-48 md:w-48 md:h-72 bg-glass-surface rounded-2xl overflow-hidden shadow-[0_0_20px_rgba(0,229,255,0.2)] border border-neon-cyan/30 z-20 transition-all">
            {!isVideoOff ? (
              <video 
                ref={localVideoRef} 
                autoPlay 
                playsInline 
                muted // Always mute local video to prevent echo
                className="w-full h-full object-cover mirror"
                style={{ transform: "scaleX(-1)" }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-black/40 backdrop-blur-md">
                <VideoOff className="w-8 h-8 text-white/50" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="h-28 bg-glass-surface backdrop-blur-xl border-t border-glass-border flex items-center justify-center gap-6 px-6 z-30 pb-safe">
        <button 
          onClick={toggleMute}
          className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isMuted ? 'bg-white text-[#070B14]' : 'bg-black/40 hover:bg-white/10 text-white border border-glass-border'}`}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>
        
        {callType === 'video' && (
          <button 
            onClick={toggleVideo}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isVideoOff ? 'bg-white text-[#070B14]' : 'bg-black/40 hover:bg-white/10 text-white border border-glass-border'}`}
          >
            {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
          </button>
        )}

        <button 
          onClick={onEndCall}
          className="w-16 h-16 rounded-2xl bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all hover:scale-105 active:scale-95 border border-red-400/50"
        >
          <PhoneOff className="w-7 h-7" />
        </button>
      </div>

    </div>
  );
}
