"use client";

import { useState, useEffect, use } from "react";
import { doc, getDoc, updateDoc, serverTimestamp, collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/lib/contexts/AuthContext";
import { SarabanDocument } from "@/types";
import { formatToBuddhistEra } from "@/lib/dateUtils";
import { ArrowLeft, Edit, Link as LinkIcon, HardDrive, Archive } from "lucide-react";
import Link from "next/link";

export default function IncomingDocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
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
            document_date: data.document_date?.toDate(),
            received_date: data.received_date?.toDate(),
            createdAt: data.createdAt?.toDate(),
            updatedAt: data.updatedAt?.toDate(),
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
          <Link href="/incoming" className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">รายละเอียดหนังสือรับ</h1>
            <p className="text-sm text-gray-500">{document.running_number}</p>
          </div>
        </div>
        <div className="flex space-x-2">
          {appUser?.role !== 'viewer' && (
            <button className="flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 bg-white">
              <Edit className="w-4 h-4 mr-2" />
              แก้ไขข้อมูล
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b">ข้อมูลเอกสาร</h2>
            
            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
              <div>
                <p className="text-sm font-medium text-gray-500">เลขที่หนังสือ (ภายนอก)</p>
                <p className="text-base text-gray-900 mt-1">{document.document_number || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">วันที่ลงในหนังสือ</p>
                <p className="text-base text-gray-900 mt-1">{formatToBuddhistEra(document.document_date)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm font-medium text-gray-500">เรื่อง</p>
                <p className="text-lg font-medium text-blue-700 mt-1">{document.subject}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm font-medium text-gray-500">จาก</p>
                <p className="text-base text-gray-900 mt-1">{document.sender}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">วันที่รับเอกสาร</p>
                <p className="text-base text-gray-900 mt-1">{formatToBuddhistEra(document.received_date)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">ความเร่งด่วน / ชั้นความลับ</p>
                <div className="flex space-x-2 mt-1">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${document.urgency !== 'ปกติ' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>{document.urgency}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${document.confidentiality !== 'ปกติ' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>{document.confidentiality}</span>
                </div>
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
            <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b">สถานะและการจัดการ</h2>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500">สถานะปัจจุบัน</p>
                <p className="text-base font-bold text-gray-900 mt-1">{document.status}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-500">ผู้รับผิดชอบ</p>
                <p className="text-base text-gray-900 mt-1">{document.responsible_user_id ? "ตรวจสอบในฐานข้อมูล" : "ยังไม่ระบุ"}</p>
              </div>
              
              {appUser?.role !== 'viewer' && (
                <div className="pt-4 border-t">
                  <button className="w-full bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium py-2 px-4 rounded-md transition-colors text-sm">
                    อัปเดตสถานะ
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h2 className="text-lg font-bold text-gray-900">Google Drive</h2>
              {appUser?.role !== 'viewer' && (
                <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">เพิ่มลิงก์</button>
              )}
            </div>
            
            {document.drive_links && document.drive_links.length > 0 ? (
              <div className="space-y-3">
                {document.drive_links.map((link, idx) => (
                  <a key={idx} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center p-3 border border-gray-200 rounded-md hover:bg-gray-50">
                    <HardDrive className="w-5 h-5 text-blue-500 mr-3" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{link.title}</p>
                      <p className="text-xs text-gray-500 truncate">{link.description}</p>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500 text-sm">ยังไม่มีไฟล์แนบ</div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h2 className="text-lg font-bold text-gray-900">การจัดเก็บต้นฉบับ</h2>
            </div>
            
            {document.archive_location_id ? (
              <div className="flex items-start">
                <Archive className="w-5 h-5 text-gray-500 mr-3 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">A-02-HR-014-037</p>
                  <p className="text-xs text-gray-500 mt-1">ตู้ A, ชั้น 2, งานบุคคล</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500 text-sm">
                <p className="mb-2">ยังไม่ได้จัดเก็บต้นฉบับ</p>
                {appUser?.role !== 'viewer' && (
                  <button className="text-blue-600 hover:text-blue-800 font-medium">นำเข้าแฟ้มจัดเก็บ</button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
