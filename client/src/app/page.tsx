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
      <div className="animate-pulse flex flex-col items-center">
        <div className="h-12 w-12 bg-primary/20 rounded-full mb-4"></div>
        <div className="h-4 w-32 bg-secondary rounded"></div>
      </div>
    </div>
  );
}
