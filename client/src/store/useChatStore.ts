import { create } from 'zustand';
import api from '../services/api';
import { useAuthStore } from './useAuthStore';

interface Conversation {
  _id: string;
  participants?: any[]; // For 1v1
  members?: any[]; // For Groups
  isGroup?: boolean;
  name?: string;
  avatar?: string;
  description?: string;
  createdBy?: string;
  lastMessage: any;
  unreadCount?: number;
  updatedAt: string;
}

interface Message {
  _id: string;
  senderId: any;
  receiverId?: any;
  groupId?: string;
  conversationId?: string;
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
  seenBy?: any[];
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
  createGroup: (groupData: any) => Promise<any>;
  editMessageAction: (messageId: string, newText: string, receiverId?: string, groupId?: string) => Promise<void>;
  updateMessageContent: (updatedMessage: Message) => void;
  deleteMessage: (messageId: string, receiverId?: string, groupId?: string) => Promise<void>;
  clearChat: (conversationId: string, receiverId?: string, isGroup?: boolean) => Promise<void>;
  removeMessage: (messageId: string) => void;
  updateMessageStatus: (messageId: string, status: 'sent' | 'delivered' | 'read') => void;
  markMessagesAsRead: (conversationId: string) => void;
  addGroupMessageSeenBy: (messageIds: string[], user: any) => void;
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
  addMessage: (message) => set((state) => {
    // Also update lastMessage in the corresponding conversation/group
    const chatId = message.groupId || message.conversationId;
    const isActive = state.activeConversation?._id === chatId;
    const myUserId = useAuthStore.getState().user?._id;
    const isFromMe = message.senderId === myUserId || message.senderId?._id === myUserId;
    
    // Sort conversations if lastMessage changes
    const updatedConversations = state.conversations.map(c => {
      if (c._id === chatId) {
        const unreadCount = (!isActive && !isFromMe) ? (c.unreadCount || 0) + 1 : (c.unreadCount || 0);
        return { ...c, lastMessage: message, updatedAt: message.createdAt, unreadCount };
      }
      return c;
    }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return { 
      messages: isActive ? [...state.messages, message] : state.messages,
      conversations: updatedConversations
    };
  }),

  createGroup: async (groupData) => {
    try {
      const { data } = await api.post('/groups/create', groupData);
      const newGroup = { ...data, isGroup: true };
      set((state) => ({ conversations: [newGroup, ...state.conversations] }));
      
      const { socket } = require('@/services/socket');
      socket.emit('setup', get().activeUser); // Re-run setup to join new room
      return newGroup;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  
  editMessageAction: async (messageId, newText, receiverId, groupId) => {
    try {
      const { data } = await api.put(`/messages/${messageId}`, { newText });
      const { socket } = require('@/services/socket');
      if (groupId) {
        socket.emit('edit_message', { message: data, groupId });
      } else {
        socket.emit('edit_message', { message: data, receiverId });
      }
      get().updateMessageContent(data);
    } catch (error: any) {
      console.error(error);
      alert(error.response?.data?.message || "Cannot edit this message.");
    }
  },

  updateMessageContent: (updatedMessage) => set((state) => ({
    messages: state.messages.map((m) => m._id === updatedMessage._id ? updatedMessage : m),
    conversations: state.conversations.map(c => 
      c.lastMessage?._id === updatedMessage._id 
        ? { ...c, lastMessage: updatedMessage }
        : c
    )
  })),

  deleteMessage: async (messageId, receiverId, groupId) => {
    try {
      await api.delete(`/messages/${messageId}`);
      const { socket } = require('@/services/socket');
      if (groupId) {
        socket.emit('delete_message', { messageId, groupId });
      } else {
        socket.emit('delete_message', { messageId, receiverId });
      }
      get().removeMessage(messageId);
    } catch (error) {
      console.error(error);
      alert("Cannot delete this message.");
    }
  },

  clearChat: async (conversationId, receiverId, isGroup) => {
    try {
      if (isGroup) {
        // Just clear frontend for now, or implement leave group
        set({ messages: [] });
      } else {
        await api.delete(`/messages/conversation/${conversationId}`);
        set({ messages: [] });
      }
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
    ),
    conversations: state.conversations.map(c => 
      c._id === conversationId ? { ...c, unreadCount: 0 } : c
    )
  })),

  addGroupMessageSeenBy: (messageIds, user) => set((state) => ({
    messages: state.messages.map((m) => {
      if (messageIds.includes(m._id)) {
        const seenBy = m.seenBy || [];
        if (!seenBy.some(u => u._id === user._id)) {
          return { ...m, seenBy: [...seenBy, user] };
        }
      }
      return m;
    })
  })),

  updateUserOnlineStatus: (userId, status) => set((state) => ({
    conversations: state.conversations.map((conv) => ({
      ...conv,
      participants: conv.participants?.map((p) => 
        p._id === userId ? { ...p, onlineStatus: status } : p
      )
    })),
    activeUser: state.activeUser?._id === userId 
      ? { ...state.activeUser, onlineStatus: status }
      : state.activeUser
  })),

  fetchConversations: async () => {
    try {
      const [convRes, groupRes] = await Promise.all([
        api.get('/messages/conversations'),
        api.get('/groups')
      ]);
      
      const convs = convRes.data.map((c: any) => ({ ...c, isGroup: false }));
      const groups = groupRes.data.map((g: any) => ({ ...g, isGroup: true }));
      
      const merged = [...convs, ...groups].sort((a, b) => {
        const dateA = new Date(a.updatedAt).getTime();
        const dateB = new Date(b.updatedAt).getTime();
        return dateB - dateA;
      });
      
      set({ conversations: merged });
    } catch (error) {
      console.error(error);
    }
  },

  fetchMessages: async (id) => {
    try {
      const state = get();
      const isGroup = state.activeConversation?.isGroup;
      
      const url = isGroup ? `/groups/${id}/messages` : `/messages/${id}`;
      const { data } = await api.get(url);
      set({ messages: data });
    } catch (error) {
      console.error(error);
    }
  }
}));
