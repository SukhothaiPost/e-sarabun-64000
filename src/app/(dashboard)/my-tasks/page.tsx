"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/lib/contexts/AuthContext";
import { SarabanDocument } from "@/types";
import { formatToBuddhistEra } from "@/lib/dateUtils";
import { CheckCircle, Clock, Search } from "lucide-react";

export default function MyTasksPage() {
  const { appUser } = useAuth();
  const [documents, setDocuments] = useState<SarabanDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!appUser) return;

    const fetchMyTasks = async () => {
      try {
        const q = query(
          collection(db, "documents"),
          where("responsible_user_id", "==", appUser.id),
          where("deleted", "==", false)
        );
        const snapshot = await getDocs(q);
        const docs = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            document_date: data.document_date?.toDate(),
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
        console.error("Error fetching my tasks:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMyTasks();
  }, [appUser]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-orange-100 text-orange-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const pendingTasks = documents.filter(doc => ['assigned', 'in_progress'].includes(doc.status));
  const completedTasks = documents.filter(doc => doc.status === 'completed');

  const activeDocs = pendingTasks.filter(doc => 
    doc.subject.includes(searchTerm) || 
    doc.running_number.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">งานของฉัน</h1>
        <p className="text-sm text-gray-500">เอกสารที่รอการดำเนินการจากคุณ</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center">
          <div className="p-4 rounded-full bg-orange-100 text-orange-600 mr-4">
            <Clock className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">งานรอดำเนินการ</p>
            <p className="text-3xl font-bold text-gray-900">{pendingTasks.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center">
          <div className="p-4 rounded-full bg-green-100 text-green-600 mr-4">
            <CheckCircle className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">งานที่เสร็จสิ้นแล้ว</p>
            <p className="text-3xl font-bold text-gray-900">{completedTasks.length}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="relative max-w-md w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="ค้นหางานของฉัน..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="p-12 text-center text-gray-500">กำลังโหลดงานของคุณ...</div>
          ) : activeDocs.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Clock className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-900">ไม่มีงานรอดำเนินการ</p>
              <p className="mt-1">คุณจัดการงานทุกอย่างเรียบร้อยแล้ว ยอดเยี่ยมมาก!</p>
            </div>
          ) : (
            activeDocs.map(doc => (
              <div 
                key={doc.id} 
                onClick={() => router.push(`/${doc.document_type}/${doc.id}`)}
                className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(doc.status)}`}>
                    {doc.status === 'assigned' ? 'รอดำเนินการ' : 'กำลังดำเนินการ'}
                  </span>
                  <span className="text-sm text-gray-500">{formatToBuddhistEra(doc.createdAt)}</span>
                </div>
                <h3 className="text-lg font-medium text-blue-700">{doc.running_number}</h3>
                <p className="text-base text-gray-900 mt-1 line-clamp-2">{doc.subject}</p>
                <div className="mt-3 flex items-center text-sm text-gray-500">
                  <span className="capitalize mr-4">ประเภท: {doc.document_type}</span>
                  <span className={`px-2 rounded text-xs font-medium ${doc.urgency !== 'ปกติ' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                    ความเร่งด่วน: {doc.urgency}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
