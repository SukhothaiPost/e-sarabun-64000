"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { ArchiveLocation } from "@/types";
import { Archive, Plus, Folder, Search } from "lucide-react";

export default function ArchivePage() {
  const [locations, setLocations] = useState<ArchiveLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

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
          <p className="text-sm text-gray-500">จัดการพื้นที่จัดเก็บและตู้เอกสารตัวจริง</p>
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
              <div key={loc.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center">
                    <Folder className="h-5 w-5 text-blue-500 mr-2" />
                    <span className="font-semibold text-gray-900">{loc.location_code}</span>
                  </div>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p><span className="font-medium text-gray-700">ตู้:</span> {loc.cabinet} <span className="font-medium text-gray-700 ml-2">ชั้น:</span> {loc.shelf}</p>
                  <p><span className="font-medium text-gray-700">หมวดหมู่:</span> {loc.category}</p>
                  <p><span className="font-medium text-gray-700">แฟ้ม:</span> {loc.folder} <span className="font-medium text-gray-700 ml-2">ลำดับ:</span> {loc.sequence}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
