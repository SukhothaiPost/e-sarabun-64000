"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { db } from "@/lib/firebase/config";
import { collection, doc, setDoc, updateDoc, getDocs, query, where, serverTimestamp } from "firebase/firestore";
import { SarabanDocument, ArchiveLocation, THAIPOST_ORGANIZATIONS } from "@/types";
import { 
  ArrowLeft, 
  ExternalLink, 
  Package, 
  FileText, 
  Search, 
  Check, 
  Inbox, 
  FolderCheck, 
  X,
  Link2
} from "lucide-react";
import Link from "next/link";

const COURIER_OPTIONS = [
  "EMS",
  "ลงทะเบียน",
  "พัสดุ",
  "อื่นๆ (ระบุเอง)"
];

function NewTrackingContent() {
  const { appUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const incomingIdParam = searchParams.get("incoming_id");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Data lists
  const [outgoingDocs, setOutgoingDocs] = useState<SarabanDocument[]>([]);
  const [incomingDocs, setIncomingDocs] = useState<SarabanDocument[]>([]);
  const [archiveLocations, setArchiveLocations] = useState<ArchiveLocation[]>([]);

  // Mode: 'from_doc' | 'standalone' (สร้างรายการส่งเอง/ต่อเรื่อง)
  const [mode, setMode] = useState<'from_doc' | 'standalone'>('from_doc');

  // Selected Outgoing Doc (for from_doc mode)
  const [selectedDocId, setSelectedDocId] = useState("");
  const [docSearchTerm, setDocSearchTerm] = useState("");

  // Selected Incoming Doc (for ต่อเรื่อง in standalone mode)
  const [selectedIncomingDocId, setSelectedIncomingDocId] = useState("");
  const [incomingSearchTerm, setIncomingSearchTerm] = useState("");

  // Archive Location selection (การจัดเก็บเข้าแฟ้ม)
  const [selectedArchiveId, setSelectedArchiveId] = useState("");

  // Courier state
  const [courierOption, setCourierOption] = useState("EMS");
  const [customCourier, setCustomCourier] = useState("");

  // Recipient dropdown state
  const [recipientOption, setRecipientOption] = useState("ปข.6");
  const [customRecipient, setCustomRecipient] = useState("");

  const [formData, setFormData] = useState({
    tracking_number: "",
    sent_date: new Date().toISOString().split('T')[0],
    subject: "",
    recipient_name: "",
    notes: "",
  });

  // Fetch Outgoing, Incoming, and Archive Locations
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch Outgoing Docs
        const qOut = query(
          collection(db, "documents"),
          where("document_type", "==", "outgoing"),
          where("deleted", "==", false)
        );
        const snapOut = await getDocs(qOut);
        const docsOut = snapOut.docs.map(d => d.data() as SarabanDocument);
        setOutgoingDocs(docsOut);

        // 2. Fetch Incoming Docs (for ต่อเรื่อง)
        const qIn = query(
          collection(db, "documents"),
          where("document_type", "==", "incoming"),
          where("deleted", "==", false)
        );
        const snapIn = await getDocs(qIn);
        const docsIn = snapIn.docs.map(d => d.data() as SarabanDocument);
        setIncomingDocs(docsIn);

        // 3. Fetch Archive Locations
        const qLocs = query(collection(db, "archive_locations"));
        const snapLocs = await getDocs(qLocs);
        const locs = snapLocs.docs.map(d => ({ ...d.data(), id: d.id } as ArchiveLocation));
        setArchiveLocations(locs);
      } catch (err) {
        console.error("Failed to fetch initial data:", err);
      }
    };
    fetchData();
  }, []);

  // Handle URL incoming_id parameter
  useEffect(() => {
    if (incomingIdParam && incomingDocs.length > 0) {
      setMode('standalone');
      const targetInc = incomingDocs.find(d => d.id === incomingIdParam);
      if (targetInc) {
        handleSelectIncomingDoc(targetInc);
      }
    }
  }, [incomingIdParam, incomingDocs]);

  const handleSelectDoc = (doc: SarabanDocument) => {
    setSelectedDocId(doc.id);
    setFormData(prev => ({
      ...prev,
      subject: doc.subject || "",
      recipient_name: doc.recipient || "",
      tracking_number: doc.tracking_number || prev.tracking_number,
    }));
    if (doc.archive_location_id) {
      setSelectedArchiveId(doc.archive_location_id);
    }
  };

  const handleSelectIncomingDoc = (incDoc: SarabanDocument) => {
    setSelectedIncomingDocId(incDoc.id);
    setFormData(prev => ({
      ...prev,
      subject: prev.subject ? prev.subject : `ส่งต่อเรื่อง: ${incDoc.subject}`,
      recipient_name: incDoc.sender || prev.recipient_name,
    }));

    // Try to auto-select recipient in dropdown if matched
    if (incDoc.sender) {
      const known = THAIPOST_ORGANIZATIONS.find(org => org !== "อื่นๆ (ระบุเอง)" && org === incDoc.sender);
      if (known) {
        setRecipientOption(known);
        setCustomRecipient("");
      } else {
        setRecipientOption("อื่นๆ (ระบุเอง)");
        setCustomRecipient(incDoc.sender);
      }
    }

    // Auto-select archive folder if incoming doc is already archived
    if (incDoc.archive_location_id) {
      setSelectedArchiveId(incDoc.archive_location_id);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.tracking_number.trim()) {
      setError("กรุณาระบุเลข Tracking");
      return;
    }

    const finalCourier = courierOption === "อื่นๆ (ระบุเอง)" ? customCourier.trim() : courierOption;
    if (!finalCourier) {
      setError("กรุณาระบุผู้ให้บริการจัดส่ง");
      return;
    }

    let finalRecipient = "";
    if (mode === 'from_doc') {
      finalRecipient = formData.recipient_name.trim();
      if (!selectedDocId) {
        setError("กรุณาเลือกหนังสือส่งที่ต้องการระบุเลขพัสดุ");
        return;
      }
    } else {
      finalRecipient = recipientOption === "อื่นๆ (ระบุเอง)" ? customRecipient.trim() : recipientOption;
    }

    if (!finalRecipient) {
      setError("กรุณาระบุชื่อผู้รับ");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const selectedDoc = mode === 'from_doc' ? outgoingDocs.find(d => d.id === selectedDocId) : null;
      const selectedIncomingDoc = mode === 'standalone' ? incomingDocs.find(d => d.id === selectedIncomingDocId) : null;
      const targetArchive = selectedArchiveId ? archiveLocations.find(l => l.id === selectedArchiveId) : null;

      const trackingRef = doc(collection(db, "postal_trackings"));

      const dataToSave: any = {
        id: trackingRef.id,
        tracking_number: formData.tracking_number.trim().toUpperCase(),
        courier: finalCourier,
        source_type: mode === 'from_doc' ? 'outgoing_doc' : 'standalone',
        outgoing_doc_id: selectedDoc ? selectedDoc.id : null,
        outgoing_running_number: selectedDoc ? selectedDoc.running_number : null,
        incoming_doc_id: selectedIncomingDoc ? selectedIncomingDoc.id : null,
        incoming_running_number: selectedIncomingDoc ? selectedIncomingDoc.running_number : null,
        is_follow_up: !!selectedIncomingDoc,
        subject: formData.subject.trim(),
        recipient_name: finalRecipient,
        sent_date: formData.sent_date ? new Date(formData.sent_date) : new Date(),
        notes: formData.notes.trim(),
        created_by: appUser?.displayName || "เจ้าหน้าที่",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deleted: false,
      };

      // If physical archive folder was chosen, attach to tracking
      if (targetArchive) {
        dataToSave.archive_location_id = targetArchive.id;
        dataToSave.archive_location_code = targetArchive.location_code;
        dataToSave.archive_cabinet = targetArchive.cabinet;
        dataToSave.archive_shelf = targetArchive.shelf;
        dataToSave.archive_folder = targetArchive.folder;
        dataToSave.archive_folder_name = targetArchive.folder_name || targetArchive.sequence;
      }

      await setDoc(trackingRef, dataToSave);

      // 1. If linked to an Outgoing Document: update doc's tracking & archive if chosen
      if (mode === 'from_doc' && selectedDocId) {
        const outUpdate: any = {
          tracking_number: formData.tracking_number.trim().toUpperCase(),
          courier: finalCourier,
          updatedAt: serverTimestamp(),
        };
        if (targetArchive) {
          outUpdate.archive_location_id = targetArchive.id;
          outUpdate.archive_location_code = targetArchive.location_code;
          outUpdate.archive_cabinet = targetArchive.cabinet;
          outUpdate.archive_shelf = targetArchive.shelf;
          outUpdate.archive_folder = targetArchive.folder;
          outUpdate.archive_folder_name = targetArchive.folder_name || targetArchive.sequence;
          outUpdate.status = "archived";
        }
        await updateDoc(doc(db, "documents", selectedDocId), outUpdate);
      }

      // 2. If linked to an Incoming Document (ต่อเรื่อง): update incoming doc's tracking & archive
      if (mode === 'standalone' && selectedIncomingDocId) {
        const inUpdate: any = {
          tracking_number: formData.tracking_number.trim().toUpperCase(),
          courier: finalCourier,
          updatedAt: serverTimestamp(),
        };
        if (targetArchive) {
          inUpdate.archive_location_id = targetArchive.id;
          inUpdate.archive_location_code = targetArchive.location_code;
          inUpdate.archive_cabinet = targetArchive.cabinet;
          inUpdate.archive_shelf = targetArchive.shelf;
          inUpdate.archive_folder = targetArchive.folder;
          inUpdate.archive_folder_name = targetArchive.folder_name || targetArchive.sequence;
          inUpdate.status = "archived";
        }
        await updateDoc(doc(db, "documents", selectedIncomingDocId), inUpdate);
      }

      router.push("/tracking");
    } catch (err: any) {
      console.error("Error creating tracking:", err);
      setError("เกิดข้อผิดพลาดในการบันทึกข้อมูล: " + err.message);
      setIsSubmitting(false);
    }
  };

  const filteredOutgoingDocs = outgoingDocs.filter(doc => {
    const term = docSearchTerm.toLowerCase();
    return (
      (doc.running_number && doc.running_number.toLowerCase().includes(term)) ||
      (doc.subject && doc.subject.toLowerCase().includes(term)) ||
      (doc.recipient && doc.recipient.toLowerCase().includes(term))
    );
  });

  const filteredIncomingDocs = incomingDocs.filter(doc => {
    const term = incomingSearchTerm.toLowerCase();
    return (
      (doc.running_number && doc.running_number.toLowerCase().includes(term)) ||
      (doc.subject && doc.subject.toLowerCase().includes(term)) ||
      (doc.sender && doc.sender.toLowerCase().includes(term)) ||
      (doc.document_number && doc.document_number.toLowerCase().includes(term))
    );
  });

  const selectedDoc = outgoingDocs.find(d => d.id === selectedDocId);
  const selectedIncomingDoc = incomingDocs.find(d => d.id === selectedIncomingDocId);
  const selectedArchiveLocation = archiveLocations.find(l => l.id === selectedArchiveId);

  const checkPostalUrl = formData.tracking_number.trim() 
    ? `https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(formData.tracking_number.trim())}` 
    : "https://track.thailandpost.co.th";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Link href="/tracking" className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">บันทึกเลข Tracking</h1>
          <p className="text-sm text-gray-500">บันทึกเลข Tracking สำหรับติดตามสถานะการจัดส่ง พร้อมจัดเก็บเข้าแฟ้ม</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-md text-sm border border-red-200">
          {error}
        </div>
      )}

      {/* Mode Selector */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">รูปแบบการบันทึกส่ง</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => { setMode('from_doc'); }}
              className={`flex items-start p-4 border rounded-xl text-left transition-all ${
                mode === 'from_doc' 
                  ? 'border-red-600 bg-red-50/70 ring-2 ring-red-500' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <FileText className={`w-6 h-6 mr-3 mt-0.5 ${mode === 'from_doc' ? 'text-red-600' : 'text-gray-400'}`} />
              <div>
                <p className="font-semibold text-gray-900">เลือกจากหนังสือส่ง</p>
                <p className="text-xs text-gray-500 mt-1">ผูกเลข Tracking เข้ากับหนังสือส่งในระบบ (กรณีตั้งเรื่องส่งเอง)</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => { setMode('standalone'); setSelectedDocId(''); }}
              className={`flex items-start p-4 border rounded-xl text-left transition-all ${
                mode === 'standalone' 
                  ? 'border-red-600 bg-red-50/70 ring-2 ring-red-500' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Package className={`w-6 h-6 mr-3 mt-0.5 ${mode === 'standalone' ? 'text-red-600' : 'text-gray-400'}`} />
              <div>
                <p className="font-semibold text-gray-900">สร้างรายการส่งเอง/ต่อเรื่อง</p>
                <p className="text-xs text-gray-500 mt-1">ส่งพัสดุ/จดหมายทั่วไป หรือต่อเรื่องจากทะเบียนรับหนังสือ พร้อมจัดเก็บเข้าแฟ้ม</p>
              </div>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 pt-4 border-t border-gray-200">
          
          {/* Mode 1: เลือกหนังสือส่งที่ต้องการระบุเลขพัสดุ */}
          {mode === 'from_doc' && (
            <div className="bg-red-50/40 p-4 rounded-xl border border-red-200 space-y-3">
              <label className="block text-sm font-semibold text-red-900">
                เลือกหนังสือส่งที่ต้องการระบุเลขพัสดุ <span className="text-red-500">*</span>
              </label>

              {/* Search Box for Outgoing Docs */}
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="พิมพ์ค้นหาเลขทะเบียนส่ง, ชื่อเรื่อง, หรือผู้รับ..."
                  value={docSearchTerm}
                  onChange={(e) => setDocSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              {/* Documents List */}
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white divide-y divide-gray-100">
                {filteredOutgoingDocs.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-500">
                    ไม่พบหนังสือส่งที่ค้นหา
                  </div>
                ) : (
                  filteredOutgoingDocs.map((doc) => {
                    const isSelected = selectedDocId === doc.id;
                    return (
                      <div
                        key={doc.id}
                        onClick={() => handleSelectDoc(doc)}
                        className={`p-3 cursor-pointer text-sm transition-colors flex items-center justify-between ${
                          isSelected ? 'bg-red-100/70 border-l-4 border-red-600' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-red-700 font-mono">{doc.running_number}</span>
                            <span className="text-xs text-gray-500">• ถึง: {doc.recipient}</span>
                          </div>
                          <p className="text-gray-900 truncate mt-0.5">{doc.subject}</p>
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center flex-shrink-0">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {selectedDoc && (
                <div className="text-xs text-red-800 bg-red-100/60 p-2.5 rounded-lg border border-red-200 flex items-center justify-between">
                  <div>
                    <span className="font-semibold">เลือกแล้ว:</span> เลขทะเบียน {selectedDoc.running_number} — {selectedDoc.subject} (เรียน: {selectedDoc.recipient})
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedDocId("")}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Mode 2: สร้างรายการส่งเอง/ต่อเรื่อง (ต่อเรื่องจากทะเบียนรับหนังสือ) */}
          {mode === 'standalone' && (
            <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-emerald-900 flex items-center gap-1.5">
                  <Inbox className="w-4 h-4 text-emerald-600" />
                  ต่อเรื่องจากทะเบียนรับหนังสือ (ถ้ามี)
                </label>
                {selectedIncomingDocId && (
                  <button
                    type="button"
                    onClick={() => setSelectedIncomingDocId("")}
                    className="text-xs text-red-600 hover:underline flex items-center font-medium"
                  >
                    <X className="w-3.5 h-3.5 mr-0.5" />
                    ยกเลิกการต่อเรื่อง (ส่งรายการเดี่ยว)
                  </button>
                )}
              </div>

              {selectedIncomingDoc ? (
                <div className="p-3 bg-white rounded-lg border border-emerald-300 shadow-sm flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-emerald-100 text-emerald-800">
                        เลขรับ: {selectedIncomingDoc.running_number}
                      </span>
                      {selectedIncomingDoc.document_number && (
                        <span className="text-xs text-gray-500">
                          (เลขที่ {selectedIncomingDoc.document_number})
                        </span>
                      )}
                      <span className="text-xs text-gray-500">• จาก: {selectedIncomingDoc.sender}</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 mt-1">{selectedIncomingDoc.subject}</p>
                    {selectedIncomingDoc.archive_location_code && (
                      <p className="text-xs text-emerald-700 mt-1 font-mono">
                        📍 แฟ้มจัดเก็บเดิม: {selectedIncomingDoc.archive_folder_name || selectedIncomingDoc.archive_folder} ({selectedIncomingDoc.archive_location_code})
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedIncomingDocId("")}
                    className="text-gray-400 hover:text-gray-600 p-1"
                    title="ยกเลิกการเลือก"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="ค้นหาเลขที่ลงรับ, เรื่อง, หรือผู้ส่ง เพื่อเลือกต่อเรื่อง..."
                      value={incomingSearchTerm}
                      onChange={(e) => setIncomingSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>

                  {incomingSearchTerm.trim() && (
                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white divide-y divide-gray-100 shadow-sm">
                      {filteredIncomingDocs.length === 0 ? (
                        <div className="p-3 text-center text-xs text-gray-500">ไม่พบหนังสือรับที่ค้นหา</div>
                      ) : (
                        filteredIncomingDocs.map((doc) => (
                          <div
                            key={doc.id}
                            onClick={() => {
                              handleSelectIncomingDoc(doc);
                              setIncomingSearchTerm("");
                            }}
                            className="p-2.5 cursor-pointer text-sm hover:bg-emerald-50/70 transition-colors flex items-center justify-between"
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-emerald-700 font-mono text-xs">{doc.running_number}</span>
                                <span className="text-xs text-gray-500">• จาก: {doc.sender}</span>
                              </div>
                              <p className="text-gray-900 truncate text-xs mt-0.5">{doc.subject}</p>
                            </div>
                            <span className="text-xs text-emerald-700 font-semibold px-2 py-0.5 bg-emerald-100/70 rounded">
                              เลือก
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                  <p className="text-[11px] text-gray-500">
                    💡 หากต้องการสร้างรายการส่งพัสดุทั่วไปโดยไม่ต่อเรื่อง สามารถข้ามช่องนี้ไปกรอกข้อมูลด้านล่างได้ทันที
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* เลข Tracking */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                เลข Tracking <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="tracking_number"
                required
                value={formData.tracking_number}
                onChange={handleChange}
                placeholder="เช่น ED123456789TH"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-base uppercase focus:ring-2 focus:ring-red-500 focus:border-red-500 font-bold text-red-700 bg-white"
              />
              {formData.tracking_number && (
                <a 
                  href={checkPostalUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="inline-flex items-center text-xs text-red-600 hover:text-red-800 mt-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1" />
                  ทดลองตรวจเช็คที่เว็บไปรษณีย์ไทย
                </a>
              )}
            </div>

            {/* ผู้ให้บริการจัดส่ง */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ผู้ให้บริการจัดส่ง <span className="text-red-500">*</span></label>
              <select
                value={courierOption}
                onChange={(e) => setCourierOption(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white text-sm"
              >
                {COURIER_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              {courierOption === "อื่นๆ (ระบุเอง)" && (
                <div className="mt-2">
                  <input
                    type="text"
                    required
                    value={customCourier}
                    onChange={(e) => setCustomCourier(e.target.value)}
                    placeholder="ระบุบริการจัดส่ง เช่น Flash, Kerry..."
                    className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-red-50/20 text-sm"
                    autoFocus
                  />
                </div>
              )}
            </div>

            {/* เรื่อง / รายการที่ส่ง */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                เรื่อง / รายการที่ส่ง <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="subject"
                required
                value={formData.subject}
                onChange={handleChange}
                placeholder="เช่น ส่งเอกสารเบิกจ่าย, ส่งแบบรายงานประจำเดือน, ส่งเอกสารตอบกลับ"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
              />
            </div>

            {/* ชื่อผู้รับ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ชื่อผู้รับ / หน่วยงานปลายทาง <span className="text-red-500">*</span>
              </label>
              
              {mode === 'from_doc' ? (
                // อิงจากหนังสือส่งที่เลือก (Auto-filled)
                <input
                  type="text"
                  name="recipient_name"
                  required
                  value={formData.recipient_name}
                  onChange={handleChange}
                  placeholder="อิงจากหนังสือส่งที่เลือก"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm font-medium"
                />
              ) : (
                // กรณีสร้างรายการส่งเอง/ต่อเรื่อง: Dropdown List สาขาไปรษณีย์
                <div>
                  <select
                    value={recipientOption}
                    onChange={(e) => setRecipientOption(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white text-sm"
                  >
                    {THAIPOST_ORGANIZATIONS.map((branch) => (
                      <option key={branch} value={branch}>{branch}</option>
                    ))}
                  </select>

                  {recipientOption === "อื่นๆ (ระบุเอง)" && (
                    <div className="mt-2">
                      <input
                        type="text"
                        required
                        value={customRecipient}
                        onChange={(e) => setCustomRecipient(e.target.value)}
                        placeholder="กรุณาระบุชื่อหน่วยงานหรือบุคคลผู้รับ..."
                        className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-red-50/20 text-sm"
                        autoFocus
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* วันที่ส่ง */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                วันที่ส่ง <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="sent_date"
                required
                value={formData.sent_date}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm bg-white"
              />
            </div>

            {/* การจัดเก็บเข้าแฟ้ม (Archive Folder) */}
            <div className="md:col-span-2 bg-amber-50/60 p-4 rounded-xl border border-amber-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-amber-900 flex items-center gap-1.5">
                  <FolderCheck className="w-4 h-4 text-amber-600" />
                  การจัดเก็บเข้าแฟ้ม (Archive Folder)
                </label>
                {selectedArchiveLocation && (
                  <span className="text-xs font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                    {selectedArchiveLocation.location_code}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600">
                เลือกแฟ้มจัดเก็บต้นฉบับเอกสาร / ใบเสร็จเลขพัสดุ (หากเป็นการต่อเรื่องจากหนังสือรับ ระบบจะบันทึกจัดเก็บหนังสือรับเข้าแฟ้มนี้ให้อัตโนมัติ)
              </p>
              <select
                value={selectedArchiveId}
                onChange={(e) => setSelectedArchiveId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="">-- ยังไม่จัดเก็บเข้าแฟ้ม (บันทึกเฉพาะเลข Tracking) --</option>
                {archiveLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    [{loc.location_code}] {loc.folder_name || loc.sequence} (ตู้ {loc.cabinet} / ชั้น {loc.shelf} • หมวด {loc.category})
                  </option>
                ))}
              </select>
            </div>

            {/* หมายเหตุ */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุเพิ่มเติม</label>
              <textarea
                name="notes"
                rows={2}
                value={formData.notes}
                onChange={handleChange}
                placeholder="ระบุหมายเหตุหรือข้อมูลอ้างอิงเพิ่มเติม (ถ้ามี)..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-4 pt-4 border-t">
            <Link 
              href="/tracking" 
              className="px-6 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm"
            >
              ยกเลิก
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-all shadow-md shadow-red-200 hover:shadow-lg hover:shadow-red-300/40 disabled:opacity-70 flex items-center text-sm"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  กำลังบันทึก...
                </>
              ) : (
                "บันทึกเลข Tracking"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NewTrackingPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-gray-500">กำลังโหลดข้อมูล...</div>}>
      <NewTrackingContent />
    </Suspense>
  );
}
