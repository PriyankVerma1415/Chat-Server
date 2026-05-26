"use client";

import { useEffect, useRef, useState } from "react";
import { socket } from "@/services/socket";
import { CallerInfo, useCallStore } from "@/store/useCallStore";
import { useAuthStore } from "@/store/useAuthStore";
import IncomingCallModal from "./IncomingCallModal";
import ActiveCallUI from "./ActiveCallUI";
import { PhoneOff } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const iceServers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
};

export default function CallOverlay() {
  const { user } = useAuthStore();
  const { 
    isReceivingCall, caller, callerSignal, incomingCallType, 
    isCalling, callee, outgoingCallType, 
    isCallActive, 
    setIncomingCall, acceptCall, endCall: storeEndCall, clearCall 
  } = useCallStore();

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  // Clean up streams and connection
  const cleanup = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    setRemoteStream(null);
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    clearCall();
  };

  const getMedia = async (type: 'audio' | 'video') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: type === 'video',
        audio: true
      });
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error("Failed to get media", err);
      alert("Failed to access camera or microphone. Please check permissions.");
      return null;
    }
  };

  const createPeerConnection = (targetUserId: string) => {
    const pc = new RTCPeerConnection(iceServers);
    
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice_candidate", {
          to: targetUserId,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  // Socket Listeners
  useEffect(() => {
    if (!user) return;

    const handleIncomingCall = (data: any) => {
      // If we are already in a call, notify caller we are busy
      if (isCallActive || isCalling || isReceivingCall) {
        socket.emit("call_busy", { to: data.from });
        return;
      }
      setIncomingCall(data.callerInfo, data.signal, data.callType);
    };

    const handleCallAccepted = async (signal: RTCSessionDescriptionInit) => {
      acceptCall();
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal));
      }
    };

    const handleCallRejected = () => {
      cleanup();
      alert("Call was rejected");
    };

    const handleCallBusy = () => {
      cleanup();
      alert("User is currently busy in another call");
    };

    const handleCallEnded = () => {
      cleanup();
    };

    const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
      if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("Error adding received ice candidate", e);
        }
      }
    };

    socket.on("incoming_call", handleIncomingCall);
    socket.on("call_accepted", handleCallAccepted);
    socket.on("call_rejected", handleCallRejected);
    socket.on("call_busy", handleCallBusy);
    socket.on("call_ended", handleCallEnded);
    socket.on("ice_candidate", handleIceCandidate);

    return () => {
      socket.off("incoming_call", handleIncomingCall);
      socket.off("call_accepted", handleCallAccepted);
      socket.off("call_rejected", handleCallRejected);
      socket.off("call_busy", handleCallBusy);
      socket.off("call_ended", handleCallEnded);
      socket.off("ice_candidate", handleIceCandidate);
    };
  }, [user, isCallActive, isCalling, isReceivingCall, setIncomingCall, acceptCall, clearCall]); // Added deps to check current state

  // Handle outgoing call initiation (Triggered by components calling useCallStore)
  useEffect(() => {
    if (isCalling && callee && outgoingCallType && !peerConnectionRef.current) {
      const initiateCall = async () => {
        const stream = await getMedia(outgoingCallType);
        if (!stream) {
          cleanup();
          return;
        }

        const pc = createPeerConnection(callee._id);
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit("call_user", {
          userToCall: callee._id,
          signalData: offer,
          from: user?._id,
          callerInfo: {
            _id: user?._id,
            username: user?.username,
            avatar: user?.avatar,
            phoneNumber: user?.phoneNumber
          },
          callType: outgoingCallType
        });
      };
      initiateCall();
    }
  }, [isCalling, callee, outgoingCallType, user]);

  const handleAcceptCall = async () => {
    if (!caller || !callerSignal || !incomingCallType) return;
    
    const stream = await getMedia(incomingCallType);
    if (!stream) {
      handleRejectCall();
      return;
    }

    const pc = createPeerConnection(caller._id);
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    await pc.setRemoteDescription(new RTCSessionDescription(callerSignal));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit("answer_call", {
      to: caller._id,
      signal: answer
    });

    acceptCall();
  };

  const handleRejectCall = () => {
    if (caller) {
      socket.emit("reject_call", { to: caller._id });
    }
    cleanup();
  };

  const handleEndCall = () => {
    const targetUserId = isCalling ? callee?._id : caller?._id;
    if (targetUserId) {
      socket.emit("end_call", { to: targetUserId });
    }
    cleanup();
  };

  // Render Logic
  if (!user) return null;

  return (
    <>
      {isReceivingCall && caller && !isCallActive && (
        <IncomingCallModal 
          caller={caller} 
          callType={incomingCallType!} 
          onAccept={handleAcceptCall} 
          onReject={handleRejectCall} 
        />
      )}

      {isCalling && callee && !isCallActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="flex flex-col items-center">
            <Avatar className="w-24 h-24 mb-6 border-4 border-primary/20 animate-pulse">
              <AvatarImage src={callee.avatar || undefined} />
              <AvatarFallback className="text-3xl">{(callee.username || callee.phoneNumber || '?').charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <h2 className="text-2xl font-bold text-white mb-2">Calling {callee.username || callee.phoneNumber}...</h2>
            <p className="text-zinc-400 mb-8 animate-pulse">Waiting for answer...</p>
            <button 
              onClick={handleEndCall}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg transition-transform hover:scale-110 active:scale-95"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
          </div>
        </div>
      )}

      {isCallActive && (
        <ActiveCallUI 
          peer={(isCalling ? callee : caller)!} 
          callType={(isCalling ? outgoingCallType : incomingCallType)!} 
          localStream={localStream} 
          remoteStream={remoteStream} 
          onEndCall={handleEndCall} 
        />
      )}
    </>
  );
}
