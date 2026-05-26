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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
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
            <Avatar className="w-24 h-24 transition-opacity group-hover:opacity-80">
              <AvatarImage src={avatar || undefined} />
              <AvatarFallback className="text-3xl">
                {(username || user?.phoneNumber || '?').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 rounded-full transition-opacity">
              <span className="text-sm text-white font-medium">Change</span>
            </div>
          </div>
          
          <div className="w-full space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Name</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Your Name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your Email"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input value={user?.phoneNumber} disabled className="bg-secondary/50" />
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
