"use client";

import { useEffect, useState, useRef } from "react";
import { useChatStore } from "@/store/useChatStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useCallStore } from "@/store/useCallStore";
import { useGroupCallStore } from "@/store/useGroupCallStore";
import { socket } from "@/services/socket";
import api from "@/services/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, MoreVertical, Phone, Video, Plus, Smile, Mic, Image as ImageIcon, FileText, Square, X, Loader2, Trash, ChevronDown } from "lucide-react";
import MessageBubble from "./MessageBubble";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import imageCompression from "browser-image-compression";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import dynamic from 'next/dynamic';
import { format, isToday, isYesterday } from "date-fns";
import GroupInfoPanel from "./GroupInfoPanel";

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });

export default function ChatWindow() {
  const { 
    activeUser, activeConversation, messages, fetchMessages, 
    addMessage, setMessages, updateMessageStatus, markMessagesAsRead, 
    removeMessage, clearChat,
    editingMessage, replyingToMessage, setEditingMessage, setReplyingToMessage, editMessageAction
  } = useChatStore();
  const { user } = useAuthStore();
  const { setOutgoingCall } = useCallStore();
  const { activeGroupCallsList, joinCall, isCallActive: isGroupCallActive } = useGroupCallStore();
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [pendingFile, setPendingFile] = useState<{file: File, type: 'image' | 'video' | 'document', previewUrl: string} | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentGroupCall = activeGroupCallsList.find(c => c.groupId === activeConversation?._id);

  const handleJoinGroupCall = async (video: boolean) => {
    if (!activeConversation) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
      socket.emit("join_group_call", { groupId: activeConversation._id });
      joinCall(activeConversation._id, stream);
    } catch (err) {
      console.error(err);
      alert("Failed to access camera/microphone.");
    }
  };

  useEffect(() => {
    if (activeConversation?.isGroup) {
      fetchMessages(activeConversation._id);
      socket.emit("join_chat", activeConversation._id);
      socket.emit("mark_read", { groupId: activeConversation._id });
      markMessagesAsRead(activeConversation._id);
    } else if (activeUser) {
      fetchMessages(activeUser._id);
      socket.emit("join_chat", activeConversation?._id || activeUser._id);
      if (activeConversation) {
        socket.emit("mark_read", { conversationId: activeConversation._id, senderId: activeUser._id });
        markMessagesAsRead(activeConversation._id);
      }
    } else {
      setMessages([]);
    }
  }, [activeUser, activeConversation, fetchMessages, setMessages, markMessagesAsRead]);

  useEffect(() => {
    const messageHandler = (msg: any) => {
      // Always add the message to the store to update conversations list and unread count
      addMessage(msg);

      const isGroupMessage = !!msg.groupId;
      if (isGroupMessage && activeConversation?.isGroup && msg.groupId === activeConversation._id) {
        if (msg.senderId._id !== user?._id) {
          socket.emit("mark_read", { groupId: activeConversation._id });
        }
      } else if (!isGroupMessage && activeConversation && msg.conversationId === activeConversation._id) {
        socket.emit("mark_read", { conversationId: activeConversation._id, senderId: msg.senderId._id || msg.senderId });
      } else if (!isGroupMessage && !activeConversation && msg.senderId._id === activeUser?._id) {
        socket.emit("mark_read", { conversationId: msg.conversationId, senderId: msg.senderId._id || msg.senderId });
      } else if (!isGroupMessage) {
        socket.emit("mark_delivered", { messageId: msg._id, senderId: msg.senderId._id || msg.senderId });
      }
    };

    const statusHandler = ({ messageId, status }: { messageId: string, status: any }) => {
      updateMessageStatus(messageId, status);
    };

    const readHandler = ({ conversationId }: { conversationId: string }) => {
      if (activeConversation && activeConversation._id === conversationId && !activeConversation.isGroup) {
        markMessagesAsRead(conversationId);
      }
    };

    const groupReadHandler = ({ groupId, messageIds, user }: { groupId: string, messageIds: string[], user: any }) => {
      if (activeConversation?.isGroup && activeConversation._id === groupId) {
        useChatStore.getState().addGroupMessageSeenBy(messageIds, user);
      }
    };

    const deleteHandler = (messageId: string) => {
      removeMessage(messageId);
    };

    const clearChatHandler = (clearedConversationId: string) => {
      if (activeConversation && activeConversation._id === clearedConversationId) {
        setMessages([]);
      }
    };

    const editMessageHandler = (updatedMessage: any) => {
      useChatStore.getState().updateMessageContent(updatedMessage);
    };

    socket.on("message_received", messageHandler);
    socket.on("message_status_update", statusHandler);
    socket.on("messages_read", readHandler);
    socket.on("group_messages_read", groupReadHandler);
    socket.on("message_deleted", deleteHandler);
    socket.on("chat_cleared", clearChatHandler);
    socket.on("message_edited", editMessageHandler);
    socket.on("typing", () => setIsTyping(true));
    socket.on("stop_typing", () => setIsTyping(false));

    return () => {
      socket.off("message_received", messageHandler);
      socket.off("message_status_update", statusHandler);
      socket.off("messages_read", readHandler);
      socket.off("group_messages_read", groupReadHandler);
      socket.off("message_deleted", deleteHandler);
      socket.off("chat_cleared", clearChatHandler);
      socket.off("message_edited", editMessageHandler);
      socket.off("typing");
      socket.off("stop_typing");
      socket.off("group_typing");
      socket.off("stop_group_typing");
    };
  }, [activeConversation, activeUser, addMessage, updateMessageStatus, markMessagesAsRead, removeMessage]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleFileSelect = async (file: File, type: 'image' | 'video' | 'document') => {
    if (!activeUser && !activeConversation?.isGroup) return;
    
    // Check sizes
    const sizeMB = file.size / (1024 * 1024);
    if (type === 'image' && sizeMB > 5) return alert("Image must be < 5MB");
    if (type === 'video' && sizeMB > 25) return alert("Video must be < 25MB");
    if (type === 'document' && sizeMB > 15) return alert("Document must be < 15MB");

    let fileToUpload = file;
    if (type === 'image') {
      try {
        fileToUpload = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920 });
      } catch (e) {
        console.error("Compression error", e);
      }
    }

    const previewUrl = URL.createObjectURL(fileToUpload);
    setPendingFile({ file: fileToUpload, type, previewUrl });
  };

  const confirmFileUpload = () => {
    if (!pendingFile || (!activeUser && !activeConversation?.isGroup)) return;
    const { file, type } = pendingFile;

    setIsUploading(true);
    setUploadProgress(0);

    const folder = type === 'image' ? 'chat-images' : type === 'video' ? 'chat-videos' : 'documents';
    const storageRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => setUploadProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
      (error) => {
        console.error("Upload error", error);
        setIsUploading(false);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        setIsUploading(false);
        setUploadProgress(0);

        try {
          const payload: any = {
            mediaUrl: downloadURL,
            messageType: type,
            fileName: file.name,
            fileSize: file.size,
            message: newMessage,
            replyTo: replyingToMessage?._id
          };
          if (activeConversation?.isGroup) {
            payload.groupId = activeConversation._id;
          } else {
            payload.receiverId = activeUser?._id;
          }
          
          const { data } = await api.post("/messages", payload);
          addMessage(data);
          socket.emit("new_message", data);
          setPendingFile(null);
          setNewMessage("");
          setReplyingToMessage(null);
        } catch (error) {
          console.error(error);
        }
      }
    );
  };

  const cancelFileUpload = () => {
    if (pendingFile) {
      URL.revokeObjectURL(pendingFile.previewUrl);
      setPendingFile(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
      if (videoInputRef.current) videoInputRef.current.value = "";
      if (documentInputRef.current) documentInputRef.current.value = "";
    }
  };

  const uploadAudio = (blob: Blob) => {
    if (!activeUser && !activeConversation?.isGroup) return;
    setIsUploading(true);
    setUploadProgress(0);
    const duration = recordingDuration;

    const storageRef = ref(storage, `voice-notes/${Date.now()}.webm`);
    const uploadTask = uploadBytesResumable(storageRef, blob);

    uploadTask.on(
      "state_changed",
      (snapshot) => setUploadProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
      (error) => {
        console.error("Audio upload error", error);
        setIsUploading(false);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        setIsUploading(false);
        setUploadProgress(0);

        try {
          const payload: any = {
            message: "",
            messageType: "voice",
            mediaUrl: downloadURL,
            fileSize: blob.size,
            duration: duration,
            replyTo: replyingToMessage?._id
          };
          if (activeConversation?.isGroup) {
            payload.groupId = activeConversation._id;
          } else {
            payload.receiverId = activeUser?._id;
          }

          const { data } = await api.post("/messages", payload);
          addMessage(data);
          socket.emit("new_message", data);
          setReplyingToMessage(null);
        } catch (error) {
          console.error(error);
        }
      }
    );
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        uploadAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
      
    } catch (err) {
      console.error("Microphone permission denied", err);
      alert("Microphone access is required for voice notes.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = null; // Prevent upload trigger
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || (!activeUser && !activeConversation?.isGroup)) return;

    if (editingMessage) {
      const textToEdit = newMessage;
      setNewMessage("");
      await editMessageAction(editingMessage._id, textToEdit, activeUser?._id, activeConversation?.isGroup ? activeConversation._id : undefined);
      setEditingMessage(null);
      return;
    }

    const messageData: any = {
      message: newMessage,
      messageType: "text",
      replyTo: replyingToMessage?._id
    };
    
    if (activeConversation?.isGroup) {
      messageData.groupId = activeConversation._id;
    } else {
      messageData.receiverId = activeUser?._id;
    }

    setNewMessage("");
    setReplyingToMessage(null);
    setIsTyping(false);
    
    try {
      const { data } = await api.post("/messages", messageData);
      addMessage(data);
      socket.emit("new_message", data);
    } catch (error) {
      console.error(error);
    }
  };

  const typingHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
  };

  const formatLastSeen = (dateString?: string) => {
    if (!dateString) return "Offline";
    const date = new Date(dateString);
    if (isToday(date)) {
      return `last seen today at ${format(date, "HH:mm")}`;
    } else if (isYesterday(date)) {
      return `last seen yesterday at ${format(date, "HH:mm")}`;
    } else {
      return `last seen ${format(date, "dd/MM/yyyy")}`;
    }
  };

  if (!activeUser && !activeConversation?.isGroup) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background/50">
        <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mb-4">
          <Send className="w-8 h-8 text-muted-foreground ml-1" />
        </div>
        <h2 className="text-xl font-medium text-foreground">Your Messages</h2>
        <p className="text-muted-foreground mt-2">Select a conversation or search for a user to start chatting.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#070B14] h-full relative overflow-hidden">
      {/* Cyber neon ambient background */}
      <div className="absolute inset-0 z-0 bg-[url('/cyber-grid.svg')] opacity-5 bg-repeat bg-size-[32px_32px] pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 w-[50%] h-[50%] bg-neon-cyan/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[50%] h-[50%] bg-neon-purple/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="h-16 border-b border-glass-border flex items-center justify-between px-6 bg-glass-surface backdrop-blur-xl z-10">
        <Dialog>
          <DialogTrigger className="flex items-center gap-3 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 p-2 rounded-md transition-colors -ml-2 select-none outline-none border-none bg-transparent text-left">
            <Avatar>
              <AvatarImage src={(activeConversation?.isGroup ? activeConversation.avatar : activeUser?.avatar) || undefined} />
              <AvatarFallback>{(activeConversation?.isGroup ? activeConversation.name : (activeUser?.username || activeUser?.email || '?')).charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
              <div className="text-left">
                <h3 className="font-semibold text-sm">{activeConversation?.isGroup ? activeConversation.name : (activeUser?.username || activeUser?.email)}</h3>
                <p className="text-xs text-muted-foreground">
                  {isTyping ? "typing..." : activeConversation?.isGroup ? `${activeConversation.members?.length || 0} participants` : (activeUser?.onlineStatus === "online" ? "Online" : formatLastSeen(activeUser?.lastSeen))}
                </p>
              </div>
          </DialogTrigger>
          <DialogContent className={`sm:max-w-md ${activeConversation?.isGroup ? 'p-0 sm:max-w-[400px] h-[80vh]' : ''}`}>
            {activeConversation?.isGroup ? (
              <GroupInfoPanel group={activeConversation} />
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Contact Info</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col items-center gap-4 py-6">
                  <Avatar className="w-32 h-32">
                    <AvatarImage src={activeUser?.avatar || undefined} />
                    <AvatarFallback className="text-5xl">{(activeUser?.username || activeUser?.email || '?').charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="text-center">
                    <h2 className="text-2xl font-semibold">{activeUser?.username || activeUser?.email}</h2>
                    <p className="text-muted-foreground">{activeUser?.phoneNumber}</p>
                  </div>
                </div>
                
                <div className="bg-secondary/50 rounded-lg p-4 space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-1">About</h4>
                    <p>{activeUser?.bio || "Hey there! I am using NexChat."}</p>
                  </div>
                  
                  {activeUser?.email && (
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground mb-1">Email</h4>
                      <p>{activeUser?.email}</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
        <div className="flex items-center gap-2 text-muted-foreground">
          {activeConversation?.isGroup && currentGroupCall && !isGroupCallActive && (
             <Button onClick={() => handleJoinGroupCall(true)} className="mr-2 bg-green-500 hover:bg-green-600 text-white animate-pulse" size="sm">
               Join Call
             </Button>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              if (activeConversation?.isGroup) {
                handleJoinGroupCall(false);
              } else if (activeUser) {
                setOutgoingCall({
                  _id: activeUser._id,
                  username: activeUser.username,
                  avatar: activeUser.avatar,
                  email: activeUser.email
                }, 'audio');
              }
            }}
          >
            <Phone className="w-5 h-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => {
              if (activeConversation?.isGroup) {
                handleJoinGroupCall(true);
              } else if (activeUser) {
                setOutgoingCall({
                  _id: activeUser._id,
                  username: activeUser.username,
                  avatar: activeUser.avatar,
                  email: activeUser.email
                }, 'video');
              }
            }}
          >
            <Video className="w-5 h-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 w-10 text-muted-foreground outline-none">
              <MoreVertical className="w-5 h-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => {
                  if (window.confirm("Are you sure you want to clear this chat? This will delete all messages for you.")) {
                    if (activeConversation) {
                      clearChat(activeConversation._id, activeUser?._id, activeConversation.isGroup);
                    }
                  }
                }} 
                className="text-red-500 focus:text-red-600 focus:bg-red-500/10 cursor-pointer gap-2"
                disabled={!activeConversation}
              >
                <Trash className="w-4 h-4" />
                Clear Chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative z-10">
        <ScrollArea 
          className="h-full p-6"
          onScrollCapture={(e) => {
            const target = e.target as HTMLDivElement;
            const isScrolledUp = target.scrollHeight - target.scrollTop - target.clientHeight > 150;
            setShowScrollButton(isScrolledUp);
          }}
        >
          <div className="flex flex-col justify-end min-h-full">
            {messages.map((msg, idx) => (
              <MessageBubble
                key={msg._id || idx}
                message={msg}
                isOwn={msg.senderId._id === user?._id || msg.senderId === user?._id}
                isGroup={activeConversation?.isGroup}
              />
            ))}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>
      </div>

      {showScrollButton && (
        <Button
          onClick={() => {
            if (scrollRef.current) {
              scrollRef.current.scrollIntoView({ behavior: "smooth" });
            }
          }}
          className="absolute bottom-24 right-6 rounded-full w-10 h-10 shadow-[0_0_15px_rgba(0,229,255,0.3)] bg-glass-surface backdrop-blur-md text-neon-cyan hover:bg-white/10 z-50 p-0 flex items-center justify-center border border-neon-cyan/30"
        >
          <ChevronDown className="w-6 h-6" />
        </Button>
      )}

      <div className="p-4 bg-glass-surface backdrop-blur-xl border-t border-glass-border z-10 relative">
        {replyingToMessage && (
          <div className="max-w-4xl mx-auto mb-2 p-2 bg-secondary/50 rounded-lg flex items-center justify-between border-l-4 border-primary">
            <div className="flex flex-col overflow-hidden">
              <span className="text-xs font-semibold text-primary">Replying to {replyingToMessage.senderId?._id === activeUser?._id ? activeUser?.username : 'yourself'}</span>
              <span className="text-xs text-muted-foreground truncate">{replyingToMessage.message || 'Media'}</span>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => setReplyingToMessage(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
        {editingMessage && (
          <div className="max-w-4xl mx-auto mb-2 p-2 bg-secondary/50 rounded-lg flex items-center justify-between border-l-4 border-blue-500">
            <div className="flex flex-col overflow-hidden">
              <span className="text-xs font-semibold text-blue-500">Editing Message</span>
              <span className="text-xs text-muted-foreground truncate">{editingMessage.message}</span>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => setEditingMessage(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
        <input 
          type="file" 
          ref={imageInputRef} 
          hidden 
          accept="image/*" 
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file, 'image');
          }} 
        />
        <input 
          type="file" 
          ref={videoInputRef} 
          hidden 
          accept="video/*" 
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file, 'video');
          }} 
        />
        <input 
          type="file" 
          ref={documentInputRef} 
          hidden 
          accept=".pdf,.doc,.docx,.txt" 
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file, 'document');
          }} 
        />
        
        {isUploading && !pendingFile && (
          <div className="max-w-4xl mx-auto mb-2 text-xs text-muted-foreground flex items-center justify-between px-2">
            <span className="flex items-center"><Loader2 className="w-3 h-3 animate-spin mr-2" /> Uploading media...</span>
            <span>{uploadProgress}%</span>
          </div>
        )}

        <form onSubmit={handleSend} className="max-w-4xl mx-auto flex items-center bg-black/40 border border-glass-border rounded-2xl px-3 py-2 focus-within:border-neon-cyan focus-within:ring-1 focus-within:ring-neon-cyan transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)]">
          {!isRecording && (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-transparent shrink-0 rounded-full h-10 w-10 outline-none">
                <Plus className="w-6 h-6" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={10}>
                <DropdownMenuItem onClick={() => imageInputRef.current?.click()} className="gap-2 cursor-pointer">
                  <ImageIcon className="w-4 h-4 text-blue-500" />
                  <span>Image</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => videoInputRef.current?.click()} className="gap-2 cursor-pointer">
                  <Video className="w-4 h-4 text-rose-500" />
                  <span>Video</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => documentInputRef.current?.click()} className="gap-2 cursor-pointer">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  <span>Document</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {!isRecording && !pendingFile && (
            <div className="relative" ref={emojiPickerRef}>
              <Button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground hover:bg-transparent shrink-0 rounded-full h-10 w-10 mr-1">
                <Smile className={showEmojiPicker ? "w-5 h-5 text-primary" : "w-5 h-5"} />
              </Button>
              {showEmojiPicker && (
                <div className="absolute bottom-12 left-0 z-50">
                  <EmojiPicker 
                    theme={"dark" as any} 
                    onEmojiClick={(emojiData) => {
                      setNewMessage((prev) => prev + emojiData.emoji);
                    }} 
                  />
                </div>
              )}
            </div>
          )}
          
          {pendingFile ? (
            <div className="flex-1 flex items-center gap-3 px-2 h-10 overflow-hidden">
              {pendingFile.type === 'image' && (
                <img src={pendingFile.previewUrl} alt="preview" className="h-8 w-8 object-cover rounded" />
              )}
              {pendingFile.type === 'video' && (
                <Video className="h-6 w-6 text-rose-500 shrink-0" />
              )}
              {pendingFile.type === 'document' && (
                <FileText className="h-6 w-6 text-indigo-500 shrink-0" />
              )}
              <span className="text-[13px] text-muted-foreground truncate">{pendingFile.file.name}</span>
            </div>
          ) : isRecording ? (
            <div className="flex-1 flex items-center gap-3 px-2 h-10">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[15px] font-medium animate-pulse">{formatDuration(recordingDuration)}</span>
              <span className="text-[13px] text-muted-foreground ml-2">Recording voice note...</span>
            </div>
          ) : (
            <input
              value={newMessage}
              onChange={typingHandler}
              placeholder="Type a message"
              className="flex-1 bg-transparent border-none outline-none focus:ring-0 px-3 h-10 text-[15px] placeholder:text-muted-foreground/70 text-white"
            />
          )}
          
          {pendingFile ? (
            <>
              <Button type="button" onClick={cancelFileUpload} variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground hover:bg-transparent shrink-0 rounded-full h-10 w-10">
                <X className="w-5 h-5" />
              </Button>
              <Button type="button" onClick={confirmFileUpload} variant="ghost" size="icon" className="text-blue-500 hover:text-blue-600 hover:bg-blue-500/10 shrink-0 rounded-full h-10 w-10 ml-1">
                <Send className="w-5 h-5 fill-current" />
              </Button>
            </>
          ) : newMessage.trim() && !isRecording ? (
            <Button type="submit" size="icon" className="cyber-gradient hover:opacity-90 neon-box-glow text-[#070B14] shrink-0 rounded-xl h-10 w-10 ml-2 transition-all">
              <Send className="w-5 h-5 ml-0.5" />
            </Button>
          ) : isRecording ? (
            <>
              <Button type="button" onClick={cancelRecording} variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground hover:bg-transparent shrink-0 rounded-full h-10 w-10">
                <X className="w-5 h-5" />
              </Button>
              <Button type="button" onClick={stopRecording} variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-500/10 shrink-0 rounded-full h-10 w-10 ml-1">
                <Send className="w-5 h-5 fill-current" />
              </Button>
            </>
          ) : (
            <Button type="button" onClick={startRecording} variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground hover:bg-transparent shrink-0 rounded-full h-10 w-10 ml-1">
              <Mic className="w-5 h-5" />
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
