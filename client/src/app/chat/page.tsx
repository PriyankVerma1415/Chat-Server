"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import Sidebar from "@/components/sidebar/Sidebar";
import ChatWindow from "@/components/chat/ChatWindow";
import CallOverlay from "@/components/call/CallOverlay";

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
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 bg-primary/20 rounded-full mb-4"></div>
          <div className="h-4 w-32 bg-secondary rounded"></div>
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
    </div>
  );
}
