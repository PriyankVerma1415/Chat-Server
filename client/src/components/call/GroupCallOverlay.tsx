"use client";

import { useEffect, useRef, useState } from "react";
import { socket } from "@/services/socket";
import { useAuthStore } from "@/store/useAuthStore";
import { useGroupCallStore } from "@/store/useGroupCallStore";
import { useChatStore } from "@/store/useChatStore";
import GroupActiveCallUI from "./GroupActiveCallUI";
import { Phone, Video, X } from "lucide-react";
import { ringtonePlayer } from "@/lib/ringtone";

const iceServers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
};

export default function GroupCallOverlay() {
  const { user } = useAuthStore();
  const { conversations } = useChatStore();
  const {
    activeGroupId,
    isCallActive,
    localStream,
    isLocalMuted,
    isLocalVideoOff,
    activeGroupCallsList,
    peers,
    peerConnections,
    leaveCall,
    addPeer,
    removePeer,
    setPeerStream,
    setPeerConnection,
    joinCall,
    toggleLocalMute,
    toggleLocalVideo,
    setActiveGroupCallsList,
    addGroupCall,
    removeGroupCall,
    updateGroupCallParticipants
  } = useGroupCallStore();

  const [dismissedCalls, setDismissedCalls] = useState<Set<string>>(new Set());

  const handleEndCall = () => {
    if (activeGroupId) {
      socket.emit("leave_group_call", { groupId: activeGroupId });
    }
    leaveCall();
  };

  const createPeerConnection = (targetUserId: string) => {
    const pc = new RTCPeerConnection(iceServers);
    
    pc.onicecandidate = (event) => {
      if (event.candidate && activeGroupId) {
        socket.emit("group_ice_candidate", {
          to: targetUserId,
          candidate: event.candidate,
          from: user?._id
        });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setPeerStream(targetUserId, event.streams[0]);
      }
    };

    setPeerConnection(targetUserId, pc);
    return pc;
  };

  // Play ringtone when group call banners are showing
  useEffect(() => {
    const visibleCalls = activeGroupCallsList.filter(call => !dismissedCalls.has(call.groupId));
    if (!isCallActive && visibleCalls.length > 0) {
      ringtonePlayer.start();
    } else {
      ringtonePlayer.stop();
    }
    return () => ringtonePlayer.stop();
  }, [isCallActive, activeGroupCallsList, dismissedCalls]);

  // Setup Socket listeners for tracking active group calls and joining
  useEffect(() => {
    if (!user) return;

    socket.on('active_group_calls', (calls) => {
      setActiveGroupCallsList(calls);
    });

    socket.on('group_call_started', (data) => {
      addGroupCall(data.groupId, data.initiator);
    });

    socket.on('group_call_ended', (data) => {
      removeGroupCall(data.groupId);
      setDismissedCalls(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.groupId);
        return newSet;
      });
    });

    socket.on('group_call_participants', (data) => {
      // Received when I join a group call to know who is already inside
      updateGroupCallParticipants(data.groupId, data.participants);
      
      // If I am in the call, I wait for them to send me offers!
    });

    socket.on('user_joined_group_call', async (data) => {
      // Someone joined my active call!
      updateGroupCallParticipants(activeGroupId!, [...Array.from(peers.values()).map(p => p.user), data.user, user]);
      
      if (!isCallActive) return;
      
      // I must initiate an offer to them
      addPeer(data.userId, data.user);
      const pc = createPeerConnection(data.userId);
      
      // Add local stream tracks
      if (useGroupCallStore.getState().localStream) {
        useGroupCallStore.getState().localStream?.getTracks().forEach(track => {
          pc.addTrack(track, useGroupCallStore.getState().localStream!);
        });
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('group_offer', {
        userToCall: data.userId,
        signalData: offer,
        callerId: user?._id
      });
    });

    socket.on('user_left_group_call', (data) => {
      if (isCallActive) {
        removePeer(data.userId);
      }
    });

    socket.on('group_offer', async (data) => {
      if (!isCallActive) return;
      
      // Someone sent me an offer (they were already in the call)
      const { callerId, signal } = data;
      // We don't have their user object here directly, we can just save ID or fetch it
      addPeer(callerId, { _id: callerId, username: 'Participant' }); // Placeholder until we populate properly
      
      const pc = createPeerConnection(callerId);
      
      // Add local tracks
      if (useGroupCallStore.getState().localStream) {
        useGroupCallStore.getState().localStream?.getTracks().forEach(track => {
          pc.addTrack(track, useGroupCallStore.getState().localStream!);
        });
      }

      await pc.setRemoteDescription(new RTCSessionDescription(signal));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('group_answer', {
        callerId,
        signalData: answer,
        answererId: user?._id
      });
    });

    socket.on('group_answer', async (data) => {
      if (!isCallActive) return;
      const { answererId, signal } = data;
      const pcs = useGroupCallStore.getState().peerConnections;
      const pc = pcs.get(answererId);
      if (pc && !pc.currentRemoteDescription) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
        } catch(e) {
          console.error(e);
        }
      }
    });

    socket.on('group_ice_candidate', async (data) => {
      if (!isCallActive) return;
      const { candidate, from } = data;
      const pcs = useGroupCallStore.getState().peerConnections;
      const pc = pcs.get(from);
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error(e);
        }
      }
    });

    return () => {
      socket.off('active_group_calls');
      socket.off('group_call_started');
      socket.off('group_call_ended');
      socket.off('group_call_participants');
      socket.off('user_joined_group_call');
      socket.off('user_left_group_call');
      socket.off('group_offer');
      socket.off('group_answer');
      socket.off('group_ice_candidate');
    };
  }, [user, isCallActive, activeGroupId, addGroupCall, removeGroupCall, setActiveGroupCallsList, updateGroupCallParticipants, addPeer, removePeer, setPeerConnection]);

  const handleJoinCall = async (groupId: string, video: boolean) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
      socket.emit("join_group_call", { groupId });
      joinCall(groupId, stream);
    } catch (err) {
      console.error(err);
      alert("Failed to access camera/microphone.");
    }
  };

  if (!isCallActive) {
    const visibleCalls = activeGroupCallsList.filter((call: any) => !dismissedCalls.has(call.groupId));
    if (visibleCalls.length > 0) {
      return (
        <div className="fixed top-20 right-6 z-50 flex flex-col gap-3 pointer-events-none">
          {visibleCalls.map((call: any) => {
            const group = conversations.find(c => c._id === call.groupId);
            if (!group) return null;
            return (
              <div key={call.groupId} className="bg-card border border-border shadow-2xl rounded-2xl p-4 flex items-center gap-4 pointer-events-auto animate-in slide-in-from-right-8 fade-in">
                <div className="flex-1">
                  <h4 className="font-semibold text-sm">Call in {group.name}</h4>
                  <p className="text-xs text-muted-foreground">{call.participants.length} participant{call.participants.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleJoinCall(call.groupId, false)} className="w-8 h-8 rounded-full bg-secondary hover:bg-secondary/80 flex items-center justify-center text-foreground transition-transform hover:scale-105 active:scale-95">
                    <Phone className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleJoinCall(call.groupId, true)} className="w-8 h-8 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center text-white shadow-md transition-transform hover:scale-105 active:scale-95">
                    <Video className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setDismissedCalls(prev => {
                      const newSet = new Set(prev);
                      newSet.add(call.groupId);
                      return newSet;
                    })}
                    className="w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500 flex items-center justify-center text-red-500 hover:text-white transition-all ml-1 hover:scale-105 active:scale-95"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  }

  return (
    <GroupActiveCallUI 
      localStream={localStream}
      peers={peers}
      isLocalMuted={isLocalMuted}
      isLocalVideoOff={isLocalVideoOff}
      onToggleMute={toggleLocalMute}
      onToggleVideo={toggleLocalVideo}
      onEndCall={handleEndCall}
    />
  );
}
