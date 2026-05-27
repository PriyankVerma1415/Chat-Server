import { create } from 'zustand';

export interface PeerStream {
  userId: string;
  user: any; // user info (username, avatar, etc)
  stream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
}

interface GroupCallState {
  activeGroupId: string | null;
  isCallActive: boolean;
  localStream: MediaStream | null;
  isLocalMuted: boolean;
  isLocalVideoOff: boolean;
  peers: Map<string, PeerStream>;
  peerConnections: Map<string, RTCPeerConnection>;
  
  // Active Group Calls tracking (groupId -> participants array)
  activeGroupCallsList: { groupId: string; participants: any[] }[];

  joinCall: (groupId: string, localStream: MediaStream) => void;
  leaveCall: () => void;
  addPeer: (userId: string, user: any) => void;
  removePeer: (userId: string) => void;
  setPeerStream: (userId: string, stream: MediaStream) => void;
  setPeerConnection: (userId: string, pc: RTCPeerConnection) => void;
  toggleLocalMute: () => void;
  toggleLocalVideo: () => void;
  
  setActiveGroupCallsList: (calls: { groupId: string; participants: any[] }[]) => void;
  addGroupCall: (groupId: string, initiator: any) => void;
  removeGroupCall: (groupId: string) => void;
  updateGroupCallParticipants: (groupId: string, participants: any[]) => void;
}

export const useGroupCallStore = create<GroupCallState>((set, get) => ({
  activeGroupId: null,
  isCallActive: false,
  localStream: null,
  isLocalMuted: false,
  isLocalVideoOff: false,
  peers: new Map(),
  peerConnections: new Map(),
  
  activeGroupCallsList: [],

  joinCall: (groupId, localStream) => set({
    activeGroupId: groupId,
    isCallActive: true,
    localStream,
    peers: new Map(),
    peerConnections: new Map(),
  }),

  leaveCall: () => {
    const { localStream, peerConnections } = get();
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    peerConnections.forEach(pc => pc.close());

    set({
      activeGroupId: null,
      isCallActive: false,
      localStream: null,
      peers: new Map(),
      peerConnections: new Map(),
      isLocalMuted: false,
      isLocalVideoOff: false,
    });
  },

  addPeer: (userId, user) => set((state) => {
    const newPeers = new Map(state.peers);
    if (!newPeers.has(userId)) {
      newPeers.set(userId, {
        userId,
        user,
        stream: null,
        isMuted: false,
        isVideoOff: false,
      });
    }
    return { peers: newPeers };
  }),

  removePeer: (userId) => set((state) => {
    const newPeers = new Map(state.peers);
    newPeers.delete(userId);

    const newPCs = new Map(state.peerConnections);
    const pc = newPCs.get(userId);
    if (pc) {
      pc.close();
      newPCs.delete(userId);
    }

    return { peers: newPeers, peerConnections: newPCs };
  }),

  setPeerStream: (userId, stream) => set((state) => {
    const newPeers = new Map(state.peers);
    const peer = newPeers.get(userId);
    if (peer) {
      newPeers.set(userId, { ...peer, stream });
    }
    return { peers: newPeers };
  }),

  setPeerConnection: (userId, pc) => set((state) => {
    const newPCs = new Map(state.peerConnections);
    newPCs.set(userId, pc);
    return { peerConnections: newPCs };
  }),

  toggleLocalMute: () => set((state) => {
    if (state.localStream) {
      state.localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
    }
    return { isLocalMuted: !state.isLocalMuted };
  }),

  toggleLocalVideo: () => set((state) => {
    if (state.localStream) {
      state.localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
    }
    return { isLocalVideoOff: !state.isLocalVideoOff };
  }),
  
  setActiveGroupCallsList: (calls) => set({ activeGroupCallsList: calls }),
  
  addGroupCall: (groupId, initiator) => set((state) => {
    const exists = state.activeGroupCallsList.find(c => c.groupId === groupId);
    if (exists) return state;
    return {
      activeGroupCallsList: [...state.activeGroupCallsList, { groupId, participants: [initiator] }]
    };
  }),
  
  removeGroupCall: (groupId) => set((state) => ({
    activeGroupCallsList: state.activeGroupCallsList.filter(c => c.groupId !== groupId)
  })),
  
  updateGroupCallParticipants: (groupId, participants) => set((state) => ({
    activeGroupCallsList: state.activeGroupCallsList.map(c => 
      c.groupId === groupId ? { ...c, participants } : c
    )
  })),
}));
