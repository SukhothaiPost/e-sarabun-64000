"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";

import Image from "next/image";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push("/dashboard");
      } else {
        router.push("/login");
      }
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center">
        <Image 
          src="/logo.png" 
          alt="ไปรษณีย์ไทย Thailand Post" 
          width={90} 
          height={90} 
          className="h-20 w-auto object-contain mb-4 animate-pulse drop-shadow-sm"
          priority
        />
        <div className="h-7 w-7 border-3 border-red-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-gray-700 font-semibold text-sm">กำลังโหลดระบบสารบรรณ ไปรษณีย์ไทย...</p>
      </div>
    </div>
  );
}
