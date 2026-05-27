"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import Sidebar from "@/components/sidebar/Sidebar";
import ChatWindow from "@/components/chat/ChatWindow";
import CallOverlay from "@/components/call/CallOverlay";
import GroupCallOverlay from "@/components/call/GroupCallOverlay";

export default function ChatPage() {
  const { user, initialize } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      await initialize();
      setLoading(false);
    };
    checkAuth();
  }, [initialize]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-6">
          <div className="relative w-20 h-20 animate-pulse overflow-hidden rounded-2xl flex items-center justify-center">
            <img 
              src="/nexchat-logo.png" 
              alt="NexChat Logo" 
              className="w-full h-full object-cover scale-[1.35]"
            />
          </div>
          <h1 className="text-xl font-bold text-muted-foreground animate-pulse">Loading NexChat...</h1>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <ChatWindow />
      <CallOverlay />
      <GroupCallOverlay />
    </div>
  );
}
