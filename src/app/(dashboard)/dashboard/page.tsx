"use client";

import { useAuth } from "@/lib/contexts/AuthContext";
import { Inbox, Send, Clock, PlayCircle, CheckCircle, Archive } from "lucide-react";

export default function DashboardPage() {
  const { appUser } = useAuth();

  const stats = [
    { label: 'หนังสือรับวันนี้', value: 12, icon: Inbox, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'หนังสือส่งวันนี้', value: 5, icon: Send, color: 'text-green-600', bg: 'bg-green-100' },
    { label: 'รอดำเนินการ', value: 8, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100' },
    { label: 'กำลังดำเนินการ', value: 3, icon: PlayCircle, color: 'text-orange-600', bg: 'bg-orange-100' },
    { label: 'ดำเนินการแล้ว', value: 24, icon: CheckCircle, color: 'text-teal-600', bg: 'bg-teal-100' },
    { label: 'จัดเก็บแล้ว', value: 156, icon: Archive, color: 'text-gray-600', bg: 'bg-gray-100' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">ภาพรวมระบบ (Dashboard)</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center">
            <div className={`p-4 rounded-full ${stat.bg} ${stat.color} mr-4`}>
              <stat.icon className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{stat.label}</p>
              <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">งานของฉัน (ล่าสุด)</h2>
          <div className="text-center py-10 text-gray-500">
            ไม่มีงานรอดำเนินการ
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">สถิติเอกสารรายเดือน</h2>
          <div className="text-center py-10 text-gray-500 flex flex-col items-center justify-center">
            <div className="w-full max-w-[200px] aspect-square rounded-full border-8 border-gray-100 flex items-center justify-center mb-4">
              <span className="text-gray-400 text-sm">กราฟจะแสดงเมื่อมีข้อมูล</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
