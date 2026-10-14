"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { db } from "@/lib/firebase/config";
import { collection, doc, setDoc, updateDoc, getDocs, query, where, serverTimestamp } from "firebase/firestore";
import { SarabanDocument } from "@/types";
import { ArrowLeft, ExternalLink, Package, FileText, Search, Check } from "lucide-react";
import Link from "next/link";

const COURIER_OPTIONS = [
  "EMS",
  "ลงทะเบียน",
  "พัสดุ",
  "อื่นๆ (ระบุเอง)"
];

const RECIPIENT_BRANCHES = [
  "ปข.6",
  "ปณ.สวรรคโลก",
  "ปณ.ศรีสำโรง",
  "ปณ.ศรีสัชนาลัย",
  "ปณ.บ้านด่านลานหอย",
  "ปณ.ทุ่งเสลี่ยม",
  "ปณ.คีรีมาศ",
  "ปณ.กงไกรลาศ",
  "ปณ.ศรีนคร",
  "ปณ.ท่าชัย",
  "ปณ.เมืองเก่า",
  "ปณ.บ้านสวน",
  "ปณ.บ้านใหม่ไชยมงคล",
  "อื่นๆ (ระบุเอง)"
];

export default function NewTrackingPage() {
  const { appUser } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [outgoingDocs, setOutgoingDocs] = useState<SarabanDocument[]>([]);

  // Mode: 'from_doc' | 'standalone'
  const [mode, setMode] = useState<'from_doc' | 'standalone'>('from_doc');
  const [selectedDocId, setSelectedDocId] = useState("");
  const [docSearchTerm, setDocSearchTerm] = useState("");

  // Courier state
  const [courierOption, setCourierOption] = useState("EMS");
  const [customCourier, setCustomCourier] = useState("");

  // Standalone recipient dropdown state
  const [recipientOption, setRecipientOption] = useState("ปข.6");
  const [customRecipient, setCustomRecipient] = useState("");

  const [formData, setFormData] = useState({
    tracking_number: "",
    sent_date: new Date().toISOString().split('T')[0],
    subject: "",
    recipient_name: "",
    notes: "",
  });

  useEffect(() => {
    const fetchOutgoing = async () => {
      try {
        const q = query(
          collection(db, "documents"),
          where("document_type", "==", "outgoing"),
          where("deleted", "==", false)
        );
        const snap = await getDocs(q);
        const docs = snap.docs.map(d => d.data() as SarabanDocument);
        setOutgoingDocs(docs);
      } catch (err) {
        console.error("Failed to fetch outgoing docs:", err);
      }
    };
    fetchOutgoing();
  }, []);

  const handleSelectDoc = (doc: SarabanDocument) => {
    setSelectedDocId(doc.id);
    setFormData(prev => ({
      ...prev,
      subject: doc.subject || "",
      recipient_name: doc.recipient || "",
      tracking_number: doc.tracking_number || prev.tracking_number,
    }));
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
      const trackingRef = doc(collection(db, "postal_trackings"));

      const dataToSave = {
        id: trackingRef.id,
        tracking_number: formData.tracking_number.trim().toUpperCase(),
        courier: finalCourier,
        source_type: mode === 'from_doc' ? 'outgoing_doc' : 'standalone',
        outgoing_doc_id: selectedDoc ? selectedDoc.id : null,
        outgoing_running_number: selectedDoc ? selectedDoc.running_number : null,
        subject: formData.subject.trim(),
        recipient_name: finalRecipient,
        sent_date: formData.sent_date ? new Date(formData.sent_date) : new Date(),
        notes: formData.notes.trim(),
        created_by: appUser?.displayName || "เจ้าหน้าที่",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deleted: false,
      };

      await setDoc(trackingRef, dataToSave);

      // If tied to an outgoing doc, update the doc's tracking_number as well!
      if (mode === 'from_doc' && selectedDocId) {
        await updateDoc(doc(db, "documents", selectedDocId), {
          tracking_number: formData.tracking_number.trim().toUpperCase(),
          courier: finalCourier,
          updatedAt: serverTimestamp(),
        });
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

  const selectedDoc = outgoingDocs.find(d => d.id === selectedDocId);

  const checkPostalUrl = formData.tracking_number.trim() 
    ? `https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(formData.tracking_number.trim())}` 
    : "https://track.thailandpost.co.th";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* 1. ปรับชื่อเป็น "บันทึกเลข Tracking" */}
      <div className="flex items-center space-x-4">
        <Link href="/tracking" className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">บันทึกเลข Tracking</h1>
          <p className="text-sm text-gray-500">บันทึกข้อมูลและเลข Tracking สำหรับติดตามสถานะการจัดส่ง</p>
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
                <p className="text-xs text-gray-500 mt-1">ผูกเลข Tracking เข้ากับหนังสือส่งในระบบ</p>
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
                <p className="font-semibold text-gray-900">สร้างรายการส่งเอง</p>
                <p className="text-xs text-gray-500 mt-1">ส่งพัสดุ/จดหมายทั่วไป ที่ไม่มีเลขหนังสือส่ง</p>
              </div>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 pt-4 border-t border-gray-200">
          
          {/* 2. เลือกหนังสือส่งที่ต้องการระบุเลขพัสดุ ให้ค้นหาได้ */}
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
                          <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {selectedDoc && (
                <div className="text-xs text-blue-800 bg-blue-100/60 p-2.5 rounded border border-blue-200">
                  <span className="font-semibold">เลือกแล้ว:</span> เลขทะเบียน {selectedDoc.running_number} — {selectedDoc.subject} (เรียน: {selectedDoc.recipient})
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
                className="w-full px-4 py-2 border border-gray-300 rounded-md font-mono text-base uppercase focus:ring-blue-500 focus:border-blue-500 font-bold text-blue-800"
              />
              {formData.tracking_number && (
                <a 
                  href={checkPostalUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 mt-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1" />
                  ทดลองตรวจเช็คที่เว็บไปรษณีย์ไทย
                </a>
              )}
            </div>

            {/* 3. ผู้ให้บริการจัดส่ง มีเเค่ EMS / ลงทะเบียน / พัสดุ / อื่นๆ (ระบุเอง) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ผู้ให้บริการจัดส่ง <span className="text-red-500">*</span></label>
              <select
                value={courierOption}
                onChange={(e) => setCourierOption(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white"
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
                    className="w-full px-4 py-2 border border-blue-400 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-blue-50/30"
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
                placeholder="เช่น ส่งเอกสารเบิกจ่าย, ส่งแบบรายงานประจำเดือน"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* 4. ชื่อผู้รับ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ชื่อผู้รับ <span className="text-red-500">*</span>
              </label>
              
              {mode === 'from_doc' ? (
                // อิงจากหนังสือที่ต้องการส่ง (Auto-filled)
                <input
                  type="text"
                  name="recipient_name"
                  required
                  value={formData.recipient_name}
                  onChange={handleChange}
                  placeholder="อิงจากหนังสือส่งที่เลือก"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-50 focus:ring-blue-500 focus:border-blue-500 font-medium"
                />
              ) : (
                // กรณีไม่มีหนังสือส่ง: ใช้ Dropdown List สาขาไปรษณีย์
                <div>
                  <select
                    value={recipientOption}
                    onChange={(e) => setRecipientOption(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    {RECIPIENT_BRANCHES.map((branch) => (
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
                        className="w-full px-4 py-2 border border-blue-400 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-blue-50/30"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* หมายเหตุ */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุเพิ่มเติม</label>
              <textarea
                name="notes"
                rows={3}
                value={formData.notes}
                onChange={handleChange}
                placeholder="ระบุหมายเหตุหรือข้อมูลอ้างอิงเพิ่มเติม (ถ้ามี)..."
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-4 pt-4 border-t">
            <Link 
              href="/tracking" 
              className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition-colors"
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
