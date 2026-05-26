import { create } from 'zustand';
import api from '../services/api';

interface Conversation {
  _id: string;
  participants: any[];
  lastMessage: any;
  updatedAt: string;
}

interface Message {
  _id: string;
  senderId: any;
  receiverId: any;
  message?: string;
  messageType?: 'text' | 'image' | 'video' | 'audio' | 'voice' | 'document';
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  duration?: number;
  thumbnailUrl?: string;
  isDeleted?: boolean;
  isEdited?: boolean;
  replyTo?: any;
  status: 'sent' | 'delivered' | 'read';
  createdAt: string;
}

interface ChatState {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  activeUser: any | null; // The user we are chatting with
  messages: Message[];
  editingMessage: Message | null;
  replyingToMessage: Message | null;
  setConversations: (conversations: Conversation[]) => void;
  setActiveConversation: (conversation: Conversation | null) => void;
  setActiveUser: (user: any | null) => void;
  setMessages: (messages: Message[]) => void;
  setEditingMessage: (message: Message | null) => void;
  setReplyingToMessage: (message: Message | null) => void;
  addMessage: (message: Message) => void;
  editMessageAction: (messageId: string, newText: string, receiverId: string) => Promise<void>;
  updateMessageContent: (updatedMessage: Message) => void;
  deleteMessage: (messageId: string, receiverId: string) => Promise<void>;
  clearChat: (conversationId: string, receiverId: string) => Promise<void>;
  removeMessage: (messageId: string) => void;
  updateMessageStatus: (messageId: string, status: 'sent' | 'delivered' | 'read') => void;
  markMessagesAsRead: (conversationId: string) => void;
  updateUserOnlineStatus: (userId: string, status: 'online' | 'offline') => void;
  fetchConversations: () => Promise<void>;
  fetchMessages: (userId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversation: null,
  activeUser: null,
  messages: [],
  editingMessage: null,
  replyingToMessage: null,
  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (activeConversation) => set({ activeConversation }),
  setActiveUser: (activeUser) => set({ activeUser }),
  setMessages: (messages) => set({ messages }),
  setEditingMessage: (editingMessage) => set({ editingMessage }),
  setReplyingToMessage: (replyingToMessage) => set({ replyingToMessage }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  
  editMessageAction: async (messageId, newText, receiverId) => {
    try {
      const { data } = await api.put(`/messages/${messageId}`, { newText });
      const { socket } = require('@/services/socket');
      socket.emit('edit_message', { message: data, receiverId });
      get().updateMessageContent(data);
    } catch (error: any) {
      console.error(error);
      alert(error.response?.data?.message || "Cannot edit this message.");
    }
  },

  updateMessageContent: (updatedMessage) => set((state) => ({
    messages: state.messages.map((m) => m._id === updatedMessage._id ? updatedMessage : m)
  })),

  deleteMessage: async (messageId, receiverId) => {
    try {
      await api.delete(`/messages/${messageId}`);
      // Using dynamic import of socket to avoid circular dependencies if any, 
      // or we can just let the component handle the emit. Let's do API here, emit in component, OR emit here:
      const { socket } = require('@/services/socket');
      socket.emit('delete_message', { messageId, receiverId });
      get().removeMessage(messageId);
    } catch (error) {
      console.error(error);
      alert("Cannot delete this message.");
    }
  },

  clearChat: async (conversationId, receiverId) => {
    try {
      await api.delete(`/messages/conversation/${conversationId}`);
      set({ messages: [] });
    } catch (error) {
      console.error(error);
      alert("Failed to clear chat.");
    }
  },

  removeMessage: (messageId) => set((state) => ({
    messages: state.messages.filter((m) => m._id !== messageId)
  })),

  updateMessageStatus: (messageId, status) => set((state) => ({
    messages: state.messages.map((m) => m._id === messageId ? { ...m, status } : m)
  })),

  markMessagesAsRead: (conversationId) => set((state) => ({
    messages: state.messages.map((m) => 
      m.status !== 'read' ? { ...m, status: 'read' } : m
    )
  })),

  updateUserOnlineStatus: (userId, status) => set((state) => ({
    conversations: state.conversations.map((conv) => ({
      ...conv,
      participants: conv.participants.map((p) => 
        p._id === userId ? { ...p, onlineStatus: status } : p
      )
    })),
    activeUser: state.activeUser?._id === userId 
      ? { ...state.activeUser, onlineStatus: status }
      : state.activeUser
  })),

  fetchConversations: async () => {
    try {
      const { data } = await api.get('/messages/conversations');
      set({ conversations: data });
    } catch (error) {
      console.error(error);
    }
  },

  fetchMessages: async (userId) => {
    try {
      const { data } = await api.get(`/messages/${userId}`);
      set({ messages: data });
    } catch (error) {
      console.error(error);
    }
  }
}));
