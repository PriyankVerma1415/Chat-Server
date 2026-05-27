"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";

export default function Home() {
  const router = useRouter();
  const { user, initialize } = useAuthStore();

  useEffect(() => {
    const checkAuth = async () => {
      await initialize();
      const token = localStorage.getItem("token");
      if (token) {
        router.push("/chat");
      } else {
        router.push("/login");
      }
    };
    checkAuth();
  }, [initialize, router]);

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
