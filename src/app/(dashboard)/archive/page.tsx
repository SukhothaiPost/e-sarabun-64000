"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { ArchiveLocation } from "@/types";
import { Archive, Plus, Folder, Search, Camera, X, Maximize2 } from "lucide-react";

export default function ArchivePage() {
  const [locations, setLocations] = useState<ArchiveLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [previewLocation, setPreviewLocation] = useState<ArchiveLocation | null>(null);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const q = query(collection(db, "archive_locations"));
        const snap = await getDocs(q);
        const locs: ArchiveLocation[] = [];
        snap.forEach(doc => {
          locs.push(doc.data() as ArchiveLocation);
        });
        
        // Sort by location code
        locs.sort((a, b) => a.location_code.localeCompare(b.location_code));
        
        setLocations(locs);
      } catch (err) {
        console.error("Error fetching archives:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLocations();
  }, []);

  const filteredLocations = locations.filter(loc => 
    loc.location_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    loc.cabinet.includes(searchTerm) ||
    loc.category.includes(searchTerm) ||
    loc.folder.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">จัดการคลังเอกสาร</h1>
          <p className="text-sm text-gray-500">จัดการพื้นที่จัดเก็บและตู้เอกสารตัวจริง พร้อมรูปถ่ายตู้และชั้นวาง</p>
        </div>
        <Link 
          href="/archive/new" 
          className="flex items-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          เพิ่มจุดจัดเก็บ
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="relative max-w-md w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="ค้นหารหัสสถานที่, ตู้, แฟ้ม..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500">
             <div className="flex justify-center mb-4">
                <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
             </div>
             กำลังโหลดข้อมูล...
          </div>
        ) : filteredLocations.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Archive className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-900">ไม่พบจุดจัดเก็บเอกสาร</p>
            <p className="mt-1">ยังไม่มีการเพิ่มจุดจัดเก็บในระบบ หรือไม่พบผลการค้นหา</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {filteredLocations.map(loc => (
              <div 
                key={loc.id} 
                className="border border-gray-200 rounded-xl p-5 hover:shadow-lg hover:border-purple-300 hover:bg-purple-50/20 transition-all block group bg-white flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <Link href={`/archive/${loc.id}`} className="flex items-center min-w-0 flex-1">
                      <Folder className="h-5 w-5 text-purple-600 mr-2 shrink-0" />
                      <span className="font-mono font-bold text-gray-900 group-hover:text-purple-700 transition-colors truncate">
                        {loc.location_code}
                      </span>
                    </Link>

                    {loc.image_url && (
                      <button
                        onClick={() => setPreviewLocation(loc)}
                        className="inline-flex items-center text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2 py-0.5 rounded-md transition-colors shrink-0 ml-2 shadow-2xs"
                        title="กดดูรูปถ่ายตู้/ชั้น"
                      >
                        <Camera className="w-3.5 h-3.5 mr-1 text-purple-600" />
                        ดูรูปตู้/ชั้น
                      </button>
                    )}
                  </div>

                  {/* Thumbnail if photo exists */}
                  {loc.image_url && (
                    <div 
                      onClick={() => setPreviewLocation(loc)}
                      className="mb-3 rounded-lg overflow-hidden border border-gray-100 cursor-pointer relative group/img h-28 bg-gray-50"
                    >
                      <img 
                        src={loc.image_url} 
                        alt={`ตู้ ${loc.cabinet} ชั้น ${loc.shelf}`}
                        className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-black/25 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium backdrop-blur-[1px]">
                        <Maximize2 className="w-4 h-4 mr-1" />
                        คลิกดูรูปขยาย
                      </div>
                    </div>
                  )}

                  <Link href={`/archive/${loc.id}`} className="block text-sm text-gray-600 space-y-1.5">
                    <p><span className="font-medium text-gray-500">ตู้:</span> {loc.cabinet} <span className="font-medium text-gray-500 ml-2">ชั้น:</span> {loc.shelf}</p>
                    <p><span className="font-medium text-gray-500">หมวดหมู่:</span> {loc.category}</p>
                    <p><span className="font-medium text-gray-500">เลขที่แฟ้ม:</span> {loc.folder} <span className="font-medium text-gray-500 ml-2">ชื่อแฟ้ม:</span> <span className="font-semibold text-gray-900">{loc.folder_name || loc.sequence}</span></p>
                  </Link>
                </div>

                <Link 
                  href={`/archive/${loc.id}`}
                  className="flex items-center text-xs font-semibold text-purple-600 group-hover:text-purple-700 mt-3 pt-3 border-t border-gray-100 justify-between"
                >
                  <span>ดูรายละเอียดและเอกสารในแฟ้ม</span>
                  <span className="text-base font-bold transition-transform group-hover:translate-x-1">→</span>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* LIGHTBOX MODAL: ดูรูปภาพตู้/ชั้น */}
      {previewLocation && previewLocation.image_url && (
        <div 
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewLocation(null)}
        >
          <div className="relative max-w-4xl w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between w-full text-white mb-3 px-2">
              <div>
                <h3 className="text-base font-bold">
                  รูปภาพตู้ {previewLocation.cabinet} ชั้น {previewLocation.shelf}
                </h3>
                <p className="text-xs text-gray-300 font-mono">
                  {previewLocation.location_code} • {previewLocation.folder_name || previewLocation.sequence}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Link
                  href={`/archive/${previewLocation.id}`}
                  className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition-colors"
                  onClick={() => setPreviewLocation(null)}
                >
                  ดูรายละเอียดแฟ้มนี้ →
                </Link>
                <button 
                  onClick={() => setPreviewLocation(null)}
                  className="text-white hover:text-gray-300 bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors"
                  title="ปิด"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="bg-black/40 rounded-2xl overflow-hidden max-h-[80vh] flex items-center justify-center border border-white/20 shadow-2xl">
              <img 
                src={previewLocation.image_url} 
                alt={`ตู้ ${previewLocation.cabinet} ชั้น ${previewLocation.shelf}`}
                className="max-h-[78vh] max-w-full object-contain rounded-xl"
              />
            </div>

            <p className="text-xs text-gray-400 mt-2 text-center">
              กดที่พื้นที่ว่างหรือปุ่ม X เพื่อปิด
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
