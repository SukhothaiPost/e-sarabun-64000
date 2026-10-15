"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";
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
  FolderCheck
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

  const filtered = trackings.filter(item => 
    item.tracking_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.recipient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.outgoing_running_number && item.outgoing_running_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (item.incoming_running_number && item.incoming_running_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (item.archive_folder_name && item.archive_folder_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (item.archive_location_code && item.archive_location_code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
                    ไม่พบรายการบันทึกเลขพัสดุ
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
                        <span 
                          className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200" 
                          title={`ตู้ ${item.archive_cabinet || '-'} ชั้น ${item.archive_shelf || '-'} (${item.archive_location_code})`}
                        >
                          <FolderCheck className="w-3.5 h-3.5 mr-1 text-amber-600 shrink-0" />
                          <span className="truncate max-w-[120px]">{item.archive_folder_name || item.archive_folder || item.archive_location_code}</span>
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs italic">-</span>
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
    </div>
  );
}
