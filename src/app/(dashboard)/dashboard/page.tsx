"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { collection, query, where, getDocs, limit, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { SarabanDocument, PostalTracking } from "@/types";
import { formatToBuddhistEra } from "@/lib/dateUtils";
import { 
  Inbox, 
  Send, 
  Truck, 
  Archive, 
  PlusCircle, 
  ExternalLink, 
  FileText, 
  ArrowRight,
  PackageCheck
} from "lucide-react";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    incomingToday: 0,
    incomingTotal: 0,
    outgoingToday: 0,
    outgoingTotal: 0,
    trackingToday: 0,
    trackingTotal: 0,
    archivedTotal: 0,
    archiveLocationsCount: 0,
  });

  const [recentIncoming, setRecentIncoming] = useState<SarabanDocument[]>([]);
  const [recentTrackings, setRecentTrackings] = useState<PostalTracking[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. Fetch Documents (incoming & outgoing)
        const docsQuery = query(collection(db, "documents"), where("deleted", "==", false));
        const docsSnap = await getDocs(docsQuery);
        
        let incToday = 0;
        let incTotal = 0;
        let outToday = 0;
        let outTotal = 0;
        let archived = 0;
        const allIncoming: SarabanDocument[] = [];

        docsSnap.forEach(d => {
          const docData = d.data() as SarabanDocument;
          const createdAt = docData.createdAt?.toDate ? docData.createdAt.toDate() : new Date(docData.createdAt || 0);

          if (docData.document_type === 'incoming') {
            incTotal++;
            if (createdAt >= today) incToday++;
            allIncoming.push({ ...docData, createdAt });
          } else if (docData.document_type === 'outgoing') {
            outTotal++;
            if (createdAt >= today) outToday++;
          }

          if (docData.status === 'archived' || docData.archive_location_id) {
            archived++;
          }
        });

        allIncoming.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
        setRecentIncoming(allIncoming.slice(0, 5));

        // 2. Fetch Postal Trackings
        const trackingsQuery = query(collection(db, "postal_trackings"), where("deleted", "==", false));
        const trackingsSnap = await getDocs(trackingsQuery);
        let trackToday = 0;
        let trackTotal = 0;
        const allTrackings: PostalTracking[] = [];

        trackingsSnap.forEach(t => {
          const tData = t.data() as PostalTracking;
          const sentDate = tData.sent_date?.toDate ? tData.sent_date.toDate() : new Date(tData.sent_date || 0);
          trackTotal++;
          if (sentDate >= today) trackToday++;
          allTrackings.push({ ...tData, sent_date: sentDate });
        });

        allTrackings.sort((a, b) => (b.sent_date?.getTime() || 0) - (a.sent_date?.getTime() || 0));
        setRecentTrackings(allTrackings.slice(0, 5));

        // 3. Fetch Archive Locations count
        const archiveSnap = await getDocs(collection(db, "archive_locations"));
        const locsCount = archiveSnap.size;

        setStats({
          incomingToday: incToday,
          incomingTotal: incTotal,
          outgoingToday: outToday,
          outgoingTotal: outTotal,
          trackingToday: trackToday,
          trackingTotal: trackTotal,
          archivedTotal: archived,
          archiveLocationsCount: locsCount,
        });

      } catch (err) {
        console.error("Dashboard data load error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const statCards = [
    {
      title: "1. หนังสือรับ",
      today: stats.incomingToday,
      total: stats.incomingTotal,
      todayLabel: "รับเข้าวันนี้",
      totalLabel: "หนังสือรับทั้งหมด",
      icon: Inbox,
      href: "/incoming",
      addHref: "/incoming/new",
      btnText: "ลงรับหนังสือ",
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-200"
    },
    {
      title: "2. หนังสือส่ง",
      today: stats.outgoingToday,
      total: stats.outgoingTotal,
      todayLabel: "ส่งออกวันนี้",
      totalLabel: "หนังสือส่งทั้งหมด",
      icon: Send,
      href: "/outgoing",
      addHref: "/outgoing/new",
      btnText: "ลงส่งหนังสือ",
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-200"
    },
    {
      title: "3. บันทึกเลข Tracking",
      today: stats.trackingToday,
      total: stats.trackingTotal,
      todayLabel: "ส่งพัสดุวันนี้",
      totalLabel: "รายการจัดส่งทั้งหมด",
      icon: Truck,
      href: "/tracking",
      addHref: "/tracking/new",
      btnText: "บันทึกเลข Tracking",
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-200"
    },
    {
      title: "4. ระบบจัดเก็บเอกสาร",
      today: stats.archivedTotal,
      total: stats.archiveLocationsCount,
      todayLabel: "เอกสารที่จัดเก็บแล้ว",
      totalLabel: "จุดจัดเก็บ/ตู้-แฟ้ม",
      icon: Archive,
      href: "/archive",
      addHref: "/archive/new",
      btnText: "เพิ่มจุดจัดเก็บ",
      color: "text-purple-600",
      bg: "bg-purple-50",
      border: "border-purple-200"
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ภาพรวมระบบสารบรรณและคลังเอกสาร</h1>
          <p className="text-sm text-gray-500 mt-1">จัดการ 4 หน้าที่หลัก: หนังสือรับ, หนังสือส่ง, บันทึก Tracking และคลังจัดเก็บเอกสาร</p>
        </div>
      </div>

      {/* 4 Core Pillars Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((card, idx) => (
          <div key={idx} className={`bg-white rounded-xl border ${card.border} p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between`}>
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-700">{card.title}</span>
                <div className={`p-2 rounded-lg ${card.bg} ${card.color}`}>
                  <card.icon className="w-5 h-5" />
                </div>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-gray-500">{card.todayLabel}</span>
                  <span className={`text-2xl font-extrabold ${card.color}`}>
                    {loading ? "-" : card.today}
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-xs text-gray-500 pt-1 border-t border-gray-100">
                  <span>{card.totalLabel}</span>
                  <span className="font-semibold text-gray-700">{loading ? "-" : card.total}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
              <Link href={card.href} className="text-gray-600 hover:text-blue-600 font-medium inline-flex items-center">
                ดูรายการทั้งหมด <ArrowRight className="w-3 h-3 ml-1" />
              </Link>
              <Link href={card.addHref} className={`font-semibold ${card.color} hover:underline inline-flex items-center`}>
                <PlusCircle className="w-3.5 h-3.5 mr-1" /> {card.btnText}
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content: 2 Columns for Recent Operations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Recent Incoming Correspondence */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <div className="flex items-center space-x-2">
              <Inbox className="w-5 h-5 text-blue-600" />
              <h2 className="font-bold text-gray-900">หนังสือรับล่าสุด</h2>
            </div>
            <Link href="/incoming" className="text-xs font-semibold text-blue-600 hover:underline">
              ดูทั้งหมด
            </Link>
          </div>
          
          <div className="divide-y divide-gray-100">
            {loading ? (
              <div className="p-8 text-center text-sm text-gray-500">กำลังโหลดข้อมูล...</div>
            ) : recentIncoming.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">ยังไม่มีหนังสือรับในระบบ</div>
            ) : (
              recentIncoming.map((doc) => (
                <Link 
                  key={doc.id} 
                  href={`/incoming/${doc.id}`}
                  className="p-4 block hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                      {doc.running_number}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatToBuddhistEra(doc.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.subject}</p>
                  <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                    <span className="truncate">จาก: {doc.sender}</span>
                    <span className="text-gray-400">{doc.document_number}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent Postal Trackings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <div className="flex items-center space-x-2">
              <Truck className="w-5 h-5 text-amber-600" />
              <h2 className="font-bold text-gray-900">การส่งพัสดุและเลข Tracking ล่าสุด</h2>
            </div>
            <Link href="/tracking" className="text-xs font-semibold text-blue-600 hover:underline">
              ดูทั้งหมด
            </Link>
          </div>

          <div className="divide-y divide-gray-100">
            {loading ? (
              <div className="p-8 text-center text-sm text-gray-500">กำลังโหลดข้อมูล...</div>
            ) : recentTrackings.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">ยังไม่มีรายการบันทึกเลขพัสดุ</div>
            ) : (
              recentTrackings.map((item) => (
                <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-mono text-sm font-bold text-blue-700">
                        {item.tracking_number}
                      </span>
                      <span className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">
                        {item.courier}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 font-medium truncate">{item.subject}</p>
                    <p className="text-xs text-gray-500 truncate">
                      ส่งถึง: {item.recipient_name} 
                      {item.outgoing_running_number && ` • หนังสือส่ง ${item.outgoing_running_number}`}
                    </p>
                  </div>

                  <a
                    href={`https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(item.tracking_number)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-md transition-colors flex-shrink-0"
                  >
                    ตรวจสถานะ
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
