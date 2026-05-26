import { Phone, PhoneOff, Video } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CallerInfo } from "@/store/useCallStore";

interface IncomingCallModalProps {
  caller: CallerInfo;
  callType: 'audio' | 'video';
  onAccept: () => void;
  onReject: () => void;
}

export default function IncomingCallModal({ caller, callType, onAccept, onReject }: IncomingCallModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-sm rounded-3xl p-8 flex flex-col items-center shadow-2xl border border-border/50 animate-in slide-in-from-bottom-10">
        
        {/* Pulsing Avatar */}
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping scale-150" />
          <Avatar className="w-24 h-24 border-4 border-background relative z-10">
            <AvatarImage src={caller.avatar || undefined} />
            <AvatarFallback className="text-3xl">{(caller.username || caller.phoneNumber || '?').charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
        </div>

        <h2 className="text-2xl font-bold mb-1">{caller.username || caller.phoneNumber}</h2>
        <p className="text-muted-foreground flex items-center gap-2 mb-8">
          {callType === 'video' ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
          Incoming {callType} call...
        </p>

        <div className="flex items-center gap-8 w-full justify-center">
          <button 
            onClick={onReject}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg transition-transform hover:scale-110 active:scale-95"
          >
            <PhoneOff className="w-7 h-7" />
          </button>
          
          <button 
            onClick={onAccept}
            className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center text-white shadow-lg transition-transform hover:scale-110 active:scale-95 animate-bounce"
          >
            {callType === 'video' ? <Video className="w-7 h-7" /> : <Phone className="w-7 h-7 fill-current" />}
          </button>
        </div>
        
      </div>
    </div>
  );
}
