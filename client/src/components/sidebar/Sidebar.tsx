"use client";

import { motion } from "framer-motion";

import { useEffect, useState } from "react";
import { useChatStore } from "@/store/useChatStore";
import { useAuthStore } from "@/store/useAuthStore";
import api from "@/services/api";
import { socket } from "@/services/socket";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Search, LogOut, MoreVertical, User as UserIcon, Users } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ProfileDialog from "@/components/profile/ProfileDialog";
import GroupCreateModal from "./GroupCreateModal";

export default function Sidebar() {
  const { conversations, fetchConversations, setActiveUser, setActiveConversation, activeConversation, updateUserOnlineStatus } = useChatStore();
  const { user, logout } = useAuthStore();
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [groupCreateOpen, setGroupCreateOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'groups'>('all');

  useEffect(() => {
    fetchConversations();

    const handleUserOnline = (userId: string) => {
      updateUserOnlineStatus(userId, 'online');
    };

    const handleUserOffline = (userId: string) => {
      updateUserOnlineStatus(userId, 'offline');
    };

    socket.on("user_online", handleUserOnline);
    socket.on("user_offline", handleUserOffline);

    return () => {
      socket.off("user_online", handleUserOnline);
      socket.off("user_offline", handleUserOffline);
    };
  }, [fetchConversations, updateUserOnlineStatus]);

  const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    if (!val.trim()) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const { data } = await api.get(`/users?search=${val}`);
      setSearchResults(data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSelectUser = (selectedUser: any) => {
    setActiveUser(selectedUser);
    
    // Check if conversation exists
    const existing = conversations.find(c => 
      !c.isGroup && c.participants?.some((p: any) => p._id === selectedUser._id)
    );
    
    if (existing) {
      setActiveConversation(existing);
    } else {
      setActiveConversation(null); // Will be created on first message
    }
    
    setSearch("");
    setIsSearching(false);
  };

  const handleSelectConversation = (conversation: any) => {
    setActiveConversation(conversation);
    if (!conversation.isGroup) {
      const otherUser = conversation.participants.find((p: any) => p._id !== user?._id);
      setActiveUser(otherUser);
    } else {
      setActiveUser(null);
    }
  };

  return (
    <>
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
      <GroupCreateModal open={groupCreateOpen} onOpenChange={setGroupCreateOpen} />
      
      <div className="w-80 h-full border-r border-glass-border bg-glass-surface backdrop-blur-xl flex flex-col relative z-20">
        <div className="p-4 border-b border-glass-border/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Avatar className="w-10 h-10">
                <AvatarImage src={user?.avatar || undefined} />
                <AvatarFallback>{(user?.username || user?.email || '?').charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm text-white">{user?.username || user?.email}</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-glow shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse"></span>
                  <p className="text-xs text-emerald-glow">Online</p>
                </div>
              </div>
            </div>
              <DropdownMenu>
                <DropdownMenuTrigger className={buttonVariants({ variant: "ghost", size: "icon" })}>
                  <MoreVertical className="w-5 h-5 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setProfileOpen(true)}>
                    <UserIcon className="w-4 h-4 mr-2" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setGroupCreateOpen(true)}>
                    <Users className="w-4 h-4 mr-2" />
                    New Group
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search users..."
              className="pl-9 bg-black/20 border-glass-border focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan text-white transition-all rounded-xl"
              value={search}
              onChange={handleSearch}
            />
          </div>

          {/* Filter Pills */}
          {!isSearching && (
            <div className="flex items-center gap-2 mt-4 px-1 overflow-x-auto scrollbar-hide">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-300 ${
                  filter === 'all' 
                    ? 'bg-neon-cyan/20 text-neon-cyan neon-box-glow border border-neon-cyan/30' 
                    : 'bg-black/20 text-muted-foreground hover:bg-white/5 border border-transparent'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-300 ${
                  filter === 'unread' 
                    ? 'bg-neon-purple/20 text-neon-purple neon-box-glow border border-neon-purple/30' 
                    : 'bg-black/20 text-muted-foreground hover:bg-white/5 border border-transparent'
                }`}
              >
                Unread
              </button>
              <button
                onClick={() => setFilter('groups')}
                className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-300 ${
                  filter === 'groups' 
                    ? 'bg-electric-blue/20 text-electric-blue neon-box-glow border border-electric-blue/30' 
                    : 'bg-black/20 text-muted-foreground hover:bg-white/5 border border-transparent'
                }`}
              >
                Groups
              </button>
            </div>
          )}
        </div>

        <ScrollArea className="flex-1">
          {isSearching ? (
            <div className="p-2">
              {searchResults.length > 0 ? (
                searchResults.map((u) => (
                  <motion.div
                    key={u._id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelectUser(u)}
                    className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-white/10"
                  >
                    <Avatar>
                      <AvatarImage src={u.avatar || undefined} />
                      <AvatarFallback>{(u.username || u.email || '?').charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{u.username || u.email}</p>
                      <p className="text-xs text-muted-foreground">{u.bio || 'Available'}</p>
                    </div>
                  </motion.div>
                ))
              ) : (
                <p className="text-center text-sm text-muted-foreground p-4">No users found</p>
              )}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {(() => {
                const filteredConversations = conversations.filter(conv => {
                  if (filter === 'unread') return (conv.unreadCount || 0) > 0;
                  if (filter === 'groups') return conv.isGroup;
                  return true;
                });

                if (filteredConversations.length === 0) {
                  return (
                    <div className="p-4 text-center mt-10">
                      <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center mx-auto mb-3">
                        <UserIcon className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <h3 className="font-medium text-sm mb-1">
                        {filter === 'unread' ? "No unread messages" : filter === 'groups' ? "No groups yet" : "No chats yet"}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {filter === 'all' ? "Search for a user above to start a conversation." : ""}
                      </p>
                    </div>
                  );
                }

                return filteredConversations.map((conv) => {
                  const isActive = activeConversation?._id === conv._id;

                  let displayName = "Unknown";
                  let displayAvatar = undefined;
                  let isOnline = false;

                  if (conv.isGroup) {
                    displayName = conv.name || "Group";
                    displayAvatar = conv.avatar;
                  } else {
                    const otherUser = conv.participants?.find((p: any) => p._id !== user?._id);
                    if (!otherUser) return null;
                    displayName = otherUser.username || otherUser.email;
                    displayAvatar = otherUser.avatar;
                    isOnline = otherUser.onlineStatus === 'online';
                  }

                  return (
                    <motion.div
                      key={conv._id}
                      onClick={() => handleSelectConversation(conv)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-300 border ${
                        isActive 
                          ? "bg-neon-cyan/10 border-neon-cyan/30 shadow-[0_0_15px_rgba(0,229,255,0.1)]" 
                          : "border-transparent hover:bg-white/5 hover:border-white/10"
                      }`}
                    >
                      <div className="relative">
                        <Avatar>
                          <AvatarImage src={displayAvatar || undefined} />
                          <AvatarFallback>
                            {conv.isGroup ? <Users className="w-4 h-4" /> : displayName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {isOnline && !conv.isGroup && (
                          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-glow border-2 border-[#0B1220] rounded-full shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse"></span>
                        )}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex justify-between items-baseline">
                          <p className={`font-medium text-sm truncate ${isActive ? 'text-neon-cyan' : 'text-white'}`}>{displayName}</p>
                          {(conv.unreadCount || 0) > 0 && (
                            <motion.span 
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="bg-neon-purple text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-2 shrink-0 min-w-[20px] text-center shadow-[0_0_10px_rgba(139,92,246,0.6)]"
                            >
                              {conv.unreadCount}
                            </motion.span>
                          )}
                        </div>
                        {conv.lastMessage && (
                          <p className={`text-xs truncate mt-0.5 ${isActive ? 'text-neon-cyan/70' : 'text-muted-foreground'}`}>
                            {conv.lastMessage.messageType !== 'text' ? (
                              <span className="italic flex items-center gap-1">
                                {conv.lastMessage.messageType}
                              </span>
                            ) : (
                              conv.lastMessage.message
                            )}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  );
                });
              })()}
            </div>
          )}
        </ScrollArea>
      </div>
    </>
  );
}
