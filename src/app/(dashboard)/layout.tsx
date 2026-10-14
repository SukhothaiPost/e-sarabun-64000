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

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['super_admin', 'admin', 'officer', 'viewer'] },
  { name: 'หนังสือรับ', href: '/incoming', icon: Inbox, roles: ['super_admin', 'admin', 'officer', 'viewer'] },
  { name: 'หนังสือส่ง', href: '/outgoing', icon: Send, roles: ['super_admin', 'admin', 'officer', 'viewer'] },
  { name: 'บันทึกเลข Tracking', href: '/tracking', icon: Truck, roles: ['super_admin', 'admin', 'officer', 'viewer'] },
  { name: 'คลังเอกสาร', href: '/archive', icon: Archive, roles: ['super_admin', 'admin', 'officer', 'viewer'] },
  { name: 'ค้นหาเอกสาร', href: '/search', icon: Search, roles: ['super_admin', 'admin', 'officer', 'viewer'] },
  { name: 'รายงาน', href: '/reports', icon: BarChart3, roles: ['super_admin', 'admin'] },
  { name: 'ผู้ใช้งาน', href: '/users', icon: Users, roles: ['super_admin'] },
  { name: 'ตั้งค่าระบบ', href: '/settings', icon: Settings, roles: ['super_admin', 'admin'] },
];

function NavigationLinks({ 
  filteredNav, 
  onClose 
}: { 
  filteredNav: typeof navigation; 
  onClose: () => void; 
}) {
  const pathname = usePathname();
  return (
    <nav className="px-3 space-y-1">
      {filteredNav.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.name}
            href={item.href}
            className={`flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${
              isActive 
                ? 'bg-blue-50 text-blue-700' 
                : 'text-gray-700 hover:bg-gray-100'
            }`}
            onClick={onClose}
          >
            <item.icon className={`mr-3 flex-shrink-0 h-5 w-5 ${isActive ? 'text-blue-700' : 'text-gray-400'}`} />
            {item.name}
          </Link>
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
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
  const filteredNav = navigation.filter(item => item.roles.includes(currentRole));

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between h-20 px-5 border-b border-gray-200 bg-white">
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
        
        <div className="flex-1 overflow-y-auto py-4">
          <Suspense fallback={<div className="px-3 space-y-1" />}>
            <NavigationLinks filteredNav={filteredNav} onClose={() => setSidebarOpen(false)} />
          </Suspense>
        </div>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center mb-4">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
              {appUser?.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
            </div>
            <div className="ml-3 truncate">
              <p className="text-sm font-medium text-gray-900 truncate">{appUser?.displayName || 'User'}</p>
              <p className="text-xs text-gray-500 truncate">{appUser?.role || 'No Role'}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center w-full px-3 py-2 text-sm font-medium text-red-600 rounded-md hover:bg-red-50 transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5" />
            ออกจากระบบ
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header for Mobile */}
        <div className="lg:hidden flex items-center justify-between h-16 px-4 bg-white border-b border-gray-200">
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
