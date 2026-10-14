"use client";

import { useState, useEffect } from "react";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/lib/contexts/AuthContext";
import { ActivityLog } from "@/types";
import { formatToBuddhistEraWithTime } from "@/lib/dateUtils";
import { Shield, Activity, Settings as SettingsIcon } from "lucide-react";

export default function SettingsPage() {
  const { appUser } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (appUser?.role !== 'super_admin' && appUser?.role !== 'admin') {
      setLoading(false);
      return;
    }

    const fetchLogs = async () => {
      try {
        const q = query(
          collection(db, "activity_logs"),
          orderBy("timestamp", "desc"),
          limit(50)
        );
        const snapshot = await getDocs(q);
        const logData = snapshot.docs.map(doc => ({
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate()
        })) as ActivityLog[];
        
        setLogs(logData);
      } catch (err) {
        console.error("Error fetching logs:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [appUser]);

  if (appUser?.role !== 'super_admin' && appUser?.role !== 'admin') {
    return (
      <div className="p-12 text-center">
        <Shield className="h-16 w-16 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900">ไม่มีสิทธิ์เข้าถึง</h2>
        <p className="text-gray-500 mt-2">เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถเข้าถึงหน้านี้ได้</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ตั้งค่าระบบ & บันทึกกิจกรรม (Audit Logs)</h1>
        <p className="text-sm text-gray-500">จัดการการตั้งค่าและตรวจสอบประวัติการใช้งานระบบ</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <SettingsIcon className="w-5 h-5 text-gray-500 mr-2" />
              <h2 className="text-lg font-bold text-gray-900">การตั้งค่าทั่วไป</h2>
            </div>
            <div className="space-y-4">
              <div className="pb-4 border-b">
                <p className="text-sm font-medium text-gray-700">ปีงบประมาณ/ปี พ.ศ. ปัจจุบัน</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">2569</p>
              </div>
              <div className="pb-4 border-b">
                <p className="text-sm font-medium text-gray-700">เลขรับล่าสุด (Incoming)</p>
                <p className="text-lg font-medium text-gray-900 mt-1">อัปเดตอัตโนมัติ</p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="flex items-center">
                <Activity className="w-5 h-5 text-blue-600 mr-2" />
                <h2 className="text-lg font-bold text-gray-900">ประวัติการใช้งานระบบ (50 รายการล่าสุด)</h2>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-white">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">วัน/เวลา</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ผู้ใช้</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">การกระทำ</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">รายละเอียด</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">กำลังโหลด...</td></tr>
                  ) : logs.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">ไม่มีประวัติการใช้งาน</td></tr>
                  ) : (
                    logs.map(log => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                          {formatToBuddhistEraWithTime(log.timestamp)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {log.user_name}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          <span className="px-2 py-1 rounded bg-gray-100 text-xs font-medium">{log.action}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                          {log.entity_type}: {JSON.stringify(log.new_value)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
