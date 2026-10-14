"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { PostalTracking } from "@/types";
import { formatToBuddhistEra } from "@/lib/dateUtils";
import { Truck, Plus, Search, ExternalLink, Package } from "lucide-react";

export default function TrackingListPage() {
  const [trackings, setTrackings] = useState<PostalTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchTrackings = async () => {
      try {
        const q = query(
          collection(db, "postal_trackings"),
          where("deleted", "==", false)
        );
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            sent_date: data.sent_date?.toDate ? data.sent_date.toDate() : new Date(data.sent_date),
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
          } as PostalTracking;
        });

        list.sort((a, b) => {
          const dateA = a.sent_date?.getTime() || 0;
          const dateB = b.sent_date?.getTime() || 0;
          return dateB - dateA;
        });

        setTrackings(list);
      } catch (err) {
        console.error("Error fetching postal trackings:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTrackings();
  }, []);

  const getTrackingUrl = (trackingNumber: string, courier: string) => {
    if (courier.includes("ไปรษณีย์") || courier.toLowerCase().includes("thailand post") || courier === "EMS") {
      return `https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(trackingNumber)}`;
    }
    if (courier.toLowerCase().includes("flash")) {
      return `https://www.flashexpress.co.th/tracking/?se=${encodeURIComponent(trackingNumber)}`;
    }
    if (courier.toLowerCase().includes("kerry") || courier.toLowerCase().includes("kerry express")) {
      return `https://th.kerryexpress.com/th/track/?track=${encodeURIComponent(trackingNumber)}`;
    }
    return `https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(trackingNumber)}`;
  };

  const filtered = trackings.filter(item => 
    item.tracking_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.recipient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.outgoing_running_number && item.outgoing_running_number.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">บันทึกเลขพัสดุ / Tracking การส่ง</h1>
          <p className="text-sm text-gray-500">บันทึกและติดตามการจัดส่งไปรษณีย์และพัสดุภัณฑ์</p>
        </div>
        <Link 
          href="/tracking/new" 
          className="flex items-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5 mr-2" />
          บันทึกเลขส่งพัสดุใหม่
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative max-w-md w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="ค้นหาเลข Tracking, เลขที่หนังสือส่ง, เรื่อง, หรือผู้รับ..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">เลข Tracking</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ผู้ให้บริการ</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">อ้างอิงหนังสือส่ง</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">เรื่อง / รายการสิ่งของ</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ผู้รับ</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">วันที่ส่ง</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">ตรวจสอบสถานะ</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex justify-center mb-4">
                      <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    กำลังโหลดข้อมูล...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <Package className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                    ไม่พบรายการบันทึกเลขพัสดุ
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold font-mono text-blue-700">
                      {item.tracking_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                        {item.courier}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                      {item.outgoing_running_number ? (
                        <Link href={`/outgoing`} className="text-blue-600 hover:underline">
                          {item.outgoing_running_number}
                        </Link>
                      ) : (
                        <span className="text-gray-400 text-xs italic">ไม่มีเลขหนังสือ (ส่งตรง)</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {item.subject}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {item.recipient_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatToBuddhistEra(item.sent_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <a 
                        href={getTrackingUrl(item.tracking_number, item.courier)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-blue-600 hover:text-blue-900 font-medium"
                      >
                        เช็คพัสดุ
                        <ExternalLink className="w-3.5 h-3.5 ml-1" />
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
