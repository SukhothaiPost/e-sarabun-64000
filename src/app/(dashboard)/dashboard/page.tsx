"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { SarabanDocument, PostalTracking } from "@/types";
import { formatToBuddhistEra } from "@/lib/dateUtils";
import { 
  Inbox, 
  Send, 
  Truck, 
  Archive, 
  Plus, 
  ExternalLink, 
  ArrowRight,
  TrendingUp,
  Search,
  CheckCircle2,
  Layers,
  FolderCheck,
  Calendar,
  Sparkles
} from "lucide-react";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [quickTrackCode, setQuickTrackCode] = useState("");
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

  const handleQuickTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTrackCode.trim()) return;
    const cleanCode = quickTrackCode.trim();
    window.open(`https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(cleanCode)}`, "_blank");
  };

  // Calculation for operational percentages
  const todayTotalOps = stats.incomingToday + stats.outgoingToday + stats.trackingToday;
  const incPercent = todayTotalOps > 0 ? Math.round((stats.incomingToday / todayTotalOps) * 100) : 34;
  const outPercent = todayTotalOps > 0 ? Math.round((stats.outgoingToday / todayTotalOps) * 100) : 33;
  const trackPercent = todayTotalOps > 0 ? Math.round((stats.trackingToday / todayTotalOps) * 100) : 33;

  const totalAllDocs = stats.incomingTotal + stats.outgoingTotal;
  const archiveRate = totalAllDocs > 0 ? Math.round((stats.archivedTotal / totalAllDocs) * 100) : 0;

  return (
    <div className="space-y-7 pb-10">
      {/* Top Welcome & Quick Actions Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white rounded-2xl p-6 border border-gray-150 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 text-red-600 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            ระบบสารบรรณและคลังเอกสาร ไปรษณีย์ไทย
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            ภาพรวมการปฏิบัติงานประจำวัน
          </h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-gray-400" />
            วันที่ {formatToBuddhistEra(new Date())} • ที่ทำการไปรษณีย์สุโขทัย (64000)
          </p>
        </div>

        {/* Quick Action Shortcuts */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/incoming/new"
            className="inline-flex items-center px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-xs font-semibold hover:border-red-300 hover:text-red-600 hover:bg-red-50/40 shadow-2xs transition-all"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5 text-red-600" />
            ลงรับหนังสือ
          </Link>
          <Link
            href="/outgoing/new"
            className="inline-flex items-center px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-xs font-semibold hover:border-red-300 hover:text-red-600 hover:bg-red-50/40 shadow-2xs transition-all"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5 text-red-600" />
            ออกเลขส่ง
          </Link>
          <Link
            href="/tracking/new"
            className="inline-flex items-center px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-md shadow-red-200 hover:shadow-lg hover:shadow-red-300/50 transition-all"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            บันทึกเลข Tracking
          </Link>
        </div>
      </div>

      {/* 4 Core Pillars: Styled as modern Folder-Cards (Reference Image Style) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* 1. หนังสือรับ */}
        <div className="bg-white rounded-2xl border border-gray-150 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">01. หนังสือรับ</span>
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform">
                <Inbox className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium text-gray-500">รับเข้าวันนี้</span>
                <span className="text-3xl font-extrabold text-gray-900 tracking-tight">
                  {loading ? "-" : stats.incomingToday}
                </span>
              </div>
              <p className="text-xs text-gray-400">
                จากทั้งหมด <span className="font-semibold text-gray-700">{loading ? "-" : stats.incomingTotal}</span> ฉบับ
              </p>
            </div>
          </div>

          <div className="mt-5 pt-3.5 border-t border-gray-100 flex items-center justify-between">
            <Link 
              href="/incoming" 
              className="text-xs font-semibold text-gray-600 hover:text-red-600 inline-flex items-center transition-colors"
            >
              ดูรายการทั้งหมด <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
            <Link
              href="/incoming/new"
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="ลงทะเบียนรับหนังสือใหม่"
            >
              <Plus className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* 2. หนังสือส่ง (Highlight Card in Thailand Post Red Gradient) */}
        <div className="bg-gradient-to-br from-red-600 via-red-600 to-rose-700 rounded-2xl p-5 shadow-lg shadow-red-200 text-white flex flex-col justify-between transform transition-all hover:-translate-y-0.5">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-red-100 uppercase tracking-wider">02. หนังสือส่ง</span>
              <div className="p-2.5 rounded-xl bg-white/20 text-white backdrop-blur-xs">
                <Send className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium text-red-100">ออกเลขวันนี้</span>
                <span className="text-3xl font-extrabold text-white tracking-tight">
                  {loading ? "-" : stats.outgoingToday}
                </span>
              </div>
              <p className="text-xs text-red-100/80">
                จากทั้งหมด <span className="font-semibold text-white">{loading ? "-" : stats.outgoingTotal}</span> ฉบับ
              </p>
            </div>
          </div>

          <div className="mt-5 pt-3.5 border-t border-white/20 flex items-center justify-between">
            <Link 
              href="/outgoing" 
              className="text-xs font-semibold text-white/90 hover:text-white inline-flex items-center transition-colors"
            >
              ดูรายการทั้งหมด <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
            <Link
              href="/outgoing/new"
              className="p-1.5 bg-white text-red-600 hover:bg-red-50 rounded-lg transition-colors shadow-xs"
              title="สร้างหนังสือส่งใหม่"
            >
              <Plus className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* 3. บันทึกเลข Tracking */}
        <div className="bg-white rounded-2xl border border-gray-150 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">03. Tracking พัสดุ</span>
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 group-hover:scale-110 transition-transform">
                <Truck className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium text-gray-500">บันทึกส่งวันนี้</span>
                <span className="text-3xl font-extrabold text-gray-900 tracking-tight">
                  {loading ? "-" : stats.trackingToday}
                </span>
              </div>
              <p className="text-xs text-gray-400">
                รวมทั้งหมด <span className="font-semibold text-gray-700">{loading ? "-" : stats.trackingTotal}</span> รายการ
              </p>
            </div>
          </div>

          <div className="mt-5 pt-3.5 border-t border-gray-100 flex items-center justify-between">
            <Link 
              href="/tracking" 
              className="text-xs font-semibold text-gray-600 hover:text-red-600 inline-flex items-center transition-colors"
            >
              ดูรายการทั้งหมด <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
            <Link
              href="/tracking/new"
              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
              title="บันทึกเลข Tracking ใหม่"
            >
              <Plus className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* 4. ระบบจัดเก็บเอกสาร */}
        <div className="bg-white rounded-2xl border border-gray-150 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">04. คลังจัดเก็บเอกสาร</span>
              <div className="p-2.5 rounded-xl bg-red-50 text-red-600 group-hover:scale-110 transition-transform">
                <Archive className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium text-gray-500">จัดเก็บเข้าแฟ้มแล้ว</span>
                <span className="text-3xl font-extrabold text-red-600 tracking-tight">
                  {loading ? "-" : stats.archivedTotal}
                </span>
              </div>
              <p className="text-xs text-gray-400">
                ในตู้/ชั้น/แฟ้ม <span className="font-semibold text-gray-700">{loading ? "-" : stats.archiveLocationsCount}</span> จุด
              </p>
            </div>
          </div>

          <div className="mt-5 pt-3.5 border-t border-gray-100 flex items-center justify-between">
            <Link 
              href="/archive" 
              className="text-xs font-semibold text-gray-600 hover:text-red-600 inline-flex items-center transition-colors"
            >
              จัดการคลังเอกสาร <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
            <Link
              href="/archive/new"
              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="เพิ่มแฟ้มใหม่"
            >
              <Plus className="w-4 h-4" />
            </Link>
          </div>
        </div>

      </div>

      {/* Main 2-Column Section: Operational Lists + Right Statistic Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
        
        {/* Left Column (8 cols): Recent Incoming & Recent Tracking */}
        <div className="lg:col-span-8 space-y-7">
          
          {/* Card: หนังสือรับล่าสุด */}
          <div className="bg-white rounded-2xl shadow-xs border border-gray-150 overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                  <Inbox className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900 text-sm">หนังสือรับล่าสุด</h2>
                  <p className="text-xs text-gray-400">รายการหนังสือที่ลงรับเข้ามาล่าสุด</p>
                </div>
              </div>
              <Link 
                href="/incoming" 
                className="text-xs font-semibold text-red-600 hover:text-red-700 inline-flex items-center"
              >
                ดูทั้งหมด <ArrowRight className="w-3 h-3 ml-1" />
              </Link>
            </div>
            
            <div className="divide-y divide-gray-100">
              {loading ? (
                <div className="p-8 text-center text-sm text-gray-500">
                  <div className="animate-spin h-6 w-6 border-2 border-red-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                  กำลังโหลดข้อมูล...
                </div>
              ) : recentIncoming.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400">ยังไม่มีรายการหนังสือรับในระบบ</div>
              ) : (
                recentIncoming.map((doc) => (
                  <Link 
                    key={doc.id} 
                    href={`/incoming/${doc.id}`}
                    className="p-4 block hover:bg-gray-50/80 transition-colors group"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded-lg">
                          เลขที่รับ: {doc.running_number}
                        </span>
                        {doc.document_number && (
                          <span className="text-xs text-gray-500 hidden sm:inline">
                            (เลขที่: {doc.document_number})
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-medium text-gray-400">
                        {formatToBuddhistEra(doc.createdAt)}
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-gray-900 group-hover:text-red-600 transition-colors truncate">
                      {doc.subject}
                    </p>

                    <div className="flex items-center justify-between mt-1.5 text-xs text-gray-500">
                      <span className="truncate">จาก: <strong className="font-medium text-gray-700">{doc.sender}</strong></span>
                      <span className="text-xs text-gray-400 group-hover:text-red-600 inline-flex items-center">
                        ดูรายละเอียด <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Card: การส่งพัสดุและเลข Tracking ล่าสุด */}
          <div className="bg-white rounded-2xl shadow-xs border border-gray-150 overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <Truck className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900 text-sm">การส่งพัสดุและเลข Tracking ล่าสุด</h2>
                  <p className="text-xs text-gray-400">บันทึกหมายเลขพัสดุสำหรับการติดตามตรวจสอบ</p>
                </div>
              </div>
              <Link 
                href="/tracking" 
                className="text-xs font-semibold text-red-600 hover:text-red-700 inline-flex items-center"
              >
                ดูทั้งหมด <ArrowRight className="w-3 h-3 ml-1" />
              </Link>
            </div>

            <div className="divide-y divide-gray-100">
              {loading ? (
                <div className="p-8 text-center text-sm text-gray-500">
                  <div className="animate-spin h-6 w-6 border-2 border-red-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                  กำลังโหลดข้อมูล...
                </div>
              ) : recentTrackings.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400">ยังไม่มีรายการบันทึกเลขพัสดุ</div>
              ) : (
                recentTrackings.map((item) => (
                  <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50/80 transition-colors">
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-mono text-sm font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
                          {item.tracking_number}
                        </span>
                        <span className="text-[11px] font-semibold bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full">
                          {item.courier}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900 font-medium truncate">{item.subject}</p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        ส่งถึง: <strong className="font-medium text-gray-700">{item.recipient_name}</strong>
                        {item.outgoing_running_number && ` • อ้างอิงหนังสือส่ง ${item.outgoing_running_number}`}
                      </p>
                    </div>

                    <a
                      href={`https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(item.tracking_number)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 py-1.5 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white text-xs font-semibold rounded-xl border border-red-200 hover:border-red-600 transition-all shadow-2xs flex-shrink-0"
                    >
                      ตรวจสถานะ
                      <ExternalLink className="w-3 h-3 ml-1.5" />
                    </a>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Right Column (4 cols): Statistic Panel (Inspired by user reference image) */}
        <div className="lg:col-span-4 space-y-7">
          
          {/* 1. Statistic Summary Card */}
          <div className="bg-white rounded-2xl border border-gray-150 p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">สถิติการปฏิบัติงาน</h3>
                <p className="text-xs text-gray-400">สัดส่วนงานสารบรรณวันนี้</p>
              </div>
              <div className="p-2 rounded-xl bg-red-50 text-red-600">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>

            {/* Total Today Big Counter */}
            <div className="bg-gradient-to-r from-red-50 to-rose-50 p-4 rounded-xl border border-red-100 flex items-center justify-between">
              <div>
                <span className="text-xs text-red-700 font-semibold">งานที่บันทึกวันนี้</span>
                <p className="text-3xl font-extrabold text-red-600">{todayTotalOps} <span className="text-sm font-normal text-red-700">รายการ</span></p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-red-400" />
            </div>

            {/* Breakdown Bars */}
            <div className="space-y-3 pt-1">
              {/* Incoming */}
              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-gray-600 flex items-center">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 mr-1.5"></span>
                    หนังสือรับ ({stats.incomingToday})
                  </span>
                  <span className="text-gray-900 font-bold">{incPercent}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${incPercent}%` }}></div>
                </div>
              </div>

              {/* Outgoing */}
              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-gray-600 flex items-center">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 mr-1.5"></span>
                    หนังสือส่ง ({stats.outgoingToday})
                  </span>
                  <span className="text-gray-900 font-bold">{outPercent}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="bg-red-500 h-2 rounded-full transition-all duration-500" style={{ width: `${outPercent}%` }}></div>
                </div>
              </div>

              {/* Tracking */}
              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-gray-600 flex items-center">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 mr-1.5"></span>
                    Tracking พัสดุ ({stats.trackingToday})
                  </span>
                  <span className="text-gray-900 font-bold">{trackPercent}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="bg-amber-500 h-2 rounded-full transition-all duration-500" style={{ width: `${trackPercent}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Thailand Post Quick Track & Trace Widget */}
          <div className="bg-white rounded-2xl border border-gray-150 p-6 shadow-xs space-y-4">
            <div>
              <div className="flex items-center space-x-2">
                <Truck className="w-4.5 h-4.5 text-red-600" />
                <h3 className="text-sm font-bold text-gray-900">ตรวจสถานะพัสดุด่วน</h3>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                ค้นหาหมายเลข Tracking ไปรษณีย์ไทย (Track & Trace)
              </p>
            </div>

            <form onSubmit={handleQuickTrack} className="space-y-3">
              <div className="relative">
                <input 
                  type="text"
                  placeholder="เช่น ED123456789TH"
                  value={quickTrackCode}
                  onChange={(e) => setQuickTrackCode(e.target.value)}
                  className="w-full uppercase font-mono text-xs pl-3.5 pr-9 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                />
                <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
              </div>

              <button
                type="submit"
                disabled={!quickTrackCode.trim()}
                className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-md shadow-red-200 transition-all flex items-center justify-center gap-1.5"
              >
                <span>ค้นหาสถานะพัสดุ</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

          {/* 3. Archive Health Card */}
          <div className="bg-white rounded-2xl border border-gray-150 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FolderCheck className="w-4.5 h-4.5 text-red-600" />
                <h3 className="text-sm font-bold text-gray-900">คลังจัดเก็บเอกสาร</h3>
              </div>
              <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                {archiveRate}% จัดเก็บแล้ว
              </span>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              เอกสารในระบบถูกจัดเก็บเข้าตู้/ชั้น/แฟ้มแล้วจำนวน <strong>{stats.archivedTotal}</strong> จาก <strong>{totalAllDocs}</strong> ฉบับ
            </p>

            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-red-600 h-2 rounded-full transition-all duration-500" style={{ width: `${archiveRate}%` }}></div>
            </div>

            <Link
              href="/archive"
              className="w-full inline-flex items-center justify-center py-2 px-3 bg-gray-50 hover:bg-red-50 text-gray-700 hover:text-red-700 rounded-xl text-xs font-semibold border border-gray-200 transition-all"
            >
              <Layers className="w-3.5 h-3.5 mr-1.5" />
              เข้าสู่ระบบคลังเอกสาร 3 ระดับ
            </Link>
          </div>

        </div>

      </div>
    </div>
  );
}
