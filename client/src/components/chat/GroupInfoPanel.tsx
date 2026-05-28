"use client";

import { useState, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/useAuthStore";
import { useChatStore } from "@/store/useChatStore";
import api from "@/services/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Shield, UserMinus, Loader2 } from "lucide-react";

export default function GroupInfoPanel({ group }: { group: any }) {
  const { user } = useAuthStore();
  const { fetchConversations, setActiveConversation } = useChatStore();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const currentUserRole = group.members?.find((m: any) => m.user._id === user?._id)?.role;
  const isAdmin = currentUserRole === 'admin';

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Image is too large. Please select an image under 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        setIsUploading(true);
        const base64Avatar = reader.result as string;
        await api.put(`/groups/${group._id}`, { avatar: base64Avatar });
        // Update local state immediately
        setActiveConversation({ ...group, avatar: base64Avatar });
        fetchConversations();
      } catch (error) {
        console.error("Failed to update group avatar", error);
        alert("Failed to update group photo");
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAction = async (action: string, memberId: string) => {
    try {
      await api.post(`/groups/${group._id}/${action}`, { userId: memberId });
      // Refresh to update members
      fetchConversations();
    } catch (error) {
      console.error(error);
      alert("Failed to perform action");
    }
  };

  const leaveGroup = async () => {
    if (!window.confirm("Are you sure you want to leave this group?")) return;
    try {
      await api.post(`/groups/${group._id}/remove-member`, { userId: user?._id });
      setActiveConversation(null);
      fetchConversations();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-card/50 overflow-y-auto">
      <div className="flex flex-col items-center gap-4 py-8 border-b border-border/50">
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleAvatarChange}
          className="hidden"
        />
        <div 
          className={`relative ${isAdmin ? 'cursor-pointer group' : ''}`}
          onClick={() => isAdmin && !isUploading && fileInputRef.current?.click()}
        >
          <Avatar className={`w-32 h-32 ${isAdmin ? 'transition-opacity group-hover:opacity-80' : ''}`}>
            <AvatarImage src={group.avatar || undefined} />
            <AvatarFallback className="text-5xl">{group.name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          {isAdmin && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 rounded-full transition-opacity">
              {isUploading ? (
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              ) : (
                <span className="text-sm text-white font-medium">Change</span>
              )}
            </div>
          )}
        </div>
        <div className="text-center px-4">
          <h2 className="text-2xl font-semibold">{group.name}</h2>
          <p className="text-muted-foreground mt-2">{group.members?.length} participants</p>
        </div>
      </div>
      
      {group.description && (
        <div className="p-4 border-b border-border/50">
          <h4 className="text-xs font-medium text-primary uppercase tracking-wider mb-2">Description</h4>
          <p className="text-sm text-foreground/80">{group.description}</p>
        </div>
      )}

      <div className="p-4 flex-1">
        <h4 className="text-xs font-medium text-primary uppercase tracking-wider mb-4">Members</h4>
        <div className="space-y-4">
          {group.members?.map((member: any) => (
            <div key={member.user._id} className="flex items-center gap-3">
              <Avatar className="w-10 h-10">
                <AvatarImage src={member.user.avatar || undefined} />
                <AvatarFallback>{(member.user.username || member.user.email || '?').charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-medium truncate">
                    {member.user._id === user?._id ? "You" : member.user.username || member.user.email}
                  </p>
                  {member.role === 'admin' && (
                    <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full border border-primary/20 flex items-center gap-1">
                      <Shield className="w-3 h-3" /> Admin
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{member.user.bio || 'Hey there! I am using NexChat.'}</p>
              </div>
              
              {isAdmin && member.user._id !== user?._id && (
                <DropdownMenu>
                  <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8 text-muted-foreground outline-none">
                    <MoreVertical className="w-4 h-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {member.role === 'admin' ? (
                      <DropdownMenuItem onClick={() => handleAction('demote-admin', member.user._id)}>
                        Dismiss as Admin
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => handleAction('promote-admin', member.user._id)}>
                        Make Group Admin
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem 
                      onClick={() => handleAction('remove-member', member.user._id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <UserMinus className="w-4 h-4 mr-2" />
                      Remove from Group
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-border/50">
        <Button variant="destructive" className="w-full" onClick={leaveGroup}>
          Leave Group
        </Button>
      </div>
    </div>
  );
}
