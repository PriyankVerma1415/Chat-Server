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
    <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden animate-in fade-in duration-300">
      
      {/* Remote Video / Audio Avatar */}
      <div className="flex-1 relative bg-black flex items-center justify-center">
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
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 z-10">
            <Avatar className="w-32 h-32 mb-4 border-2 border-primary/20">
              <AvatarImage src={peer.avatar || undefined} />
              <AvatarFallback className="text-4xl">{(peer.username || peer.phoneNumber || '?').charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <h2 className="text-2xl font-medium text-white">{peer.username || peer.phoneNumber}</h2>
            <p className="text-zinc-400 mt-2">{formatTime(duration)}</p>
          </div>
        )}

        {/* Local Video Picture-in-Picture */}
        {callType === 'video' && (
          <div className="absolute bottom-24 right-6 w-32 h-48 md:w-48 md:h-72 bg-zinc-800 rounded-xl overflow-hidden shadow-2xl border-2 border-zinc-700 z-20 transition-all">
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
              <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                <VideoOff className="w-8 h-8 text-zinc-500" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="h-24 bg-zinc-950 flex items-center justify-center gap-6 px-6 z-30 pb-safe">
        <button 
          onClick={toggleMute}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isMuted ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 hover:bg-zinc-700 text-white'}`}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>
        
        {callType === 'video' && (
          <button 
            onClick={toggleVideo}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isVideoOff ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 hover:bg-zinc-700 text-white'}`}
          >
            {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
          </button>
        )}

        <button 
          onClick={onEndCall}
          className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          <PhoneOff className="w-7 h-7" />
        </button>
      </div>

    </div>
  );
}
