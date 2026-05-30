import { create } from 'zustand';

export interface CallerInfo {
  _id: string;
  username: string;
  email?: string;
  avatar?: string;
}

interface CallStore {
  // Incoming Call State
  isReceivingCall: boolean;
  caller: CallerInfo | null;
  callerSignal: any;
  incomingCallType: 'audio' | 'video' | null;

  // Outgoing Call State
  isCalling: boolean;
  callee: CallerInfo | null;
  outgoingCallType: 'audio' | 'video' | null;

  // Active Call State
  isCallActive: boolean;

  // Actions
  setIncomingCall: (caller: CallerInfo, signal: any, type: 'audio' | 'video') => void;
  setOutgoingCall: (callee: CallerInfo, type: 'audio' | 'video') => void;
  acceptCall: () => void;
  endCall: () => void;
  clearCall: () => void;
}

export const useCallStore = create<CallStore>((set) => ({
  isReceivingCall: false,
  caller: null,
  callerSignal: null,
  incomingCallType: null,

  isCalling: false,
  callee: null,
  outgoingCallType: null,

  isCallActive: false,

  setIncomingCall: (caller, signal, type) => set({
    isReceivingCall: true,
    caller,
    callerSignal: signal,
    incomingCallType: type
  }),

  setOutgoingCall: (callee, type) => set({
    isCalling: true,
    callee,
    outgoingCallType: type
  }),

  acceptCall: () => set({
    isReceivingCall: false,
    isCalling: false,
    isCallActive: true
  }),

  endCall: () => set({
    isCallActive: false
  }),

  clearCall: () => set({
    isReceivingCall: false,
    caller: null,
    callerSignal: null,
    incomingCallType: null,
    isCalling: false,
    callee: null,
    outgoingCallType: null,
    isCallActive: false
  })
}));
