"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { collection, query, where, getDocs, doc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/lib/contexts/AuthContext";
import { PostalTracking, ArchiveLocation, THAIPOST_ORGANIZATIONS } from "@/types";
import { formatToBuddhistEra } from "@/lib/dateUtils";
import { COURIER_OPTIONS } from "@/lib/constants";
import { 
  Truck, 
  Plus, 
  Search, 
  ExternalLink, 
  Package, 
  Edit, 
  Trash2, 
  X, 
  Save, 
  AlertTriangle, 
  CheckCircle,
  FolderCheck,
  FolderPlus,
  Folder
} from "lucide-react";

export default function TrackingListPage() {
  const { appUser } = useAuth();
  const [trackings, setTrackings] = useState<PostalTracking[]>([]);
  const [archiveLocations, setArchiveLocations] = useState<ArchiveLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedTracking, setSelectedTracking] = useState<PostalTracking | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // Quick Archive Modal state (สำหรับเจ้าของงานมาเลือกเข้าแฟ้ม)
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [archiveTargetTracking, setArchiveTargetTracking] = useState<PostalTracking | null>(null);
  const [archiveMode, setArchiveMode] = useState<"select" | "create">("select");
  const [selectedArchiveId, setSelectedArchiveId] = useState("");
  const [newArchiveData, setNewArchiveData] = useState({
    cabinet: "1",
    shelf: "01",
    category: "งานสารบรรณ",
    folder: "001",
    sequence: "แฟ้มหนังสือรับ",
  });
  const [filterTab, setFilterTab] = useState<'all' | 'unarchived' | 'archived'>('all');

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    tracking_number: "",
    courier: "EMS",
    courier_custom: "",
    courier_is_custom: false,
    subject: "",
    recipient_name: "",
    recipient_custom: "",
    recipient_is_custom: false,
    sent_date: "",
    archive_location_id: "",
    notes: "",
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

  const fetchTrackings = async () => {
    try {
      const q = query(
        collection(db, "postal_trackings"),
        where("deleted", "==", false)
      );
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          sent_date: data.sent_date?.toDate ? data.sent_date.toDate() : new Date(data.sent_date),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        } as PostalTracking;
      });

      list.sort((a, b) => {
        const dateA = a.sent_date?.getTime() || 0;
        const dateB = b.sent_date?.getTime() || 0;
        return dateB - dateA;
      });

      setTrackings(list);
    } catch (err) {
      console.error("Error fetching postal trackings:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchArchiveLocations = async () => {
    try {
      const snap = await getDocs(collection(db, "archive_locations"));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ArchiveLocation));
      list.sort((a, b) => a.location_code.localeCompare(b.location_code));
      setArchiveLocations(list);
    } catch (err) {
      console.error("Error fetching archive locations:", err);
    }
  };

  useEffect(() => {
    fetchTrackings();
    fetchArchiveLocations();
  }, []);

  const openEditModal = (item: PostalTracking) => {
    setSelectedTracking(item);
    setActionError("");

    const isKnownCourier = COURIER_OPTIONS.includes(item.courier);
    const isKnownRecipient = (THAIPOST_ORGANIZATIONS as readonly string[]).includes(item.recipient_name);

    setEditFormData({
      tracking_number: item.tracking_number,
      courier: isKnownCourier ? item.courier : "อื่นๆ (ระบุเอง)",
      courier_custom: isKnownCourier ? "" : item.courier,
      courier_is_custom: !isKnownCourier,
      subject: item.subject || "",
      recipient_name: isKnownRecipient ? item.recipient_name : "อื่นๆ (ระบุเอง)",
      recipient_custom: isKnownRecipient ? "" : item.recipient_name,
      recipient_is_custom: !isKnownRecipient,
      sent_date: toInputDate(item.sent_date),
      archive_location_id: item.archive_location_id || "",
      notes: item.notes || "",
    });

    setIsEditModalOpen(true);
  };

  const openDeleteModal = (item: PostalTracking) => {
    setSelectedTracking(item);
    setActionError("");
    setIsDeleteModalOpen(true);
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTracking) return;

    const finalCourier = editFormData.courier === "อื่นๆ (ระบุเอง)"
      ? editFormData.courier_custom.trim()
      : editFormData.courier;

    const finalRecipient = editFormData.recipient_name === "อื่นๆ (ระบุเอง)"
      ? editFormData.recipient_custom.trim()
      : editFormData.recipient_name;

    if (!editFormData.tracking_number.trim()) {
      setActionError("กรุณาระบุเลข Tracking");
      return;
    }
    if (!finalCourier) {
      setActionError("กรุณาระบุผู้ให้บริการ");
      return;
    }
    if (!finalRecipient) {
      setActionError("กรุณาระบุผู้รับ");
      return;
    }

    setIsSubmitting(true);
    setActionError("");

    try {
      const selectedLoc = archiveLocations.find(l => l.id === editFormData.archive_location_id);
      const trackingRef = doc(db, "postal_trackings", selectedTracking.id);
      const updateData: any = {
        tracking_number: editFormData.tracking_number.trim().toUpperCase(),
        courier: finalCourier,
        subject: editFormData.subject.trim(),
        recipient_name: finalRecipient,
        sent_date: editFormData.sent_date ? new Date(editFormData.sent_date) : new Date(),
        notes: editFormData.notes.trim(),
        archive_location_id: editFormData.archive_location_id || "",
        archive_location_code: selectedLoc?.location_code || "",
        archive_cabinet: selectedLoc?.cabinet || "",
        archive_shelf: selectedLoc?.shelf || "",
        archive_folder: selectedLoc?.folder || "",
        archive_folder_name: selectedLoc?.folder_name || selectedLoc?.sequence || "",
        updatedAt: serverTimestamp(),
      };

      await updateDoc(trackingRef, updateData);

      // If tied to an outgoing doc, update document's tracking info & archive
      if (selectedTracking.outgoing_doc_id) {
        try {
          const docRef = doc(db, "documents", selectedTracking.outgoing_doc_id);
          const outUpdate: any = {
            tracking_number: editFormData.tracking_number.trim().toUpperCase(),
            courier: finalCourier,
            updatedAt: serverTimestamp(),
          };
          if (selectedLoc) {
            outUpdate.archive_location_id = selectedLoc.id;
            outUpdate.archive_location_code = selectedLoc.location_code;
            outUpdate.archive_cabinet = selectedLoc.cabinet;
            outUpdate.archive_shelf = selectedLoc.shelf;
            outUpdate.archive_folder = selectedLoc.folder;
            outUpdate.archive_folder_name = selectedLoc.folder_name || selectedLoc.sequence;
            outUpdate.status = "archived";
          }
          await updateDoc(docRef, outUpdate);
        } catch (syncErr) {
          console.warn("Could not sync with outgoing document:", syncErr);
        }
      }

      // If tied to an incoming doc (ต่อเรื่อง), update document's tracking info & archive
      if (selectedTracking.incoming_doc_id) {
        try {
          const docRef = doc(db, "documents", selectedTracking.incoming_doc_id);
          const inUpdate: any = {
            tracking_number: editFormData.tracking_number.trim().toUpperCase(),
            courier: finalCourier,
            updatedAt: serverTimestamp(),
          };
          if (selectedLoc) {
            inUpdate.archive_location_id = selectedLoc.id;
            inUpdate.archive_location_code = selectedLoc.location_code;
            inUpdate.archive_cabinet = selectedLoc.cabinet;
            inUpdate.archive_shelf = selectedLoc.shelf;
            inUpdate.archive_folder = selectedLoc.folder;
            inUpdate.archive_folder_name = selectedLoc.folder_name || selectedLoc.sequence;
            inUpdate.status = "archived";
          }
          await updateDoc(docRef, inUpdate);
        } catch (syncErr) {
          console.warn("Could not sync with incoming document:", syncErr);
        }
      }

      setIsEditModalOpen(false);
      setActionSuccess("แก้ไขข้อมูลเลข Tracking สำเร็จ");
      setTimeout(() => setActionSuccess(""), 4000);
      await fetchTrackings();
    } catch (err: any) {
      console.error(err);
      setActionError("เกิดข้อผิดพลาดในการแก้ไข: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete
  const handleDelete = async () => {
    if (!selectedTracking) return;
    setIsSubmitting(true);
    setActionError("");

    try {
      const trackingRef = doc(db, "postal_trackings", selectedTracking.id);
      await updateDoc(trackingRef, {
        deleted: true,
        updatedAt: serverTimestamp(),
      });

      // If tied to outgoing doc, clear tracking from outgoing document
      if (selectedTracking.outgoing_doc_id) {
        try {
          const docRef = doc(db, "documents", selectedTracking.outgoing_doc_id);
          await updateDoc(docRef, {
            tracking_number: "",
            courier: "",
            updatedAt: serverTimestamp(),
          });
        } catch (syncErr) {
          console.warn("Could not sync with outgoing document:", syncErr);
        }
      }

      setIsDeleteModalOpen(false);
      setActionSuccess("ลบรายการเลข Tracking เรียบร้อยแล้ว");
      setTimeout(() => setActionSuccess(""), 4000);
      await fetchTrackings();
    } catch (err: any) {
      console.error(err);
      setActionError("เกิดข้อผิดพลาดในการลบ: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTrackingUrl = (trackingNumber: string, courier: string) => {
    if (courier.includes("ไปรษณีย์") || courier.toLowerCase().includes("thailand post") || courier === "EMS") {
      return `https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(trackingNumber)}`;
    }
    if (courier.toLowerCase().includes("flash")) {
      return `https://www.flashexpress.co.th/tracking/?se=${encodeURIComponent(trackingNumber)}`;
    }
    if (courier.toLowerCase().includes("kerry") || courier.toLowerCase().includes("kerry express")) {
      return `https://th.kerryexpress.com/th/track/?track=${encodeURIComponent(trackingNumber)}`;
    }
    return `https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(trackingNumber)}`;
  };

  const openArchiveModal = (item: PostalTracking) => {
    setArchiveTargetTracking(item);
    setSelectedArchiveId(item.archive_location_id || "");
    setArchiveMode("select");
    setActionError("");
    setIsArchiveModalOpen(true);
  };

  const handleSaveArchive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!archiveTargetTracking) return;

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
          setActionError("กรุณาระบุเลขที่แฟ้ม");
          setIsSubmitting(false);
          return;
        }
        if (!newArchiveData.sequence.trim()) {
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

      const trackingRef = doc(db, "postal_trackings", archiveTargetTracking.id);
      await updateDoc(trackingRef, {
        archive_location_id: targetLocation.id,
        archive_location_code: targetLocation.location_code,
        archive_cabinet: targetLocation.cabinet,
        archive_shelf: targetLocation.shelf,
        archive_folder: targetLocation.folder,
        archive_folder_name: targetLocation.folder_name || targetLocation.sequence,
        updatedAt: serverTimestamp(),
      });

      const archiveUpdate = {
        archive_location_id: targetLocation.id,
        archive_location_code: targetLocation.location_code,
        archive_cabinet: targetLocation.cabinet,
        archive_shelf: targetLocation.shelf,
        archive_folder: targetLocation.folder,
        archive_folder_name: targetLocation.folder_name || targetLocation.sequence,
        status: "archived" as const,
        updatedAt: serverTimestamp(),
        updated_by: appUser?.id || "",
      };

      if (archiveTargetTracking.incoming_doc_id) {
        try {
          const incRef = doc(db, "documents", archiveTargetTracking.incoming_doc_id);
          await updateDoc(incRef, archiveUpdate);
        } catch (syncErr) {
          console.warn("Could not sync incoming doc archive:", syncErr);
        }
      }

      if (archiveTargetTracking.outgoing_doc_id) {
        try {
          const outRef = doc(db, "documents", archiveTargetTracking.outgoing_doc_id);
          await updateDoc(outRef, archiveUpdate);
        } catch (syncErr) {
          console.warn("Could not sync outgoing doc archive:", syncErr);
        }
      }

      setIsArchiveModalOpen(false);
      setActionSuccess(`จัดเก็บเข้าแฟ้ม "${targetLocation.folder_name || targetLocation.sequence || targetLocation.folder}" เรียบร้อยแล้ว`);
      setTimeout(() => setActionSuccess(""), 4000);
      await fetchTrackings();
    } catch (err: any) {
      console.error(err);
      setActionError("เกิดข้อผิดพลาดในการจัดเก็บเข้าแฟ้ม: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveTrackingArchive = async () => {
    if (!archiveTargetTracking) return;
    if (!confirm("คุณต้องการนำรายการนี้ออกจากแฟ้มจัดเก็บใช่หรือไม่?")) return;

    setIsSubmitting(true);
    setActionError("");
    try {
      const trackingRef = doc(db, "postal_trackings", archiveTargetTracking.id);
      await updateDoc(trackingRef, {
        archive_location_id: "",
        archive_location_code: "",
        archive_cabinet: "",
        archive_shelf: "",
        archive_folder: "",
        archive_folder_name: "",
        updatedAt: serverTimestamp(),
      });

      if (archiveTargetTracking.incoming_doc_id) {
        try {
          const incRef = doc(db, "documents", archiveTargetTracking.incoming_doc_id);
          await updateDoc(incRef, {
            archive_location_id: "",
            archive_location_code: "",
            archive_cabinet: "",
            archive_shelf: "",
            archive_folder: "",
            archive_folder_name: "",
            status: "registered",
            updatedAt: serverTimestamp(),
          });
        } catch (e) {}
      }

      if (archiveTargetTracking.outgoing_doc_id) {
        try {
          const outRef = doc(db, "documents", archiveTargetTracking.outgoing_doc_id);
          await updateDoc(outRef, {
            archive_location_id: "",
            archive_location_code: "",
            archive_cabinet: "",
            archive_shelf: "",
            archive_folder: "",
            archive_folder_name: "",
            status: "registered",
            updatedAt: serverTimestamp(),
          });
        } catch (e) {}
      }

      setIsArchiveModalOpen(false);
      setActionSuccess("นำออกจากแฟ้มจัดเก็บเรียบร้อยแล้ว");
      setTimeout(() => setActionSuccess(""), 4000);
      await fetchTrackings();
    } catch (err: any) {
      console.error(err);
      setActionError("เกิดข้อผิดพลาด: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const unarchivedCount = trackings.filter(t => !t.archive_location_code).length;
  const archivedCount = trackings.filter(t => !!t.archive_location_code).length;

  const filtered = trackings.filter(item => {
    const matchesSearch = 
      item.tracking_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.recipient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.outgoing_running_number && item.outgoing_running_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.incoming_running_number && item.incoming_running_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.archive_folder_name && item.archive_folder_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.archive_location_code && item.archive_location_code.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterTab === 'unarchived') return !item.archive_location_code;
    if (filterTab === 'archived') return !!item.archive_location_code;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg flex items-center space-x-2">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="text-sm font-medium">{actionSuccess}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">บันทึกเลข Tracking</h1>
          <p className="text-sm text-gray-500">บันทึกและติดตามสถานะเลข Tracking การจัดส่งพัสดุ</p>
        </div>
        <Link 
          href="/tracking/new" 
          className="flex items-center bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-md shadow-red-200 hover:shadow-lg hover:shadow-red-300/40 transition-all text-sm"
        >
          <Plus className="w-5 h-5 mr-2" />
          บันทึกเลข Tracking ใหม่
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-xs border border-gray-150 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative max-w-md w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="ค้นหาเลข Tracking, เลขที่หนังสือ, เรื่อง, ผู้รับ, หรือแฟ้ม..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 sm:text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Filter Tabs for เจ้าของงาน */}
        <div className="flex items-center space-x-1 border-b border-gray-150 px-4 pt-2 bg-gray-50/50">
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center ${
              filterTab === 'all'
                ? 'border-red-600 text-red-600 bg-white shadow-xs rounded-t-lg'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            ทั้งหมด
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${filterTab === 'all' ? 'bg-red-100 text-red-700 font-bold' : 'bg-gray-200 text-gray-700'}`}>
              {trackings.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('unarchived')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center ${
              filterTab === 'unarchived'
                ? 'border-amber-600 text-amber-800 bg-white shadow-xs rounded-t-lg font-bold'
                : 'border-transparent text-amber-700 hover:text-amber-900'
            }`}
          >
            รอเลือกเข้าแฟ้ม (สำหรับเจ้าของงาน)
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${filterTab === 'unarchived' ? 'bg-amber-500 text-white shadow-xs' : 'bg-amber-100 text-amber-800 border border-amber-300'}`}>
              {unarchivedCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('archived')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center ${
              filterTab === 'archived'
                ? 'border-emerald-600 text-emerald-700 bg-white shadow-xs rounded-t-lg font-bold'
                : 'border-transparent text-gray-500 hover:text-emerald-700'
            }`}
          >
            จัดเก็บเข้าแฟ้มแล้ว
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${filterTab === 'archived' ? 'bg-emerald-100 text-emerald-800 font-bold' : 'bg-gray-200 text-gray-700'}`}>
              {archivedCount}
            </span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50/70">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">เลข Tracking</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">ผู้ให้บริการ</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">อ้างอิงหนังสือ</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">เรื่อง / รายการสิ่งของ</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">ผู้รับ</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">แฟ้มจัดเก็บ</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">วันที่ส่ง</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex justify-center mb-4">
                      <div className="h-8 w-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    กำลังโหลดข้อมูล...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <Package className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                    {filterTab === 'unarchived' ? 'ไม่มีรายการที่รอจัดเก็บเข้าแฟ้ม' : 'ไม่พบรายการบันทึกเลขพัสดุ'}
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-red-50/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold font-mono text-gray-900">
                      {item.tracking_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                        {item.courier}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {item.incoming_running_number ? (
                        <Link 
                          href={item.incoming_doc_id ? `/incoming/${item.incoming_doc_id}` : '/incoming'} 
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                        >
                          ต่อเรื่อง: {item.incoming_running_number}
                        </Link>
                      ) : item.outgoing_running_number ? (
                        <Link 
                          href={item.outgoing_doc_id ? `/outgoing/${item.outgoing_doc_id}` : '/outgoing'} 
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                        >
                          ส่ง: {item.outgoing_running_number}
                        </Link>
                      ) : (
                        <span className="text-gray-400 text-xs italic">สร้างรายการส่งเอง</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {item.subject}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {item.recipient_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {item.archive_location_code ? (
                        <button
                          type="button"
                          onClick={() => openArchiveModal(item)}
                          className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 transition-all shadow-xs group"
                          title={`คลิกเพื่อแก้ไข/เปลี่ยนแฟ้ม (ปัจจุบัน: ตู้ ${item.archive_cabinet || '-'} ชั้น ${item.archive_shelf || '-'})`}
                        >
                          <FolderCheck className="w-3.5 h-3.5 mr-1.5 text-emerald-600 shrink-0" />
                          <span className="truncate max-w-[130px]">{item.archive_folder_name || item.archive_folder || item.archive_location_code}</span>
                          <Edit className="w-3 h-3 ml-1.5 opacity-40 group-hover:opacity-100 text-emerald-700" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openArchiveModal(item)}
                          className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 hover:border-amber-400 shadow-xs transition-all group"
                          title="เจ้าของงานคลิกที่นี่เพื่อเลือกจัดเก็บเอกสารเข้าแฟ้ม"
                        >
                          <FolderPlus className="w-3.5 h-3.5 mr-1 text-amber-600 group-hover:scale-110 transition-transform" />
                          + เลือกเข้าแฟ้ม
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatToBuddhistEra(item.sent_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                      <a 
                        href={getTrackingUrl(item.tracking_number, item.courier)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-blue-600 hover:text-blue-900 font-medium"
                      >
                        เช็คพัสดุ
                        <ExternalLink className="w-3.5 h-3.5 ml-1" />
                      </a>
                      {appUser?.role !== 'viewer' && (
                        <>
                          <button
                            onClick={() => openEditModal(item)}
                            className="inline-flex items-center text-gray-600 hover:text-blue-600 font-medium transition-colors"
                            title="แก้ไข"
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            แก้ไข
                          </button>
                          <button
                            onClick={() => openDeleteModal(item)}
                            className="inline-flex items-center text-red-500 hover:text-red-700 font-medium transition-colors"
                            title="ลบ"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            ลบ
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: แก้ไขข้อมูล Tracking */}
      {isEditModalOpen && selectedTracking && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <Edit className="w-5 h-5 mr-2 text-blue-600" />
                แก้ไขเลข Tracking ({selectedTracking.tracking_number})
              </h3>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedTracking.incoming_running_number && (
              <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center">
                <span className="font-semibold mr-1">📍 ต่อเรื่องจากหนังสือรับ:</span>
                <span className="font-mono font-bold">{selectedTracking.incoming_running_number}</span>
              </div>
            )}

            {selectedTracking.outgoing_running_number && (
              <div className="mt-3 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-center">
                <span className="font-semibold mr-1">✉️ อ้างอิงหนังสือส่ง:</span>
                <span className="font-mono font-bold">{selectedTracking.outgoing_running_number}</span>
              </div>
            )}

            {actionError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {actionError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  เลข Tracking <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  required
                  value={editFormData.tracking_number}
                  onChange={(e) => setEditFormData({ ...editFormData, tracking_number: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono font-bold text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ผู้ให้บริการจัดส่ง <span className="text-red-500">*</span>
                </label>
                <select
                  value={editFormData.courier}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditFormData({
                      ...editFormData,
                      courier: val,
                      courier_is_custom: val === "อื่นๆ (ระบุเอง)",
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {COURIER_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                {editFormData.courier_is_custom && (
                  <div className="mt-2">
                    <input 
                      type="text" 
                      required
                      placeholder="ระบุผู้ให้บริการ เช่น Flash, Kerry..."
                      value={editFormData.courier_custom}
                      onChange={(e) => setEditFormData({ ...editFormData, courier_custom: e.target.value })}
                      className="w-full px-3 py-2 border border-blue-400 rounded-lg text-sm bg-blue-50/30"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  เรื่อง / รายการสิ่งของ
                </label>
                <input 
                  type="text" 
                  value={editFormData.subject}
                  onChange={(e) => setEditFormData({ ...editFormData, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อผู้รับ <span className="text-red-500">*</span>
                </label>
                <select
                  value={editFormData.recipient_name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditFormData({
                      ...editFormData,
                      recipient_name: val,
                      recipient_is_custom: val === "อื่นๆ (ระบุเอง)",
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {THAIPOST_ORGANIZATIONS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>

                {editFormData.recipient_is_custom && (
                  <div className="mt-2">
                    <input 
                      type="text" 
                      required
                      placeholder="ระบุชื่อผู้รับหรือหน่วยงานปลายทาง..."
                      value={editFormData.recipient_custom}
                      onChange={(e) => setEditFormData({ ...editFormData, recipient_custom: e.target.value })}
                      className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm bg-red-50/30 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  </div>
                )}
              </div>

              {/* การจัดเก็บเข้าแฟ้ม (Archive Folder) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                  <FolderCheck className="w-4 h-4 mr-1 text-amber-600" />
                  การจัดเก็บเข้าแฟ้ม (Archive Folder)
                </label>
                <select
                  value={editFormData.archive_location_id}
                  onChange={(e) => setEditFormData({ ...editFormData, archive_location_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                >
                  <option value="">-- ยังไม่จัดเก็บเข้าแฟ้ม --</option>
                  {archiveLocations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      [{loc.location_code}] {loc.folder_name || loc.sequence} (ตู้ {loc.cabinet} / ชั้น {loc.shelf})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  วันที่ส่ง
                </label>
                <input 
                  type="date" 
                  value={editFormData.sent_date}
                  onChange={(e) => setEditFormData({ ...editFormData, sent_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  หมายเหตุ
                </label>
                <textarea 
                  rows={2}
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
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

      {/* MODAL: ยืนยันการลบ Tracking */}
      {isDeleteModalOpen && selectedTracking && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 text-red-600 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">ยืนยันการลบเลข Tracking</h3>
            </div>
            
            <p className="text-sm text-gray-600 mb-2">
              คุณต้องการลบเลข Tracking <span className="font-bold text-gray-900">{selectedTracking.tracking_number}</span> ({selectedTracking.courier}) ผู้รับ <span className="font-bold text-gray-900">{selectedTracking.recipient_name}</span> ใช่หรือไม่?
            </p>
            <p className="text-xs text-red-500 mb-6">
              * ข้อมูลจะถูกนำออกจากรายการบันทึก Tracking ในระบบ
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

      {/* MODAL: เลือกแฟ้มจัดเก็บเอกสาร/พัสดุ (สำหรับเจ้าของงาน) */}
      {isArchiveModalOpen && archiveTargetTracking && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                  <FolderCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    เลือกแฟ้มจัดเก็บ (สำหรับเจ้าของงาน)
                  </h3>
                  <p className="text-xs text-gray-500">บันทึกตำแหน่งตู้และชั้นเพื่อจัดเก็บเอกสารเข้าแฟ้ม</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsArchiveModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Item Summary Banner */}
            <div className="mt-4 p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-sm text-gray-900 flex items-center">
                  <Package className="w-3.5 h-3.5 mr-1 text-red-600" />
                  {archiveTargetTracking.tracking_number}
                  <span className="ml-1.5 font-sans font-medium text-xs px-2 py-0.5 rounded bg-red-100 text-red-800">
                    {archiveTargetTracking.courier}
                  </span>
                </span>
                <span className="text-gray-500">ส่งถึง: <strong className="text-gray-800">{archiveTargetTracking.recipient_name}</strong></span>
              </div>
              <p className="text-gray-700 font-medium truncate">
                <span className="text-gray-500">เรื่อง:</span> {archiveTargetTracking.subject}
              </p>
              
              {archiveTargetTracking.incoming_running_number && (
                <div className="pt-1.5 border-t border-gray-200 text-emerald-800 flex items-center font-medium">
                  <span className="px-1.5 py-0.5 bg-emerald-100 rounded text-[11px] font-bold mr-1.5">
                    ต่อเรื่อง
                  </span>
                  <span>
                    เลขที่รับ {archiveTargetTracking.incoming_running_number} (จะถูกอัปเดตสถานะเป็น "จัดเก็บแล้ว" ให้อัตโนมัติ)
                  </span>
                </div>
              )}
            </div>

            {/* Mode Switch Tabs */}
            <div className="flex border-b border-gray-200 mt-4">
              <button
                type="button"
                onClick={() => { setArchiveMode("select"); setActionError(""); }}
                className={`flex-1 py-2 text-sm font-medium border-b-2 text-center transition-all ${
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
                className={`flex-1 py-2 text-sm font-medium border-b-2 text-center transition-all ${
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      >
                        <option value="">-- กรุณาเลือกแฟ้ม --</option>
                        {archiveLocations.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            [{loc.location_code}] {loc.folder_name || loc.sequence} (ตู้ {loc.cabinet} / ชั้น {loc.shelf} • หมวด {loc.category})
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
                        placeholder="เช่น แฟ้มหนังสือรับ 2567"
                      />
                    </div>
                  </div>

                  <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200 mt-2">
                    <span className="block text-xs text-amber-800 font-medium">รหัสสถานที่จัดเก็บ (Location Code):</span>
                    <span className="block text-sm font-mono font-bold text-amber-950 mt-0.5">
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

              <div className="flex items-center justify-between pt-4 border-t">
                {archiveTargetTracking.archive_location_code ? (
                  <button
                    type="button"
                    onClick={handleRemoveTrackingArchive}
                    disabled={isSubmitting}
                    className="text-xs text-red-600 hover:text-red-800 font-medium hover:underline"
                  >
                    นำออกจากแฟ้ม
                  </button>
                ) : <span />}

                <div className="flex space-x-3">
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
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
