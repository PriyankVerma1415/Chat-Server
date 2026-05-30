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
      <DialogContent className="glass-panel sm:max-w-md sm:rounded-3xl border-neon-cyan/30 shadow-[0_0_30px_rgba(0,229,255,0.15)]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2 font-heading text-white">
            <Users className="w-5 h-5 text-neon-cyan" />
            Create New Group
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="text-xs font-medium text-neon-cyan uppercase tracking-wider mb-2 block">Group Name</label>
            <Input 
              placeholder="e.g. Project Team" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-12 bg-black/20 border-glass-border focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan text-white rounded-xl transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-neon-cyan uppercase tracking-wider mb-2 block mt-2">Add Members</label>
            <Input 
              placeholder="Search users..." 
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full h-12 bg-black/20 border-glass-border focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan text-white rounded-xl transition-all mb-4"
            />

            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {selectedUsers.map(u => (
                  <div key={u._id} className="flex items-center gap-1 bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 px-3 py-1.5 rounded-full text-xs shadow-[0_0_10px_rgba(0,229,255,0.2)]">
                    <span className="font-medium">{u.username || u.email}</span>
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
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-300 border ${isSelected ? 'bg-neon-cyan/10 border-neon-cyan/30 shadow-[0_0_10px_rgba(0,229,255,0.1)]' : 'border-transparent hover:bg-white/5 hover:border-white/10'}`}
                  >
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={u.avatar} />
                      <AvatarFallback>{(u.username || u.email || '?').charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${isSelected ? 'text-neon-cyan' : 'text-white'}`}>{u.username || u.email}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-neon-cyan border-neon-cyan shadow-[0_0_10px_rgba(0,229,255,0.5)]' : 'border-muted-foreground'}`}>
                      {isSelected && <div className="w-2.5 h-2.5 bg-[#070B14] rounded-full" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl h-12 px-6 text-muted-foreground hover:text-white">Cancel</Button>
          <Button 
            onClick={handleCreate} 
            disabled={!name.trim() || selectedUsers.length === 0 || isLoading}
            className="cyber-gradient neon-box-glow text-[#070B14] hover:opacity-90 font-bold rounded-xl h-12 px-6 transition-all"
          >
            {isLoading ? "Creating..." : "Create Group"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
