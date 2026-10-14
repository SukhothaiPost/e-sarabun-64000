"use client";

import { useState } from "react";
import { collection, query, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { SarabanDocument } from "@/types";
import { formatToBuddhistEra } from "@/lib/dateUtils";
import { Search, Filter, FileText, Inbox, Send } from "lucide-react";
import { useRouter } from "next/navigation";

export default function SearchPage() {
  const [documents, setDocuments] = useState<SarabanDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Search Filters State
  const [filters, setFilters] = useState({
    keyword: "",
    document_type: "",
    status: "",
    year: new Date().getFullYear() + 543 + "",
  });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // In a real production app with Algolia or Typesense, this would be a full-text search.
      // With Firestore, we have to fetch and filter in memory for complex queries or use limited queries.
      // For this MVP, we fetch recent documents and filter.
      const q = query(collection(db, "documents")/*, orderBy("createdAt", "desc")*/);
      const snapshot = await getDocs(q);
      
      let docs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          document_date: data.document_date?.toDate(),
          received_date: data.received_date?.toDate(),
          sent_date: data.sent_date?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as SarabanDocument;
      }).filter(doc => doc.deleted === false);

      // Apply filters in memory
      if (filters.document_type) {
        docs = docs.filter(d => d.document_type === filters.document_type);
      }
      
      if (filters.status) {
        docs = docs.filter(d => d.status === filters.status);
      }
      
      if (filters.year) {
        const beYear = parseInt(filters.year);
        docs = docs.filter(d => {
          const docDate = d.document_date || d.sent_date || d.received_date || d.createdAt;
          const docYear = docDate ? (docDate.getFullYear() + 543) : null;
          return docYear === beYear || (d.running_number && d.running_number.endsWith(`/${filters.year}`));
        });
      }

      if (filters.keyword) {
        const lowerKeyword = filters.keyword.toLowerCase();
        docs = docs.filter(d => 
          d.subject.toLowerCase().includes(lowerKeyword) ||
          d.running_number.toLowerCase().includes(lowerKeyword) ||
          d.document_number.toLowerCase().includes(lowerKeyword) ||
          d.sender.toLowerCase().includes(lowerKeyword) ||
          d.recipient.toLowerCase().includes(lowerKeyword)
        );
      }

      setDocuments(docs);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const getDocTypeIcon = (type: string) => {
    if (type === 'incoming') return <Inbox className="w-5 h-5 text-blue-500" />;
    if (type === 'outgoing') return <Send className="w-5 h-5 text-green-500" />;
    return <FileText className="w-5 h-5 text-gray-500" />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ค้นหาเอกสาร</h1>
        <p className="text-sm text-gray-500">สืบค้นเอกสารทั้งหมดในระบบ</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">คำค้นหา</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={filters.keyword}
                  onChange={e => setFilters({...filters, keyword: e.target.value})}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="เรื่อง, เลขที่หนังสือ, ผู้ส่ง, ผู้รับ..."
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ประเภทเอกสาร</label>
              <select 
                value={filters.document_type}
                onChange={e => setFilters({...filters, document_type: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">ทั้งหมด</option>
                <option value="incoming">หนังสือรับ</option>
                <option value="outgoing">หนังสือส่ง</option>
                <option value="internal">หนังสือภายใน</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">สถานะ</label>
              <select 
                value={filters.status}
                onChange={e => setFilters({...filters, status: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">ทั้งหมด</option>
                <option value="registered">ลงทะเบียนแล้ว/สร้างเรื่องแล้ว</option>
                <option value="assigned">มอบหมายแล้ว</option>
                <option value="in_progress">กำลังดำเนินการ</option>
                <option value="completed">ดำเนินการแล้ว/ส่งแล้ว</option>
                <option value="archived">จัดเก็บแล้ว</option>
                <option value="closed">ปิดเรื่อง</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ปี พ.ศ.</label>
              <select 
                value={filters.year}
                onChange={e => setFilters({...filters, year: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">ทั้งหมด</option>
                <option value="2569">2569</option>
                <option value="2568">2568</option>
                <option value="2567">2567</option>
              </select>
            </div>
            
            <div className="flex items-end">
              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-70 flex justify-center items-center"
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    ค้นหา
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {documents.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h3 className="font-medium text-gray-700">ผลการค้นหา ({documents.length} รายการ)</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {documents.map(doc => (
              <div 
                key={doc.id} 
                onClick={() => router.push(`/${doc.document_type}/${doc.id}`)}
                className="p-4 hover:bg-blue-50 cursor-pointer transition-colors flex items-start gap-4"
              >
                <div className="mt-1 flex-shrink-0">
                  {getDocTypeIcon(doc.document_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-blue-700 truncate">{doc.running_number}</p>
                    <span className="text-xs text-gray-500">{formatToBuddhistEra(doc.createdAt)}</span>
                  </div>
                  <p className="text-base font-medium text-gray-900 mb-1">{doc.subject}</p>
                  <div className="flex items-center text-sm text-gray-500 gap-4">
                    <span>{doc.document_type === 'incoming' ? `จาก: ${doc.sender}` : `เรียน: ${doc.recipient}`}</span>
                    <span>สถานะ: {doc.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
