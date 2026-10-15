"use client";

import { useState, useEffect, use } from "react";
import { 
  doc, 
  getDoc, 
  updateDoc, 
  serverTimestamp, 
  collection, 
  getDocs, 
  setDoc,
  query,
  where
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/lib/contexts/AuthContext";
import { SarabanDocument, ArchiveLocation, DriveLink } from "@/types";
import { formatToBuddhistEra } from "@/lib/dateUtils";
import { POSTAL_BRANCHES } from "@/lib/constants";
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  HardDrive, 
  Archive, 
  Folder, 
  FolderCheck,
  Plus, 
  X, 
  ExternalLink, 
  Save, 
  AlertTriangle,
  FolderPlus,
  CheckCircle,
  Send,
  Inbox,
  ArrowRight,
  FileText
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function OutgoingDocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { appUser } = useAuth();
  
  const [document, setDocument] = useState<SarabanDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [archiveLocations, setArchiveLocations] = useState<ArchiveLocation[]>([]);

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    subject: "",
    document_date: "",
    sent_date: "",
    recipient: "",
    recipient_custom: "",
    recipient_is_custom: false,
    status: "registered",
    notes: "",
  });

  // Google Drive form state
  const [driveForm, setDriveForm] = useState({
    title: "",
    url: "",
    description: "",
  });

  // Archive modal state
  const [archiveMode, setArchiveMode] = useState<"select" | "create">("select");
  const [selectedArchiveId, setSelectedArchiveId] = useState("");
  const [newArchiveData, setNewArchiveData] = useState({
    cabinet: "1",
    shelf: "01",
    category: "งานสารบรรณ",
    folder: "001",
    sequence: "แฟ้มหนังสือส่ง",
  });

  const toInputDate = (date: any) => {
    if (!date) return "";
    const d = date instanceof Date ? date : (date?.toDate ? date.toDate() : new Date(date));
    if (isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const fetchDocument = async () => {
    try {
      const docRef = doc(db, "documents", resolvedParams.id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const loadedDoc = {
          ...data,
          document_date: data.document_date?.toDate ? data.document_date.toDate() : new Date(data.document_date),
          sent_date: data.sent_date?.toDate ? data.sent_date.toDate() : new Date(data.sent_date),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
        } as SarabanDocument;

        setDocument(loadedDoc);

        const isKnownRecipient = POSTAL_BRANCHES.includes(loadedDoc.recipient);
        setEditFormData({
          subject: loadedDoc.subject || "",
          document_date: toInputDate(loadedDoc.document_date),
          sent_date: toInputDate(loadedDoc.sent_date),
          recipient: isKnownRecipient ? loadedDoc.recipient : "อื่นๆ (ระบุเอง)",
          recipient_custom: isKnownRecipient ? "" : loadedDoc.recipient || "",
          recipient_is_custom: !isKnownRecipient,
          status: loadedDoc.status || "registered",
          notes: loadedDoc.notes || "",
        });
      }
    } catch (err) {
      console.error("Error fetching doc:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchArchiveLocations = async () => {
    try {
      const snap = await getDocs(collection(db, "archive_locations"));
      const locs: ArchiveLocation[] = [];
      snap.forEach(d => locs.push(d.data() as ArchiveLocation));
      locs.sort((a, b) => a.location_code.localeCompare(b.location_code));
      setArchiveLocations(locs);
    } catch (err) {
      console.error("Error fetching archive locations:", err);
    }
  };

  useEffect(() => {
    fetchDocument();
    fetchArchiveLocations();
  }, [resolvedParams.id]);

  // Handle Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!document) return;

    const finalRecipient = editFormData.recipient === "อื่นๆ (ระบุเอง)"
      ? editFormData.recipient_custom.trim()
      : editFormData.recipient;

    if (!editFormData.subject.trim()) {
      setActionError("กรุณาระบุเรื่อง");
      return;
    }
    if (!finalRecipient) {
      setActionError("กรุณาระบุผู้รับ");
      return;
    }

    setIsSubmitting(true);
    setActionError("");

    try {
      const docRef = doc(db, "documents", document.id);
      const updateData = {
        subject: editFormData.subject.trim(),
        document_date: editFormData.document_date ? new Date(editFormData.document_date) : null,
        sent_date: editFormData.sent_date ? new Date(editFormData.sent_date) : null,
        recipient: finalRecipient,
        status: editFormData.status,
        notes: editFormData.notes.trim(),
        updatedAt: serverTimestamp(),
        updated_by: appUser?.id || "",
      };

      await updateDoc(docRef, updateData);

      // Activity Log
      const logRef = doc(collection(db, "activity_logs"));
      await setDoc(logRef, {
        id: logRef.id,
        user_id: appUser?.id || "",
        user_name: appUser?.displayName || "เจ้าหน้าที่",
        action: "UPDATE_DOCUMENT",
        entity_type: "document",
        entity_id: document.id,
        new_value: { subject: editFormData.subject, recipient: finalRecipient },
        timestamp: serverTimestamp(),
      });

      setIsEditModalOpen(false);
      setActionSuccess("แก้ไขข้อมูลเรียบร้อยแล้ว");
      setTimeout(() => setActionSuccess(""), 4000);
      await fetchDocument();
    } catch (err: any) {
      console.error(err);
      setActionError("เกิดข้อผิดพลาดในการแก้ไข: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete
  const handleDelete = async () => {
    if (!document) return;
    setIsSubmitting(true);
    setActionError("");

    try {
      const docRef = doc(db, "documents", document.id);
      await updateDoc(docRef, {
        deleted: true,
        deleted_at: serverTimestamp(),
        deleted_by: appUser?.id || "",
        updatedAt: serverTimestamp(),
      });

      const logRef = doc(collection(db, "activity_logs"));
      await setDoc(logRef, {
        id: logRef.id,
        user_id: appUser?.id || "",
        user_name: appUser?.displayName || "เจ้าหน้าที่",
        action: "DELETE_DOCUMENT",
        entity_type: "document",
        entity_id: document.id,
        timestamp: serverTimestamp(),
      });

      router.push("/outgoing");
    } catch (err: any) {
      console.error(err);
      setActionError("เกิดข้อผิดพลาดในการลบ: " + err.message);
      setIsSubmitting(false);
    }
  };

  // Handle Add Google Drive Link
  const handleAddDriveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!document) return;

    if (!driveForm.title.trim()) {
      setActionError("กรุณาระบุชื่อไฟล์หรือหัวข้อเอกสาร");
      return;
    }
    if (!driveForm.url.trim()) {
      setActionError("กรุณาระบุลิงก์ Google Drive");
      return;
    }

    let validUrl = driveForm.url.trim();
    if (!validUrl.startsWith("http://") && !validUrl.startsWith("https://")) {
      validUrl = "https://" + validUrl;
    }

    setIsSubmitting(true);
    setActionError("");

    try {
      const newLink: DriveLink = {
        title: driveForm.title.trim(),
        url: validUrl,
        description: driveForm.description.trim(),
        created_by: appUser?.displayName || "เจ้าหน้าที่",
        created_at: new Date(),
      };

      const updatedLinks = [...(document.drive_links || []), newLink];

      const docRef = doc(db, "documents", document.id);
      await updateDoc(docRef, {
        drive_links: updatedLinks,
        updatedAt: serverTimestamp(),
        updated_by: appUser?.id || "",
      });

      const logRef = doc(collection(db, "activity_logs"));
      await setDoc(logRef, {
        id: logRef.id,
        user_id: appUser?.id || "",
        user_name: appUser?.displayName || "เจ้าหน้าที่",
        action: "ADD_DRIVE_LINK",
        entity_type: "document",
        entity_id: document.id,
        new_value: { title: newLink.title, url: newLink.url },
        timestamp: serverTimestamp(),
      });

      setDriveForm({ title: "", url: "", description: "" });
      setIsDriveModalOpen(false);
      setActionSuccess("เพิ่มลิงก์ Google Drive สำเร็จ");
      setTimeout(() => setActionSuccess(""), 4000);
      await fetchDocument();
    } catch (err: any) {
      console.error(err);
      setActionError("เกิดข้อผิดพลาดในการเพิ่มลิงก์: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Drive Link
  const handleDeleteDriveLink = async (indexToRemove: number) => {
    if (!document) return;
    if (!confirm("คุณต้องการลบลิงก์นี้ใช่หรือไม่?")) return;

    try {
      const updatedLinks = (document.drive_links || []).filter((_, i) => i !== indexToRemove);
      const docRef = doc(db, "documents", document.id);
      await updateDoc(docRef, {
        drive_links: updatedLinks,
        updatedAt: serverTimestamp(),
        updated_by: appUser?.id || "",
      });

      setActionSuccess("ลบลิงก์เรียบร้อยแล้ว");
      setTimeout(() => setActionSuccess(""), 4000);
      await fetchDocument();
    } catch (err: any) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการลบลิงก์: " + err.message);
    }
  };

  // Handle Save to Archive (การจัดเก็บเข้าแฟ้ม)
  const handleSaveArchive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!document) return;

    setIsSubmitting(true);
    setActionError("");

    try {
      let targetLocation: ArchiveLocation | null = null;

      if (archiveMode === "select") {
        if (!selectedArchiveId) {
          setActionError("กรุณาเลือกแฟ้มจัดเก็บ");
          setIsSubmitting(false);
          return;
        }
        targetLocation = archiveLocations.find(l => l.id === selectedArchiveId) || null;
      } else {
        if (!newArchiveData.folder.trim()) {
          setActionError("กรุณาระบุชื่อแฟ้ม");
          setIsSubmitting(false);
          return;
        }

        const p1 = newArchiveData.cabinet.replace(/^ตู้\s*/, "").trim() || "1";
        const p2Raw = newArchiveData.shelf.replace(/^ชั้น\s*/, "").trim();
        const p2 = !isNaN(Number(p2Raw)) && p2Raw ? p2Raw.padStart(2, '0') : (p2Raw || "01");
        const p3 = newArchiveData.category.trim() || "XX";
        const p4Raw = newArchiveData.folder.trim();
        const p4 = !isNaN(Number(p4Raw)) && p4Raw ? p4Raw.padStart(3, '0') : (p4Raw || "000");
        const p5Raw = newArchiveData.sequence.trim();
        const p5 = p5Raw || "ชื่อแฟ้ม";
        const locationCode = `${p1}-${p2}-${p3}-${p4}-${p5}`;

        const newLocRef = doc(collection(db, "archive_locations"));
        const newLoc: ArchiveLocation = {
          id: newLocRef.id,
          cabinet: newArchiveData.cabinet,
          shelf: newArchiveData.shelf,
          category: newArchiveData.category,
          folder: newArchiveData.folder,
          sequence: newArchiveData.sequence,
          folder_name: newArchiveData.sequence,
          location_code: locationCode,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        await setDoc(newLocRef, newLoc);
        targetLocation = newLoc;
        await fetchArchiveLocations();
      }

      if (!targetLocation) {
        throw new Error("ไม่พบข้อมูลจุดจัดเก็บ");
      }

      const docRef = doc(db, "documents", document.id);
      const archiveUpdate = {
        archive_location_id: targetLocation.id,
        archive_location_code: targetLocation.location_code,
        archive_cabinet: targetLocation.cabinet,
        archive_shelf: targetLocation.shelf,
        archive_folder: targetLocation.folder,
        archive_folder_name: targetLocation.folder_name || targetLocation.sequence,
        status: "archived",
        updatedAt: serverTimestamp(),
        updated_by: appUser?.id || "",
      };
      await updateDoc(docRef, archiveUpdate);

      const logRef = doc(collection(db, "activity_logs"));
      await setDoc(logRef, {
        id: logRef.id,
        user_id: appUser?.id || "",
        user_name: appUser?.displayName || "เจ้าหน้าที่",
        action: "ARCHIVE_DOCUMENT",
        entity_type: "document",
        entity_id: document.id,
        new_value: { location_code: targetLocation.location_code, folder: targetLocation.folder },
        timestamp: serverTimestamp(),
      });

      setIsArchiveModalOpen(false);
      setActionSuccess(`จัดเก็บเข้าแฟ้ม "${targetLocation.folder}" (${targetLocation.location_code}) สำเร็จ`);
      setTimeout(() => setActionSuccess(""), 4000);
      await fetchDocument();
    } catch (err: any) {
      console.error(err);
      setActionError("เกิดข้อผิดพลาดในการจัดเก็บเข้าแฟ้ม: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Remove from Archive
  const handleRemoveFromArchive = async () => {
    if (!document) return;
    if (!confirm("คุณต้องการนำเอกสารนี้ออกจากแฟ้มจัดเก็บใช่หรือไม่?")) return;

    try {
      const docRef = doc(db, "documents", document.id);
      await updateDoc(docRef, {
        archive_location_id: "",
        archive_location_code: "",
        archive_cabinet: "",
        archive_shelf: "",
        archive_folder: "",
        status: "registered",
        updatedAt: serverTimestamp(),
        updated_by: appUser?.id || "",
      });

      setActionSuccess("นำออกจากแฟ้มจัดเก็บเรียบร้อยแล้ว");
      setTimeout(() => setActionSuccess(""), 4000);
      await fetchDocument();
    } catch (err: any) {
      console.error(err);
      alert("เกิดข้อผิดพลาด: " + err.message);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'registered': return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">สร้างเรื่องแล้ว</span>;
      case 'assigned': return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">มอบหมายแล้ว</span>;
      case 'in_progress': return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">กำลังดำเนินการ</span>;
      case 'completed': return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">ส่งแล้ว</span>;
      case 'archived': return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">จัดเก็บแล้ว</span>;
      default: return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  if (loading) return <div className="p-12 text-center text-gray-500">กำลังโหลดข้อมูล...</div>;
  if (!document) return <div className="p-12 text-center text-red-500">ไม่พบเอกสาร</div>;

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
          <Link href="/outgoing" className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-gray-900">รายละเอียดหนังสือส่ง</h1>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-bold text-sm rounded-lg border border-emerald-200">
                เลขทะเบียนส่ง: {document.running_number}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">{document.subject}</p>
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
                แก้ไขข้อมูล
              </button>
              <button 
                onClick={() => setIsDeleteModalOpen(true)}
                className="flex items-center px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm font-medium text-red-600 hover:bg-red-100 shadow-sm transition-colors"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                ลบเอกสาร
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details (Col 1-2) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b flex items-center">
              <Send className="w-5 h-5 mr-2 text-emerald-600" />
              ข้อมูลเอกสารส่ง
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">เลขทะเบียนส่ง</p>
                <p className="text-base font-bold text-emerald-700 mt-1">{document.running_number}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">วันที่ลงในหนังสือ</p>
                <p className="text-base font-medium text-gray-900 mt-1">{formatToBuddhistEra(document.document_date)}</p>
              </div>
              <div className="sm:col-span-2 bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
                <p className="text-xs font-semibold text-emerald-600 uppercase">เรื่อง</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{document.subject}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-semibold text-gray-500 uppercase">เรียน (หน่วยงานผู้รับ)</p>
                <p className="text-base font-semibold text-blue-700 mt-1">{document.recipient}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">วันที่ส่งเอกสาร</p>
                <p className="text-base font-medium text-gray-900 mt-1">{formatToBuddhistEra(document.sent_date)}</p>
              </div>
              {document.tracking_number && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">เลข Tracking พัสดุ</p>
                  <p className="text-base font-mono font-bold text-red-700 mt-1">
                    {document.tracking_number} {document.courier && `(${document.courier})`}
                  </p>
                </div>
              )}
            </div>
            
            {document.notes && (
              <div className="mt-6 pt-4 border-t">
                <p className="text-xs font-semibold text-gray-500 uppercase">หมายเหตุ</p>
                <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg border border-gray-100">{document.notes}</p>
              </div>
            )}
          </div>

          {/* การจัดส่งและเลข Tracking */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-2 border-b">
              <h2 className="text-lg font-bold text-gray-900 flex items-center">
                <Send className="w-5 h-5 mr-2 text-red-600" />
                การจัดส่งและเลข Tracking
              </h2>
              {!document.tracking_number && (
                <Link
                  href="/tracking/new"
                  className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-3 py-2 rounded-lg transition-colors flex items-center shadow-xs self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  บันทึกเลข Tracking
                </Link>
              )}
            </div>

            {document.tracking_number ? (
              <div className="p-4 rounded-xl border border-red-200 bg-red-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2.5 py-0.5 rounded font-bold bg-red-600 text-white">
                      {document.courier || "EMS"}
                    </span>
                    <span className="font-mono font-bold text-lg text-red-700">
                      {document.tracking_number}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    ส่งถึง: <strong className="text-gray-900">{document.recipient}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(document.tracking_number)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-3.5 py-2 rounded-lg shadow-xs whitespace-nowrap transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    เช็คพัสดุไปรษณีย์ไทย
                  </a>
                  <Link
                    href="/tracking"
                    className="inline-flex items-center justify-center text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 px-3 py-2 rounded-lg shadow-xs whitespace-nowrap transition-colors"
                  >
                    ดูรายการ Tracking
                  </Link>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <p className="text-sm font-medium text-gray-700">ยังไม่มีการบันทึกเลข Tracking สำหรับหนังสือส่งนี้</p>
                <p className="text-xs text-gray-500 mt-1 mb-3">สามารถบันทึกเลขพัสดุในเมนู "บันทึกเลข Tracking" เพื่อติดตามการจัดส่ง</p>
                <Link
                  href="/tracking/new"
                  className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition-colors shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  บันทึกเลข Tracking
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Info (Col 3) */}
        <div className="space-y-6">
          {/* Status Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-sm font-bold text-gray-500 uppercase mb-3">สถานะเอกสาร</h2>
            <div className="flex items-center justify-between">
              <div>{getStatusBadge(document.status)}</div>
              <span className="text-xs text-gray-400">
                ปรับปรุง: {formatToBuddhistEra(document.updatedAt || document.createdAt)}
              </span>
            </div>
          </div>

          {/* Google Drive Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <div className="flex items-center space-x-2">
                <HardDrive className="w-5 h-5 text-blue-600" />
                <h2 className="text-base font-bold text-gray-900">Google Drive</h2>
              </div>
              {appUser?.role !== 'viewer' && (
                <button 
                  onClick={() => {
                    setActionError("");
                    setDriveForm({ title: "", url: "", description: "" });
                    setIsDriveModalOpen(true);
                  }}
                  className="flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  เพิ่มลิงก์
                </button>
              )}
            </div>
            
            {document.drive_links && document.drive_links.length > 0 ? (
              <div className="space-y-2.5">
                {document.drive_links.map((link, idx) => (
                  <div key={idx} className="flex items-start justify-between p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/30 transition-all group">
                    <a 
                      href={link.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="flex items-start flex-1 min-w-0 pr-2"
                    >
                      <HardDrive className="w-4 h-4 text-blue-500 mr-2.5 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-blue-700 truncate group-hover:underline flex items-center">
                          {link.title}
                          <ExternalLink className="w-3 h-3 ml-1.5 opacity-60 inline shrink-0" />
                        </p>
                        {link.description && (
                          <p className="text-xs text-gray-500 truncate mt-0.5">{link.description}</p>
                        )}
                      </div>
                    </a>
                    {appUser?.role !== 'viewer' && (
                      <button 
                        onClick={() => handleDeleteDriveLink(idx)}
                        className="text-gray-400 hover:text-red-600 p-1 rounded transition-colors"
                        title="ลบลิงก์"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-5 text-gray-400 text-sm">
                <HardDrive className="w-8 h-8 mx-auto mb-1.5 opacity-40" />
                ยังไม่มีการแนบลิงก์ Google Drive
              </div>
            )}
          </div>

          {/* Archive Card (การจัดเก็บเข้าแฟ้ม) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <div className="flex items-center space-x-2">
                <FolderCheck className="w-5 h-5 text-red-600" />
                <h2 className="text-base font-bold text-gray-900">การจัดเก็บเข้าแฟ้ม</h2>
              </div>
            </div>
            
            {document.archive_location_id || document.archive_location_code ? (
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-3.5">
                  <div className="flex items-start space-x-3">
                    <Folder className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-red-900">
                        {document.archive_folder || "แฟ้มจัดเก็บ"}
                      </p>
                      <p className="text-xs font-mono font-semibold text-red-700 mt-0.5">
                        รหัส: {document.archive_location_code || document.archive_location_id}
                      </p>
                      {(document.archive_cabinet || document.archive_shelf) && (
                        <p className="text-xs text-red-600 mt-1">
                          {document.archive_cabinet} • {document.archive_shelf}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {appUser?.role !== 'viewer' && (
                  <div className="flex space-x-2 pt-1">
                    <button 
                      onClick={() => {
                        setActionError("");
                        setIsArchiveModalOpen(true);
                      }}
                      className="flex-1 text-xs font-semibold py-2 px-3 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      เปลี่ยนแฟ้ม
                    </button>
                    <button 
                      onClick={handleRemoveFromArchive}
                      className="text-xs font-semibold py-2 px-3 border border-red-200 text-red-600 rounded-md hover:bg-red-50 transition-colors"
                    >
                      นำออก
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-5 text-gray-500 text-sm">
                <Archive className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                <p className="mb-3 text-gray-500">ยังไม่ได้จัดเก็บเข้าแฟ้ม</p>
                {appUser?.role !== 'viewer' && (
                  <button 
                    onClick={() => {
                      setActionError("");
                      setIsArchiveModalOpen(true);
                    }}
                    className="w-full inline-flex items-center justify-center bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg text-sm shadow-md shadow-red-200 transition-colors"
                  >
                    <FolderPlus className="w-4 h-4 mr-2" />
                    จัดเก็บเข้าแฟ้ม
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL: แก้ไขข้อมูล */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <Edit className="w-5 h-5 mr-2 text-blue-600" />
                แก้ไขข้อมูลหนังสือส่ง ({document.running_number})
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  เรื่อง <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  required
                  value={editFormData.subject}
                  onChange={(e) => setEditFormData({ ...editFormData, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    วันที่ลงในหนังสือ
                  </label>
                  <input 
                    type="date" 
                    value={editFormData.document_date}
                    onChange={(e) => setEditFormData({ ...editFormData, document_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    วันที่ส่งเอกสาร
                  </label>
                  <input 
                    type="date" 
                    value={editFormData.sent_date}
                    onChange={(e) => setEditFormData({ ...editFormData, sent_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  เรียน (หน่วยงานผู้รับ) <span className="text-red-500">*</span>
                </label>
                <select 
                  value={editFormData.recipient}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditFormData({
                      ...editFormData,
                      recipient: val,
                      recipient_is_custom: val === "อื่นๆ (ระบุเอง)",
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {POSTAL_BRANCHES.map(branch => (
                    <option key={branch} value={branch}>{branch}</option>
                  ))}
                </select>
              </div>

              {editFormData.recipient_is_custom && (
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                  <label className="block text-sm font-medium text-amber-900 mb-1">
                    ระบุชื่อหน่วยงานผู้รับ <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    required
                    value={editFormData.recipient_custom}
                    onChange={(e) => setEditFormData({ ...editFormData, recipient_custom: e.target.value })}
                    placeholder="เช่น บริษัท ขนส่ง จำกัด, ผู้จัดการธนาคาร"
                    className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  สถานะเอกสาร
                </label>
                <select 
                  value={editFormData.status}
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="registered">สร้างเรื่องแล้ว</option>
                  <option value="in_progress">กำลังดำเนินการ</option>
                  <option value="completed">ส่งแล้ว</option>
                  <option value="archived">จัดเก็บแล้ว</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  หมายเหตุ
                </label>
                <textarea 
                  rows={3}
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
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
                  className="flex items-center px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSubmitting ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ยืนยันการลบเอกสาร */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 text-red-600 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">ยืนยันการลบหนังสือส่ง</h3>
            </div>
            
            <p className="text-sm text-gray-600 mb-2">
              คุณต้องการลบหนังสือส่งเลขทะเบียน <span className="font-bold text-gray-900">{document.running_number}</span> เรื่อง <span className="font-bold text-gray-900">{document.subject}</span> ใช่หรือไม่?
            </p>
            <p className="text-xs text-red-500 mb-6">
              * ข้อมูลจะถูกนำออกจากรายการทะเบียนหนังสือส่งและหน้าต่าง ๆ ในระบบ
            </p>

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

      {/* MODAL: เพิ่มลิงก์ Google Drive */}
      {isDriveModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <HardDrive className="w-5 h-5 mr-2 text-blue-600" />
                เพิ่มลิงก์ Google Drive
              </h3>
              <button 
                onClick={() => setIsDriveModalOpen(false)}
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

            <form onSubmit={handleAddDriveLink} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อไฟล์ / หัวข้อเอกสาร <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="เช่น หนังสือต้นฉบับสแกน.pdf, บันทึกข้อความ"
                  value={driveForm.title}
                  onChange={(e) => setDriveForm({ ...driveForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ลิงก์ URL Google Drive <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="https://drive.google.com/file/d/..."
                  value={driveForm.url}
                  onChange={(e) => setDriveForm({ ...driveForm, url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">คัดลอกลิงก์แชร์จาก Google Drive มาวางที่นี่</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  คำอธิบายเพิ่มเติม (ถ้ามี)
                </label>
                <input 
                  type="text" 
                  placeholder="เช่น ฉบับลงนามแล้ว"
                  value={driveForm.description}
                  onChange={(e) => setDriveForm({ ...driveForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button 
                  type="button"
                  onClick={() => setIsDriveModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {isSubmitting ? "กำลังบันทึก..." : "เพิ่มลิงก์"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: การจัดเก็บเข้าแฟ้ม */}
      {isArchiveModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <FolderCheck className="w-5 h-5 mr-2 text-red-600" />
                การจัดเก็บเอกสารเข้าแฟ้ม
              </h3>
              <button 
                onClick={() => setIsArchiveModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Tabs */}
            <div className="flex border-b border-gray-200 mt-4">
              <button
                type="button"
                onClick={() => { setArchiveMode("select"); setActionError(""); }}
                className={`flex-1 py-2 text-sm font-medium border-b-2 text-center transition-colors ${
                  archiveMode === "select"
                    ? "border-red-600 text-red-600 font-bold"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                เลือกแฟ้มที่มีอยู่ ({archiveLocations.length})
              </button>
              <button
                type="button"
                onClick={() => { setArchiveMode("create"); setActionError(""); }}
                className={`flex-1 py-2 text-sm font-medium border-b-2 text-center transition-colors ${
                  archiveMode === "create"
                    ? "border-red-600 text-red-600 font-bold"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                + สร้างแฟ้มใหม่ทันที
              </button>
            </div>

            {actionError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {actionError}
              </div>
            )}

            <form onSubmit={handleSaveArchive} className="mt-4 space-y-4">
              {archiveMode === "select" ? (
                <div>
                  {archiveLocations.length === 0 ? (
                    <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                      <Folder className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600 mb-2">ยังไม่มีแฟ้มจัดเก็บในระบบ</p>
                      <button
                        type="button"
                        onClick={() => setArchiveMode("create")}
                        className="text-xs font-bold text-red-600 hover:text-red-700 underline"
                      >
                        กดที่นี่เพื่อสร้างแฟ้มใหม่
                      </button>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        เลือกแฟ้มจัดเก็บ <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={selectedArchiveId}
                        onChange={(e) => setSelectedArchiveId(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      >
                        <option value="">-- กรุณาเลือกแฟ้ม --</option>
                        {archiveLocations.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            [{loc.location_code}] {loc.folder} ({loc.cabinet} - {loc.shelf})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">ตู้ (Cabinet)</label>
                      <input 
                        type="text" 
                        value={newArchiveData.cabinet}
                        onChange={(e) => setNewArchiveData({ ...newArchiveData, cabinet: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        placeholder="เช่น 1 หรือ ตู้ 1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">ชั้น (Shelf)</label>
                      <input 
                        type="text" 
                        value={newArchiveData.shelf}
                        onChange={(e) => setNewArchiveData({ ...newArchiveData, shelf: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        placeholder="เช่น 01 หรือ 1"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">หมวดหมู่/งาน (Category)</label>
                    <input 
                      type="text" 
                      value={newArchiveData.category}
                      onChange={(e) => setNewArchiveData({ ...newArchiveData, category: e.target.value })}
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
                        value={newArchiveData.folder}
                        onChange={(e) => setNewArchiveData({ ...newArchiveData, folder: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        placeholder="เช่น 001"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">ชื่อแฟ้ม (Folder Name) <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        required
                        value={newArchiveData.sequence}
                        onChange={(e) => setNewArchiveData({ ...newArchiveData, sequence: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        placeholder="เช่น แฟ้มหนังสือส่ง 2567"
                      />
                    </div>
                  </div>

                  <div className="bg-red-50 p-2.5 rounded-lg border border-red-200 mt-2">
                    <span className="block text-xs text-red-700 font-medium">ตัวอย่างรหัสสถานที่ (Location Code)</span>
                    <span className="block text-sm font-mono font-bold text-red-900 mt-0.5">
                      {(() => {
                        const p1 = newArchiveData.cabinet.replace(/^ตู้\s*/, "").trim() || "1";
                        const p2Raw = newArchiveData.shelf.replace(/^ชั้น\s*/, "").trim();
                        const p2 = !isNaN(Number(p2Raw)) && p2Raw ? p2Raw.padStart(2, '0') : (p2Raw || "01");
                        const p3 = newArchiveData.category.trim() || "XX";
                        const p4Raw = newArchiveData.folder.trim();
                        const p4 = !isNaN(Number(p4Raw)) && p4Raw ? p4Raw.padStart(3, '0') : (p4Raw || "000");
                        const p5Raw = newArchiveData.sequence.trim();
                        const p5 = p5Raw || "ชื่อแฟ้ม";
                        return `${p1}-${p2}-${p3}-${p4}-${p5}`;
                      })()}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button 
                  type="button"
                  onClick={() => setIsArchiveModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting || (archiveMode === "select" && archiveLocations.length === 0)}
                  className="flex items-center px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold shadow-md shadow-red-200 transition-colors disabled:opacity-50"
                >
                  <FolderCheck className="w-4 h-4 mr-2" />
                  {isSubmitting ? "กำลังบันทึก..." : "บันทึกเข้าแฟ้ม"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
