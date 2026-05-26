"use client";

import { useEffect, useState } from "react";
import { useChatStore } from "@/store/useChatStore";
import { useAuthStore } from "@/store/useAuthStore";
import api from "@/services/api";
import { socket } from "@/services/socket";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Search, LogOut, MoreVertical, User as UserIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ProfileDialog from "@/components/profile/ProfileDialog";

export default function Sidebar() {
  const { conversations, fetchConversations, setActiveUser, setActiveConversation, activeConversation, updateUserOnlineStatus } = useChatStore();
  const { user, logout } = useAuthStore();
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

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
      c.participants.some(p => p._id === selectedUser._id)
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
    const otherUser = conversation.participants.find((p: any) => p._id !== user?._id);
    setActiveUser(otherUser);
  };

  return (
    <>
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
      
      <div className="w-80 h-full border-r bg-card flex flex-col">
        <div className="p-4 border-b">
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
              {conversations.length === 0 ? (
                <div className="p-4 text-center mt-10">
                  <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center mx-auto mb-3">
                    <UserIcon className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium text-sm mb-1">No chats yet</h3>
                  <p className="text-xs text-muted-foreground">Search for a user above to start a conversation.</p>
                </div>
              ) : (
                conversations.map((conv) => {
                  const otherUser = conv.participants.find((p: any) => p._id !== user?._id);
                  if (!otherUser) return null;
                  
                  const isActive = activeConversation?._id === conv._id;

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
                          <AvatarImage src={otherUser.avatar || undefined} />
                          <AvatarFallback>{(otherUser.username || otherUser.phoneNumber || '?').charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        {otherUser.onlineStatus === 'online' && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-background rounded-full"></span>
                        )}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex justify-between items-baseline">
                          <p className="font-medium text-sm truncate">{otherUser.username || otherUser.phoneNumber}</p>
                        </div>
                        {conv.lastMessage && (
                          <p className="text-xs text-muted-foreground truncate">
                            {conv.lastMessage.message}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </ScrollArea>
      </div>
    </>
  );
}
