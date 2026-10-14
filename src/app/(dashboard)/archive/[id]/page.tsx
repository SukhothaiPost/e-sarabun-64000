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
  Plus,
  Camera,
  Maximize2,
  Image as ImageIcon,
  Upload
} from "lucide-react";
import { compressImage } from "@/lib/imageUtils";

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
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
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
    image_url: "",
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
          image_url: locData.image_url || "",
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

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingImage(true);
    setActionError("");
    try {
      const compressed = await compressImage(file, 1280, 1280, 0.8);
      setEditFormData(prev => ({ ...prev, image_url: compressed }));
    } catch (err: any) {
      setActionError("ไม่สามารถประมวลผลรูปภาพได้: " + err.message);
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setEditFormData(prev => ({ ...prev, image_url: "" }));
  };

  const handleQuickDeletePhoto = async () => {
    if (!location) return;
    if (!confirm("คุณต้องการลบรูปภาพตู้/ชั้นนี้ใช่หรือไม่?")) return;

    try {
      const locRef = doc(db, "archive_locations", location.id);
      await updateDoc(locRef, {
        image_url: "",
        updatedAt: serverTimestamp(),
      });
      setLocation({ ...location, image_url: "" });
      setEditFormData(prev => ({ ...prev, image_url: "" }));
      setActionSuccess("ลบรูปภาพเรียบร้อยแล้ว");
      setTimeout(() => setActionSuccess(""), 4000);
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการลบรูป: " + err.message);
    }
  };

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
        image_url: editFormData.image_url || "",
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
          <Link 
            href={`/archive?cabinet=${encodeURIComponent(location.cabinet)}&shelf=${encodeURIComponent(location.shelf)}`}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
            title={`กลับไปที่ ตู้ ${location.cabinet} / ชั้น ${location.shelf}`}
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-1.5 text-xs text-red-700 font-medium mb-1">
              <Link href={`/archive?cabinet=${encodeURIComponent(location.cabinet)}`} className="hover:underline">
                🏛️ ตู้ {location.cabinet}
              </Link>
              <span>/</span>
              <Link href={`/archive?cabinet=${encodeURIComponent(location.cabinet)}&shelf=${encodeURIComponent(location.shelf)}`} className="hover:underline">
                🪜 ชั้น {location.shelf}
              </Link>
              <span>/</span>
              <span className="font-bold text-gray-700">📁 แฟ้ม {location.folder}</span>
            </div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {location.folder_name || location.sequence || "แฟ้มเอกสาร"}
              </h1>
              <span className="px-3 py-1 bg-red-50 text-red-700 font-mono font-bold text-sm rounded-lg border border-red-200">
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
                <Edit className="w-4 h-4 mr-2 text-red-600" />
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
          <p className="text-base font-bold text-red-700 mt-1">{location.folder}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase">เอกสารในแฟ้มนี้</span>
          <p className="text-base font-bold text-gray-900 mt-1">{documents.length} ฉบับ</p>
        </div>
      </div>

      {/* Cabinet & Shelf Photo Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4 pb-2 border-b">
          <div className="flex items-center space-x-2">
            <Camera className="w-5 h-5 text-red-600" />
            <h2 className="text-base font-bold text-gray-900">รูปภาพตู้และชั้นจัดเก็บ</h2>
          </div>
          {location.image_url && (
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => setIsLightboxOpen(true)}
                className="flex items-center text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors border border-red-200"
              >
                <Maximize2 className="w-3.5 h-3.5 mr-1.5" />
                กดดูรูปขนาดเต็ม
              </button>
              {appUser?.role !== 'viewer' && (
                <button 
                  onClick={handleQuickDeletePhoto}
                  className="text-xs font-medium text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-colors border border-red-200"
                >
                  ลบรูปภาพ
                </button>
              )}
            </div>
          )}
        </div>

        {location.image_url ? (
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div 
              className="relative group cursor-pointer overflow-hidden rounded-xl border border-gray-200 shadow-sm bg-gray-50 max-w-md w-full sm:w-80 shrink-0" 
              onClick={() => setIsLightboxOpen(true)}
            >
              <img 
                src={location.image_url} 
                alt={`รูปภาพตู้ ${location.cabinet} ชั้น ${location.shelf}`}
                className="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-300" 
              />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-medium text-xs backdrop-blur-[2px]">
                <Maximize2 className="w-4 h-4 mr-1.5" />
                คลิกเพื่อดูรูปภาพขนาดใหญ่
              </div>
              <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm text-white px-2 py-0.5 rounded text-[11px] font-mono">
                ตู้ {location.cabinet} / ชั้น {location.shelf}
              </div>
            </div>

            <div className="space-y-3 flex-1">
              <div>
                <h3 className="text-sm font-bold text-gray-900">ตำแหน่งทางกายภาพ</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  ตู้เอกสารหมายเลข <strong>{location.cabinet}</strong> • ชั้นวาง <strong>{location.shelf}</strong>
                </p>
                <p className="text-xs font-mono text-red-700 bg-red-50 inline-block px-2 py-0.5 rounded border border-red-200 mt-1">
                  รหัสสถานที่: {location.location_code}
                </p>
              </div>

              <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100 space-y-1">
                <p className="font-semibold text-gray-700">💡 คำแนะนำการค้นหา:</p>
                <p>คลิกที่รูปภาพเพื่อเปิดดูภาพขยายความละเอียดสูง ช่วยให้เจ้าหน้าที่มองเห็นตู้เอกสารจริงและจุดจัดวางแฟ้มได้อย่างรวดเร็ว</p>
              </div>

              {appUser?.role !== 'viewer' && (
                <button 
                  onClick={() => setIsEditModalOpen(true)}
                  className="inline-flex items-center text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-lg shadow-xs transition-colors"
                >
                  <Edit className="w-3.5 h-3.5 mr-1.5 text-red-600" />
                  เปลี่ยนรูปภาพตู้/ชั้น
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center bg-gray-50/70 border border-dashed border-gray-300 rounded-xl">
            <Camera className="w-10 h-10 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700">ยังไม่มีรูปภาพตู้หรือชั้นจัดเก็บนี้</p>
            <p className="text-xs text-gray-400 mt-1 mb-4">
              เพิ่มรูปถ่ายตู้เอกสารจริง เพื่อให้เจ้าหน้าที่สังเกตและหยิบเอกสารได้รวดเร็ว
            </p>
            {appUser?.role !== 'viewer' && (
              <button 
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-md shadow-red-200 transition-colors"
              >
                <Camera className="w-4 h-4 mr-1.5" />
                ถ่ายรูป / เพิ่มรูปภาพตู้และชั้น
              </button>
            )}
          </div>
        )}
      </div>

      {/* Document List In This Archive */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-red-600" />
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
                <Edit className="w-5 h-5 mr-2 text-red-600" />
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
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="เช่น 1 หรือ ตู้ 1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ชั้น (Shelf)</label>
                  <input 
                    type="text" 
                    value={editFormData.shelf}
                    onChange={(e) => setEditFormData({ ...editFormData, shelf: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
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
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
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
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
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
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="เช่น แฟ้มหนังสือส่ง, คำสั่งแต่งตั้ง"
                  />
                </div>
              </div>

              {/* Photo Upload in Edit Modal */}
              <div className="border border-dashed border-gray-300 rounded-xl p-3 bg-gray-50/60">
                <label className="block text-xs font-semibold text-gray-800 mb-1 flex items-center">
                  <Camera className="w-3.5 h-3.5 mr-1.5 text-red-600" />
                  รูปภาพตู้ / ชั้นจัดเก็บ
                </label>

                {editFormData.image_url ? (
                  <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-white max-w-xs mt-2">
                    <img 
                      src={editFormData.image_url} 
                      alt="รูปภาพตู้/ชั้น" 
                      className="w-full h-36 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1 rounded-full shadow-md transition-colors"
                      title="ลบรูปภาพ"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 mt-2">
                    <label className="flex items-center justify-center border border-dashed border-red-300 hover:border-red-500 bg-red-50/40 hover:bg-red-50/80 rounded-lg p-3 cursor-pointer transition-colors group">
                      <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment"
                        onChange={handleImageFileChange} 
                        className="hidden" 
                        disabled={isProcessingImage}
                      />
                      <div className="flex items-center space-x-2 text-red-700 font-medium text-xs">
                        {isProcessingImage ? (
                          <>
                            <div className="h-3.5 w-3.5 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                            <span>กำลังประมวลผลรูป...</span>
                          </>
                        ) : (
                          <>
                            <Camera className="w-4 h-4 group-hover:scale-110 transition-transform" />
                            <span>ถ่ายรูป / อัปโหลดรูปตู้และชั้น</span>
                          </>
                        )}
                      </div>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-400">หรือ URL:</span>
                      <input 
                        type="url" 
                        value={editFormData.image_url} 
                        onChange={(e) => setEditFormData({ ...editFormData, image_url: e.target.value })} 
                        placeholder="https://..."
                        className="flex-1 px-2.5 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-red-50 p-2.5 rounded-lg border border-red-200 mt-2">
                <span className="block text-xs text-red-700 font-medium">ตัวอย่างรหัสสถานที่ใหม่</span>
                <span className="block text-sm font-mono font-bold text-red-900 mt-0.5">
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
                  className="flex items-center px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold shadow-md shadow-red-200 transition-colors disabled:opacity-50"
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

      {/* LIGHTBOX MODAL: ดูรูปภาพตู้/ชั้นขนาดเต็ม */}
      {isLightboxOpen && location?.image_url && (
        <div 
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div className="relative max-w-4xl w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            {/* Top Close Button & Title */}
            <div className="flex items-center justify-between w-full text-white mb-3 px-2">
              <div>
                <h3 className="text-base font-bold">
                  รูปภาพตู้ {location.cabinet} ชั้น {location.shelf}
                </h3>
                <p className="text-xs text-gray-300 font-mono">
                  {location.location_code} • {location.folder_name || location.sequence}
                </p>
              </div>
              <button 
                onClick={() => setIsLightboxOpen(false)}
                className="text-white hover:text-gray-300 bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors"
                title="ปิด"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* High-res image display */}
            <div className="bg-black/40 rounded-2xl overflow-hidden max-h-[80vh] flex items-center justify-center border border-white/20 shadow-2xl">
              <img 
                src={location.image_url} 
                alt={`ตู้ ${location.cabinet} ชั้น ${location.shelf}`}
                className="max-h-[78vh] max-w-full object-contain rounded-xl"
              />
            </div>

            <p className="text-xs text-gray-400 mt-2 text-center">
              กดที่พื้นที่ว่างหรือปุ่ม X เพื่อปิดหน้าต่าง
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
