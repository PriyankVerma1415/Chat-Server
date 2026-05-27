"use client";

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
      
      <div className="w-80 h-full border-r bg-card flex flex-col">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Avatar className="w-10 h-10">
                <AvatarImage src={user?.avatar || undefined} />
                <AvatarFallback>{(user?.username || user?.phoneNumber || '?').charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">{user?.username || user?.phoneNumber}</p>
                <p className="text-xs text-green-500">Online</p>
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
              className="pl-9 bg-secondary/50"
              value={search}
              onChange={handleSearch}
            />
          </div>

          {/* Filter Pills */}
          {!isSearching && (
            <div className="flex items-center gap-2 mt-4 px-1 overflow-x-auto scrollbar-hide">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${
                  filter === 'all' 
                    ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30' 
                    : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${
                  filter === 'unread' 
                    ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30' 
                    : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                }`}
              >
                Unread
              </button>
              <button
                onClick={() => setFilter('groups')}
                className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${
                  filter === 'groups' 
                    ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30' 
                    : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
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
                  <div
                    key={u._id}
                    onClick={() => handleSelectUser(u)}
                    className="flex items-center gap-3 p-3 hover:bg-secondary/50 rounded-lg cursor-pointer transition-colors"
                  >
                    <Avatar>
                      <AvatarImage src={u.avatar || undefined} />
                      <AvatarFallback>{(u.username || u.phoneNumber || '?').charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{u.username || u.phoneNumber}</p>
                      <p className="text-xs text-muted-foreground">{u.bio || 'Available'}</p>
                    </div>
                  </div>
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
                    displayName = otherUser.username || otherUser.phoneNumber;
                    displayAvatar = otherUser.avatar;
                    isOnline = otherUser.onlineStatus === 'online';
                  }

                  return (
                    <div
                      key={conv._id}
                      onClick={() => handleSelectConversation(conv)}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        isActive ? "bg-primary/10" : "hover:bg-secondary/50"
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
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full"></span>
                        )}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex justify-between items-baseline">
                          <p className="font-medium text-sm truncate">{displayName}</p>
                          {(conv.unreadCount || 0) > 0 && (
                            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-2 shrink-0 min-w-[20px] text-center">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                        {conv.lastMessage && (
                          <p className="text-xs text-muted-foreground truncate">
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
                    </div>
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
