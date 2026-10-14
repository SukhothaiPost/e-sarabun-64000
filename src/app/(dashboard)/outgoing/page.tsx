"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { SarabanDocument } from "@/types";
import { formatToBuddhistEra } from "@/lib/dateUtils";
import { FilePlus, Search, Filter } from "lucide-react";

export default function OutgoingDocumentsPage() {
  const [documents, setDocuments] = useState<SarabanDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const router = useRouter();

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const q = query(
          collection(db, "documents"),
          where("document_type", "==", "outgoing"),
          where("deleted", "==", false)
        );
        const snapshot = await getDocs(q);
        const docs = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            document_date: data.document_date?.toDate(),
            sent_date: data.sent_date?.toDate(),
            createdAt: data.createdAt?.toDate(),
            updatedAt: data.updatedAt?.toDate(),
          } as SarabanDocument;
        });
        
        docs.sort((a, b) => {
          const dateA = a.createdAt?.getTime() || 0;
          const dateB = b.createdAt?.getTime() || 0;
          return dateB - dateA;
        });
        
        setDocuments(docs);
      } catch (err) {
        console.error("Error fetching outgoing documents:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'registered': return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">สร้างเรื่องแล้ว</span>;
      case 'assigned': return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">มอบหมายแล้ว</span>;
      case 'in_progress': return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">กำลังดำเนินการ</span>;
      case 'completed': return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">ส่งแล้ว</span>;
      case 'archived': return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">จัดเก็บแล้ว</span>;
      default: return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  const filteredDocs = documents.filter(doc => 
    doc.subject.includes(searchTerm) || 
    doc.running_number.includes(searchTerm) ||
    doc.recipient.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ทะเบียนหนังสือส่ง</h1>
          <p className="text-sm text-gray-500">จัดการและติดตามหนังสือส่งออก</p>
        </div>
        <Link 
          href="/outgoing/new" 
          className="flex items-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
        >
          <FilePlus className="w-5 h-5 mr-2" />
          สร้างหนังสือส่ง
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
              placeholder="ค้นหาเลขที่ส่ง, เรื่อง, หรือผู้รับ..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">เลขที่ส่ง</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">วันที่ส่ง</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">เรื่อง</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">เรียน (ผู้รับ)</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tracking พัสดุ</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">สถานะ</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex justify-center mb-4">
                      <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    กำลังโหลดข้อมูล...
                  </td>
                </tr>
              ) : filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    ไม่พบข้อมูลหนังสือส่ง
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => router.push(`/outgoing/${doc.id}`)}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">{doc.running_number}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatToBuddhistEra(doc.sent_date)}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-md truncate">{doc.subject}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{doc.recipient}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {doc.tracking_number ? (
                        <span className="font-mono text-xs font-bold bg-blue-50 text-blue-700 px-2.5 py-1 rounded border border-blue-200">
                          {doc.tracking_number}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(doc.status)}</td>
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
