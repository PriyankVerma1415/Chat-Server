import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/store/useAuthStore";
import api from "@/services/api";

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ProfileDialog({ open, onOpenChange }: ProfileDialogProps) {
  const { user, setUser } = useAuthStore();
  const [username, setUsername] = useState(user?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [avatar, setAvatar] = useState(user?.avatar || "");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Image is too large. Please select an image under 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatar(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data } = await api.put("/users/profile", { username, email, avatar });
      setUser(data);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update profile", error);
      alert("Failed to save profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel sm:max-w-md sm:rounded-3xl border-neon-cyan/30 shadow-[0_0_30px_rgba(0,229,255,0.15)]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold font-heading text-white">Edit Profile</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Make changes to your profile here. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-6 py-4">
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <div 
            className="cursor-pointer relative group" 
            onClick={() => fileInputRef.current?.click()}
          >
            <Avatar className="w-24 h-24 transition-opacity group-hover:opacity-80 shadow-[0_0_15px_rgba(0,229,255,0.4)] border-2 border-neon-cyan/50">
              <AvatarImage src={avatar || undefined} />
              <AvatarFallback className="text-3xl bg-black/40 text-neon-cyan">
                {(username || user?.email || '?').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/60 rounded-full transition-opacity backdrop-blur-sm">
              <span className="text-sm text-neon-cyan font-bold drop-shadow-md">Change</span>
            </div>
          </div>
          
          <div className="w-full space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-muted-foreground">Name</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Your Name"
                className="w-full h-12 bg-black/20 border-glass-border focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan text-white rounded-xl transition-all"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-muted-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your Email"
                className="w-full h-12 bg-black/20 border-glass-border focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan text-white rounded-xl transition-all"
              />
            </div>

          </div>
        </div>
        <div className="flex justify-end mt-4">
          <Button onClick={handleSave} disabled={loading} className="w-full cyber-gradient neon-box-glow text-[#070B14] hover:opacity-90 font-bold rounded-xl h-12 transition-all">
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
