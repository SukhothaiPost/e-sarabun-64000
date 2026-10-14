"use client";

import { useAuth } from "@/lib/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { 
  LayoutDashboard, 
  Inbox, 
  Send, 
  Briefcase, 
  Search, 
  Archive, 
  BarChart3, 
  Users, 
  Settings,
  LogOut,
  Menu,
  X,
  Truck
} from "lucide-react";
import { useState, Suspense } from "react";
import Image from "next/image";

const navGroups = [
  {
    groupTitle: "งานสารบรรณ",
    items: [
      { name: 'ภาพรวมระบบ', href: '/dashboard', icon: LayoutDashboard, roles: ['super_admin', 'admin', 'officer', 'viewer'] },
      { name: 'ทะเบียนหนังสือรับ', href: '/incoming', icon: Inbox, roles: ['super_admin', 'admin', 'officer', 'viewer'] },
      { name: 'ทะเบียนหนังสือส่ง', href: '/outgoing', icon: Send, roles: ['super_admin', 'admin', 'officer', 'viewer'] },
      { name: 'บันทึกเลข Tracking', href: '/tracking', icon: Truck, roles: ['super_admin', 'admin', 'officer', 'viewer'] },
    ]
  },
  {
    groupTitle: "คลังเอกสาร & สืบค้น",
    items: [
      { name: 'คลังเอกสาร (ตู้/ชั้น)', href: '/archive', icon: Archive, roles: ['super_admin', 'admin', 'officer', 'viewer'] },
      { name: 'ค้นหาเอกสาร', href: '/search', icon: Search, roles: ['super_admin', 'admin', 'officer', 'viewer'] },
    ]
  },
  {
    groupTitle: "การจัดการระบบ",
    items: [
      { name: 'รายงานสถิติ', href: '/reports', icon: BarChart3, roles: ['super_admin', 'admin'] },
      { name: 'จัดการผู้ใช้งาน', href: '/users', icon: Users, roles: ['super_admin'] },
      { name: 'ตั้งค่าระบบ', href: '/settings', icon: Settings, roles: ['super_admin', 'admin'] },
    ]
  }
];

function NavigationLinks({ 
  currentRole, 
  onClose 
}: { 
  currentRole: string; 
  onClose: () => void; 
}) {
  const pathname = usePathname();

  return (
    <nav className="px-3.5 space-y-5">
      {navGroups.map((group, gIdx) => {
        const visibleItems = group.items.filter(item => item.roles.includes(currentRole));
        if (visibleItems.length === 0) return null;

        return (
          <div key={gIdx} className="space-y-1">
            <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
              {group.groupTitle}
            </p>
            {visibleItems.map((item) => {
              const isActive = item.href === '/dashboard' 
                ? pathname === '/dashboard' 
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-3.5 py-2.5 text-xs font-semibold rounded-xl transition-all ${
                    isActive 
                      ? 'bg-red-600 text-white shadow-md shadow-red-200' 
                      : 'text-gray-600 hover:text-red-600 hover:bg-red-50/70'
                  }`}
                  onClick={onClose}
                >
                  <item.icon className={`mr-3 flex-shrink-0 h-4.5 w-4.5 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-red-600'}`} />
                  {item.name}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, appUser, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f6fa]">
        <div className="animate-spin h-8 w-8 border-4 border-red-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  const handleLogout = async () => {
    localStorage.removeItem("hardcoded_user");
    await signOut(auth);
    router.push("/login");
  };

  const currentRole = appUser?.role || 'viewer';

  return (
    <div className="min-h-screen bg-[#f4f6fa] flex">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/40 backdrop-blur-xs lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-100 shadow-xs transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Brand Header */}
        <div className="flex items-center justify-between h-20 px-5 border-b border-gray-100 bg-white">
          <Link href="/dashboard" className="flex items-center space-x-3 group min-w-0">
            <Image 
              src="/logo.png" 
              alt="Thailand Post" 
              width={48} 
              height={48} 
              className="h-11 w-auto object-contain flex-shrink-0"
              priority
            />
            <div className="min-w-0">
              <div className="text-base font-bold text-gray-900 leading-tight truncate">e-Saraban</div>
              <div className="text-[11px] font-semibold text-red-600 truncate">ไปรษณีย์ไทย 64000</div>
            </div>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-500 p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Nav Links */}
        <div className="flex-1 overflow-y-auto py-5">
          <Suspense fallback={<div className="px-3 space-y-1" />}>
            <NavigationLinks currentRole={currentRole} onClose={() => setSidebarOpen(false)} />
          </Suspense>
        </div>

        {/* User Profile Card */}
        <div className="p-4 border-t border-gray-100 bg-white">
          <div className="flex items-center mb-3 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
            <div className="w-9 h-9 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-sm shadow-2xs shrink-0">
              {appUser?.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
            </div>
            <div className="ml-2.5 truncate flex-1">
              <p className="text-xs font-bold text-gray-900 truncate leading-tight">{appUser?.displayName || 'User'}</p>
              <p className="text-[10px] font-semibold text-red-600 truncate uppercase mt-0.5">{appUser?.role || 'No Role'}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center justify-center w-full px-3 py-2 text-xs font-semibold text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          >
            <LogOut className="mr-2 h-4 w-4" />
            ออกจากระบบ
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header for Mobile */}
        <div className="lg:hidden flex items-center justify-between h-16 px-4 bg-white border-b border-gray-100 shadow-2xs">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-500 focus:outline-none p-1.5 rounded-lg hover:bg-gray-100">
            <Menu className="w-6 h-6" />
          </button>
          <Link href="/dashboard" className="flex items-center space-x-2">
            <Image 
              src="/logo.png" 
              alt="Thailand Post" 
              width={36} 
              height={36} 
              className="h-9 w-auto object-contain"
            />
            <span className="text-base font-bold text-gray-900">e-Saraban</span>
          </Link>
          <div className="w-8"></div> {/* Spacer for center alignment */}
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
