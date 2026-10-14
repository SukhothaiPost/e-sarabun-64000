"use client";

import { useState, useEffect, use } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/lib/contexts/AuthContext";
import { SarabanDocument } from "@/types";
import { formatToBuddhistEra } from "@/lib/dateUtils";
import { ArrowLeft, HardDrive, Archive } from "lucide-react";
import Link from "next/link";

export default function OutgoingDocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { appUser } = useAuth();
  const [document, setDocument] = useState<SarabanDocument | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDoc = async () => {
      try {
        const docRef = doc(db, "documents", resolvedParams.id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setDocument({
            ...data,
            document_date: data.document_date?.toDate ? data.document_date.toDate() : new Date(data.document_date),
            sent_date: data.sent_date?.toDate ? data.sent_date.toDate() : new Date(data.sent_date),
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
          } as SarabanDocument);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDoc();
  }, [resolvedParams.id]);

  if (loading) return <div className="p-12 text-center text-gray-500">กำลังโหลดข้อมูล...</div>;
  if (!document) return <div className="p-12 text-center text-red-500">ไม่พบเอกสาร</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/outgoing" className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">รายละเอียดหนังสือส่ง</h1>
            <p className="text-sm text-gray-500">{document.running_number}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b">ข้อมูลเอกสาร</h2>
            
            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
              <div>
                <p className="text-sm font-medium text-gray-500">เลขทะเบียนส่ง</p>
                <p className="text-base font-bold text-emerald-700 mt-1">{document.running_number}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">วันที่ลงในหนังสือ</p>
                <p className="text-base text-gray-900 mt-1">{formatToBuddhistEra(document.document_date)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm font-medium text-gray-500">เรื่อง</p>
                <p className="text-lg font-medium text-gray-900 mt-1">{document.subject}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm font-medium text-gray-500">เรียน (หน่วยงานผู้รับ)</p>
                <p className="text-base font-semibold text-blue-700 mt-1">{document.recipient}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">วันที่ส่งเอกสาร</p>
                <p className="text-base text-gray-900 mt-1">{formatToBuddhistEra(document.sent_date)}</p>
              </div>
            </div>
            
            {document.notes && (
              <div className="mt-6 pt-4 border-t">
                <p className="text-sm font-medium text-gray-500">หมายเหตุ</p>
                <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{document.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b">สถานะเอกสาร</h2>
            <div>
              <p className="text-sm font-medium text-gray-500">สถานะปัจจุบัน</p>
              <p className="text-base font-bold text-gray-900 mt-1">{document.status}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b">การจัดเก็บต้นฉบับ</h2>
            {document.archive_location_id ? (
              <div className="flex items-start">
                <Archive className="w-5 h-5 text-gray-500 mr-3 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">มีจุดจัดเก็บในคลังเอกสาร</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">ยังไม่ได้จัดเก็บเข้าคลังเอกสาร</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
