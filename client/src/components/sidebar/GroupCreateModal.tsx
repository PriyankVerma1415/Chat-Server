"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useChatStore } from "@/store/useChatStore";
import { Users, X } from "lucide-react";
import api from "@/services/api";

export default function GroupCreateModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { createGroup } = useChatStore();

  const handleSearch = async (val: string) => {
    setSearch(val);
    if (!val.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const { data } = await api.get(`/users?search=${val}`);
      setSearchResults(data);
    } catch (error) {
      console.error(error);
    }
  };

  const toggleUser = (user: any) => {
    if (selectedUsers.some(u => u._id === user._id)) {
      setSelectedUsers(selectedUsers.filter(u => u._id !== user._id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || selectedUsers.length === 0) return;
    setIsLoading(true);
    try {
      await createGroup({
        name,
        memberIds: selectedUsers.map(u => u._id),
      });
      onOpenChange(false);
      setName("");
      setSelectedUsers([]);
      setSearch("");
      setSearchResults([]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Create New Group
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Group Name</label>
            <Input 
              placeholder="e.g. Project Team" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-secondary/50 border-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Add Members</label>
            <Input 
              placeholder="Search users..." 
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="bg-secondary/50 border-none mb-3"
            />

            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {selectedUsers.map(u => (
                  <div key={u._id} className="flex items-center gap-1 bg-primary/20 text-primary px-2 py-1 rounded-full text-xs">
                    <span>{u.username || u.email}</span>
                    <button onClick={() => toggleUser(u)} className="hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
              {searchResults.map(u => {
                const isSelected = selectedUsers.some(su => su._id === u._id);
                return (
                  <div 
                    key={u._id} 
                    onClick={() => toggleUser(u)}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-primary/10' : 'hover:bg-secondary/50'}`}
                  >
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={u.avatar} />
                      <AvatarFallback>{(u.username || u.email || '?').charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{u.username || u.email}</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'}`}>
                      {isSelected && <div className="w-2 h-2 bg-background rounded-full" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={handleCreate} 
            disabled={!name.trim() || selectedUsers.length === 0 || isLoading}
          >
            {isLoading ? "Creating..." : "Create Group"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
