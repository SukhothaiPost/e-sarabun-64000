"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { SarabanDocument } from "@/types";
import { formatToBuddhistEra } from "@/lib/dateUtils";
import { Search, FileText, Inbox, Send, ArrowRight, X } from "lucide-react";
import { useRouter } from "next/navigation";

export default function SearchPage() {
  const [allDocuments, setAllDocuments] = useState<SarabanDocument[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<SarabanDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const router = useRouter();

  // Load active documents once for fast and responsive search
  useEffect(() => {
    const fetchAllDocs = async () => {
      try {
        const q = query(collection(db, "documents"));
        const snapshot = await getDocs(q);
        const docs = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            document_date: data.document_date?.toDate ? data.document_date.toDate() : new Date(data.document_date),
            received_date: data.received_date?.toDate ? data.received_date.toDate() : new Date(data.received_date),
            sent_date: data.sent_date?.toDate ? data.sent_date.toDate() : new Date(data.sent_date),
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
          } as SarabanDocument;
        }).filter(doc => doc.deleted === false);

        docs.sort((a, b) => {
          const dateA = a.createdAt?.getTime() || 0;
          const dateB = b.createdAt?.getTime() || 0;
          return dateB - dateA;
        });

        setAllDocuments(docs);
      } catch (err) {
        console.error("Error loading documents for search:", err);
      } finally {
        setInitialLoading(false);
      }
    };

    fetchAllDocs();
  }, []);

  const executeSearch = (searchTerm: string) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      setFilteredDocuments([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);

    const results = allDocuments.filter(d => 
      (d.subject && d.subject.toLowerCase().includes(term)) ||
      (d.running_number && d.running_number.toLowerCase().includes(term)) ||
      (d.document_number && d.document_number.toLowerCase().includes(term)) ||
      (d.sender && d.sender.toLowerCase().includes(term)) ||
      (d.recipient && d.recipient.toLowerCase().includes(term)) ||
      (d.notes && d.notes.toLowerCase().includes(term)) ||
      (d.tracking_number && d.tracking_number.toLowerCase().includes(term)) ||
      (d.archive_location_code && d.archive_location_code.toLowerCase().includes(term)) ||
      (d.archive_folder && d.archive_folder.toLowerCase().includes(term))
    );

    setFilteredDocuments(results);
    setLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(keyword);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setKeyword(val);
    executeSearch(val);
  };

  const handleClear = () => {
    setKeyword("");
    setFilteredDocuments([]);
    setHasSearched(false);
  };

  const getDocTypeBadge = (type: string) => {
    if (type === 'incoming') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
          <Inbox className="w-3.5 h-3.5 mr-1" />
          หนังสือรับ
        </span>
      );
    }
    if (type === 'outgoing') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <Send className="w-3.5 h-3.5 mr-1" />
          หนังสือส่ง
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">
        <FileText className="w-3.5 h-3.5 mr-1" />
        เอกสาร
      </span>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ค้นหาเอกสาร</h1>
        <p className="text-sm text-gray-500">สืบค้นเอกสารหนังสือรับและหนังสือส่งในระบบทั้งหมด</p>
      </div>

      {/* Main Single Search Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-6 w-6 text-gray-400" />
            </div>
            <input
              type="text"
              autoFocus
              value={keyword}
              onChange={handleInputChange}
              className="block w-full pl-12 pr-28 py-3.5 border-2 border-gray-200 rounded-xl text-base focus:border-red-500 focus:ring-4 focus:ring-red-100 transition-all placeholder-gray-400"
              placeholder="พิมพ์คำค้นหา: เรื่อง, เลขที่ลงรับ, เลขทะเบียนส่ง, เลขที่หนังสือภายนอก, ผู้ส่ง, ผู้รับ..."
            />
            <div className="absolute inset-y-0 right-2 flex items-center space-x-1">
              {keyword && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
              <button 
                type="submit"
                disabled={loading}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-5 rounded-lg text-sm transition-colors shadow-md shadow-red-200 disabled:opacity-70 flex items-center"
              >
                {loading ? (
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  "ค้นหา"
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Search Results */}
      {initialLoading ? (
        <div className="p-12 text-center text-gray-500 bg-white rounded-xl border border-gray-200">
          <div className="h-8 w-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          กำลังเตรียมฐานข้อมูลค้นหา...
        </div>
      ) : hasSearched ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-base font-bold text-gray-800">
              ผลการค้นหาสำหรับ &ldquo;<span className="text-red-600">{keyword}</span>&rdquo;
            </h2>
            <span className="text-sm text-gray-500">พบ {filteredDocuments.length} รายการ</span>
          </div>

          {filteredDocuments.length === 0 ? (
            <div className="p-12 text-center text-gray-500 bg-white rounded-xl border border-gray-200">
              <Search className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-base font-medium text-gray-700">ไม่พบเอกสารที่ตรงกับคำค้นหา</p>
              <p className="text-xs text-gray-400 mt-1">ลองค้นหาด้วยคำอื่น เช่น เรื่อง, เลขที่หนังสือ, หรือชื่อหน่วยงาน</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-100">
              {filteredDocuments.map(doc => (
                <div 
                  key={doc.id} 
                  onClick={() => router.push(`/${doc.document_type}/${doc.id}`)}
                  className="p-5 hover:bg-red-50/30 cursor-pointer transition-colors group"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center space-x-3">
                      {getDocTypeBadge(doc.document_type)}
                      <span className="font-mono font-bold text-red-700 text-base">
                        {doc.running_number}
                      </span>
                      {doc.document_number && doc.document_number !== doc.running_number && (
                        <span className="text-xs text-gray-500 font-mono">
                          (เลขที่: {doc.document_number})
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatToBuddhistEra(doc.document_date || doc.sent_date || doc.received_date)}
                    </span>
                  </div>

                  <p className="text-base font-semibold text-gray-900 group-hover:text-red-600 transition-colors mb-2">
                    {doc.subject}
                  </p>

                  <div className="flex flex-wrap items-center text-xs text-gray-600 gap-y-1 gap-x-4">
                    <span>
                      <strong className="text-gray-500 font-medium">
                        {doc.document_type === 'incoming' ? 'จาก: ' : 'เรียน: '}
                      </strong>
                      {doc.document_type === 'incoming' ? doc.sender : doc.recipient}
                    </span>
                    {doc.tracking_number && (
                      <span className="font-mono text-red-700 font-semibold bg-red-50 border border-red-100 px-2 py-0.5 rounded">
                        Tracking: {doc.tracking_number}
                      </span>
                    )}
                    {doc.archive_folder && (
                      <span className="text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded">
                        แฟ้ม: {doc.archive_folder}
                      </span>
                    )}
                    <span className="ml-auto inline-flex items-center text-red-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      ดูรายละเอียด
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="p-12 text-center text-gray-400 bg-white rounded-xl border border-gray-200">
          <Search className="h-10 w-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-600">พิมพ์คำค้นหาเพื่อเริ่มต้นค้นหาเอกสาร</p>
          <p className="text-xs text-gray-400 mt-1">สามารถค้นหาได้ทั้งเลขทะเบียนรับ, เลขทะเบียนส่ง, เรื่อง, หน่วยงาน, เลข Tracking, หรือชื่อแฟ้ม</p>
        </div>
      )}
    </div>
  );
}
