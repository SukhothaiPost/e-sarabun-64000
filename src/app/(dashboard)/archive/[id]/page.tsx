"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  setDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/lib/contexts/AuthContext";
import { ArchiveLocation, SarabanDocument } from "@/types";
import { formatToBuddhistEra } from "@/lib/dateUtils";
import { 
  ArrowLeft, 
  Folder, 
  Edit, 
  Trash2, 
  FileText, 
  Inbox, 
  Send, 
  ExternalLink, 
  CheckCircle, 
  AlertTriangle, 
  Save, 
  X,
  Plus
} from "lucide-react";

export default function ArchiveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { appUser } = useAuth();

  const [location, setLocation] = useState<ArchiveLocation | null>(null);
  const [documents, setDocuments] = useState<SarabanDocument[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    cabinet: "1",
    shelf: "01",
    category: "",
    folder: "",
    sequence: "",
  });

  const fetchArchiveDetail = async () => {
    try {
      const locRef = doc(db, "archive_locations", resolvedParams.id);
      const locSnap = await getDoc(locRef);
      if (locSnap.exists()) {
        const locData = { id: locSnap.id, ...locSnap.data() } as ArchiveLocation;
        setLocation(locData);

        setEditFormData({
          cabinet: locData.cabinet || "1",
          shelf: locData.shelf || "01",
          category: locData.category || "",
          folder: locData.folder || "",
          sequence: locData.folder_name || locData.sequence || "",
        });

        // Fetch documents archived in this location
        const docsQuery = query(
          collection(db, "documents"),
          where("deleted", "==", false)
        );
        const docsSnap = await getDocs(docsQuery);
        const docsInFolder: SarabanDocument[] = [];
        docsSnap.forEach(d => {
          const docData = d.data();
          if (
            docData.archive_location_id === locData.id || 
            (docData.archive_location_code && docData.archive_location_code === locData.location_code)
          ) {
            docsInFolder.push({
              ...docData,
              document_date: docData.document_date?.toDate ? docData.document_date.toDate() : new Date(docData.document_date),
              received_date: docData.received_date?.toDate ? docData.received_date.toDate() : new Date(docData.received_date),
              sent_date: docData.sent_date?.toDate ? docData.sent_date.toDate() : new Date(docData.sent_date),
              createdAt: docData.createdAt?.toDate ? docData.createdAt.toDate() : new Date(docData.createdAt),
            } as SarabanDocument);
          }
        });

        docsInFolder.sort((a, b) => {
          const dateA = a.createdAt?.getTime() || 0;
          const dateB = b.createdAt?.getTime() || 0;
          return dateB - dateA;
        });

        setDocuments(docsInFolder);
      }
    } catch (err) {
      console.error("Error loading archive detail:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchiveDetail();
  }, [resolvedParams.id]);

  const generateNewLocationCode = () => {
    const p1 = editFormData.cabinet.replace(/^ตู้\s*/, "").trim() || "1";
    const p2Raw = editFormData.shelf.replace(/^ชั้น\s*/, "").trim();
    const p2 = !isNaN(Number(p2Raw)) && p2Raw ? p2Raw.padStart(2, '0') : (p2Raw || "01");
    const p3 = editFormData.category.trim() || "XX";
    const p4Raw = editFormData.folder.trim();
    const p4 = !isNaN(Number(p4Raw)) && p4Raw ? p4Raw.padStart(3, '0') : (p4Raw || "000");
    const p5Raw = editFormData.sequence.trim();
    const p5 = p5Raw || "ชื่อแฟ้ม";
    return `${p1}-${p2}-${p3}-${p4}-${p5}`;
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location) return;

    if (!editFormData.folder.trim()) {
      setActionError("กรุณาระบุเลขที่แฟ้ม");
      return;
    }
    if (!editFormData.sequence.trim()) {
      setActionError("กรุณาระบุชื่อแฟ้ม");
      return;
    }

    setIsSubmitting(true);
    setActionError("");

    try {
      const locRef = doc(db, "archive_locations", location.id);
      const newCode = generateNewLocationCode();

      const updateData = {
        cabinet: editFormData.cabinet.trim(),
        shelf: editFormData.shelf.trim(),
        category: editFormData.category.trim(),
        folder: editFormData.folder.trim(),
        sequence: editFormData.sequence.trim(),
        folder_name: editFormData.sequence.trim(),
        location_code: newCode,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(locRef, updateData);

      // Sync updated archive info to all documents currently in this archive
      for (const d of documents) {
        try {
          const docRef = doc(db, "documents", d.id);
          await updateDoc(docRef, {
            archive_location_code: newCode,
            archive_cabinet: updateData.cabinet,
            archive_shelf: updateData.shelf,
            archive_folder: updateData.folder,
            archive_folder_name: updateData.folder_name,
            updatedAt: serverTimestamp(),
          });
        } catch (syncErr) {
          console.warn("Could not sync doc archive code:", syncErr);
        }
      }

      setIsEditModalOpen(false);
      setActionSuccess("แก้ไขข้อมูลแฟ้มจัดเก็บเรียบร้อยแล้ว");
      setTimeout(() => setActionSuccess(""), 4000);
      await fetchArchiveDetail();
    } catch (err: any) {
      console.error(err);
      setActionError("เกิดข้อผิดพลาดในการแก้ไข: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!location) return;
    setIsSubmitting(true);
    setActionError("");

    try {
      // Clear archive info from all documents in this location
      for (const d of documents) {
        try {
          const docRef = doc(db, "documents", d.id);
          await updateDoc(docRef, {
            archive_location_id: "",
            archive_location_code: "",
            archive_cabinet: "",
            archive_shelf: "",
            archive_folder: "",
            archive_folder_name: "",
            status: "registered",
            updatedAt: serverTimestamp(),
          });
        } catch (syncErr) {
          console.warn("Could not clear doc archive:", syncErr);
        }
      }

      // Delete archive location
      const locRef = doc(db, "archive_locations", location.id);
      await deleteDoc(locRef);

      router.push("/archive");
    } catch (err: any) {
      console.error(err);
      setActionError("เกิดข้อผิดพลาดในการลบ: " + err.message);
      setIsSubmitting(false);
    }
  };

  const handleRemoveDocFromArchive = async (docId: string, docSubject: string) => {
    if (!confirm(`ต้องการนำเอกสาร "${docSubject}" ออกจากแฟ้มนี้ใช่หรือไม่?`)) return;

    try {
      const docRef = doc(db, "documents", docId);
      await updateDoc(docRef, {
        archive_location_id: "",
        archive_location_code: "",
        archive_cabinet: "",
        archive_shelf: "",
        archive_folder: "",
        archive_folder_name: "",
        status: "registered",
        updatedAt: serverTimestamp(),
        updated_by: appUser?.id || "",
      });

      setActionSuccess("นำเอกสารออกจากแฟ้มเรียบร้อยแล้ว");
      setTimeout(() => setActionSuccess(""), 4000);
      await fetchArchiveDetail();
    } catch (err: any) {
      console.error(err);
      alert("เกิดข้อผิดพลาด: " + err.message);
    }
  };

  if (loading) return <div className="p-12 text-center text-gray-500">กำลังโหลดข้อมูลคลังเอกสาร...</div>;
  if (!location) return <div className="p-12 text-center text-red-500">ไม่พบจุดจัดเก็บเอกสาร</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Toast Alert */}
      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg flex items-center space-x-2">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="text-sm font-medium">{actionSuccess}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <Link href="/archive" className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {location.folder_name || location.sequence || "แฟ้มเอกสาร"}
              </h1>
              <span className="px-3 py-1 bg-purple-50 text-purple-700 font-mono font-bold text-sm rounded-lg border border-purple-200">
                {location.location_code}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              ตู้: {location.cabinet} • ชั้น: {location.shelf} • หมวดหมู่: {location.category} • เลขที่แฟ้ม: {location.folder}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {appUser?.role !== 'viewer' && (
            <>
              <button 
                onClick={() => setIsEditModalOpen(true)}
                className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors"
              >
                <Edit className="w-4 h-4 mr-2 text-blue-600" />
                แก้ไขข้อมูลแฟ้ม
              </button>
              <button 
                onClick={() => setIsDeleteModalOpen(true)}
                className="flex items-center px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm font-medium text-red-600 hover:bg-red-100 shadow-sm transition-colors"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                ลบแฟ้มจัดเก็บ
              </button>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase">ตำแหน่งตู้และชั้น</span>
          <p className="text-base font-bold text-gray-900 mt-1">{location.cabinet} / {location.shelf}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase">หมวดหมู่/งาน</span>
          <p className="text-base font-bold text-gray-900 mt-1">{location.category || '-'}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase">เลขที่แฟ้ม</span>
          <p className="text-base font-bold text-purple-700 mt-1">{location.folder}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase">เอกสารในแฟ้มนี้</span>
          <p className="text-base font-bold text-blue-700 mt-1">{documents.length} ฉบับ</p>
        </div>
      </div>

      {/* Document List In This Archive */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-purple-600" />
            รายการเอกสารที่จัดเก็บในแฟ้มนี้ ({documents.length} ฉบับ)
          </h2>
        </div>

        {documents.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Folder className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-base font-medium text-gray-700">ยังไม่มีเอกสารในแฟ้มนี้</p>
            <p className="text-xs text-gray-400 mt-1">
              สามารถจัดเก็บเอกสารเข้าแฟ้มนี้ได้จากหน้ารายละเอียดหนังสือรับหรือหนังสือส่ง
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ประเภท</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">เลขที่หนังสือ</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">วันที่</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">เรื่อง</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">จาก / เรียน</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {doc.document_type === 'incoming' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          <Inbox className="w-3 h-3 mr-1" />
                          หนังสือรับ
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Send className="w-3 h-3 mr-1" />
                          หนังสือส่ง
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold font-mono text-blue-700">
                      <Link href={`/${doc.document_type}/${doc.id}`} className="hover:underline">
                        {doc.running_number}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatToBuddhistEra(doc.document_date || doc.sent_date || doc.received_date)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate font-medium">
                      {doc.subject}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {doc.document_type === 'incoming' ? doc.sender : doc.recipient}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                      <Link 
                        href={`/${doc.document_type}/${doc.id}`} 
                        className="text-blue-600 hover:text-blue-800"
                      >
                        เปิดดู
                      </Link>
                      {appUser?.role !== 'viewer' && (
                        <button 
                          onClick={() => handleRemoveDocFromArchive(doc.id, doc.subject)}
                          className="text-red-500 hover:text-red-700"
                        >
                          นำออกจากแฟ้ม
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: แก้ไขข้อมูลแฟ้มจัดเก็บ */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <Edit className="w-5 h-5 mr-2 text-purple-600" />
                แก้ไขข้อมูลแฟ้มจัดเก็บ
              </h3>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {actionError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ตู้ (Cabinet)</label>
                  <input 
                    type="text" 
                    value={editFormData.cabinet}
                    onChange={(e) => setEditFormData({ ...editFormData, cabinet: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                    placeholder="เช่น 1 หรือ ตู้ 1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ชั้น (Shelf)</label>
                  <input 
                    type="text" 
                    value={editFormData.shelf}
                    onChange={(e) => setEditFormData({ ...editFormData, shelf: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                    placeholder="เช่น 01 หรือ 1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">หมวดหมู่/งาน (Category)</label>
                <input 
                  type="text" 
                  value={editFormData.category}
                  onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                  placeholder="เช่น งานสารบรรณ, การเงิน, บุคคล"
                />
                <p className="text-[11px] text-gray-500 mt-0.5">* แสดง Fulltext เต็มตามชื่อหมวดหมู่ในรหัสสถานที่</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">เลขที่แฟ้ม (Folder No.) <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    required
                    value={editFormData.folder}
                    onChange={(e) => setEditFormData({ ...editFormData, folder: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                    placeholder="เช่น 001"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ชื่อแฟ้ม (Folder Name) <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    required
                    value={editFormData.sequence}
                    onChange={(e) => setEditFormData({ ...editFormData, sequence: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                    placeholder="เช่น แฟ้มหนังสือส่ง, คำสั่งแต่งตั้ง"
                  />
                </div>
              </div>

              <div className="bg-purple-50 p-2.5 rounded-lg border border-purple-200 mt-2">
                <span className="block text-xs text-purple-700 font-medium">ตัวอย่างรหัสสถานที่ใหม่</span>
                <span className="block text-sm font-mono font-bold text-purple-900 mt-0.5">
                  {generateNewLocationCode()}
                </span>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button 
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSubmitting ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ยืนยันการลบแฟ้มจัดเก็บ */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 text-red-600 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">ยืนยันการลบแฟ้มจัดเก็บ</h3>
            </div>
            
            <p className="text-sm text-gray-600 mb-2">
              คุณต้องการลบแฟ้ม <span className="font-bold text-gray-900">{location.folder_name || location.sequence}</span> (รหัส: <span className="font-mono font-bold text-gray-900">{location.location_code}</span>) ใช่หรือไม่?
            </p>

            {documents.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 mb-4">
                ⚠️ มีเอกสารจัดเก็บอยู่ในแฟ้มนี้ <strong>{documents.length} ฉบับ</strong> ระบบจะนำเอกสารทั้งหมดออกจากแฟ้มนี้โดยอัตโนมัติ
              </div>
            )}

            {actionError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                {actionError}
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button 
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button 
                type="button"
                disabled={isSubmitting}
                onClick={handleDelete}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "กำลังลบ..." : "ยืนยันการลบ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
