"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { db } from "@/lib/firebase/config";
import { collection, doc, setDoc, updateDoc, getDocs, query, where, serverTimestamp } from "firebase/firestore";
import { SarabanDocument } from "@/types";
import { ArrowLeft, ExternalLink, Package, FileText } from "lucide-react";
import Link from "next/link";

export default function NewTrackingPage() {
  const { appUser } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [outgoingDocs, setOutgoingDocs] = useState<SarabanDocument[]>([]);

  // Mode: 'from_doc' | 'standalone'
  const [mode, setMode] = useState<'from_doc' | 'standalone'>('from_doc');
  const [selectedDocId, setSelectedDocId] = useState("");

  const [formData, setFormData] = useState({
    tracking_number: "",
    courier: "ไปรษณีย์ไทย (EMS)",
    sent_date: new Date().toISOString().split('T')[0],
    subject: "",
    recipient_name: "",
    recipient_address: "",
    fee: "",
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

  const handleSelectDoc = (docId: string) => {
    setSelectedDocId(docId);
    const target = outgoingDocs.find(d => d.id === docId);
    if (target) {
      setFormData(prev => ({
        ...prev,
        subject: target.subject || "",
        recipient_name: target.recipient || "",
        tracking_number: target.tracking_number || prev.tracking_number,
      }));
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

    setIsSubmitting(true);
    setError("");

    try {
      const selectedDoc = mode === 'from_doc' ? outgoingDocs.find(d => d.id === selectedDocId) : null;
      const trackingRef = doc(collection(db, "postal_trackings"));

      const dataToSave = {
        id: trackingRef.id,
        tracking_number: formData.tracking_number.trim().toUpperCase(),
        courier: formData.courier,
        source_type: mode === 'from_doc' ? 'outgoing_doc' : 'standalone',
        outgoing_doc_id: selectedDoc ? selectedDoc.id : null,
        outgoing_running_number: selectedDoc ? selectedDoc.running_number : null,
        subject: formData.subject.trim(),
        recipient_name: formData.recipient_name.trim(),
        recipient_address: formData.recipient_address.trim(),
        sent_date: formData.sent_date ? new Date(formData.sent_date) : new Date(),
        fee: formData.fee ? parseFloat(formData.fee) : null,
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
          courier: formData.courier,
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
          <h1 className="text-2xl font-bold text-gray-900">บันทึกเลข Tracking พัสดุ/ไปรษณีย์</h1>
          <p className="text-sm text-gray-500">บันทึกการส่งไปรษณีย์เพื่อใช้อ้างอิงและตรวจสอบสถานะ</p>
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
                  ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-500' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <FileText className={`w-6 h-6 mr-3 mt-0.5 ${mode === 'from_doc' ? 'text-blue-600' : 'text-gray-400'}`} />
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
                  ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-500' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Package className={`w-6 h-6 mr-3 mt-0.5 ${mode === 'standalone' ? 'text-blue-600' : 'text-gray-400'}`} />
              <div>
                <p className="font-semibold text-gray-900">สร้างรายการส่งเอง</p>
                <p className="text-xs text-gray-500 mt-1">ส่งพัสดุ/จดหมายทั่วไป ที่ไม่มีเลขหนังสือส่ง</p>
              </div>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 pt-4 border-t border-gray-200">
          {mode === 'from_doc' && (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                เลือกหนังสือส่งที่ต้องการระบุเลขพัสดุ <span className="text-red-500">*</span>
              </label>
              <select
                required={mode === 'from_doc'}
                value={selectedDocId}
                onChange={(e) => handleSelectDoc(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">-- กรุณาเลือกหนังสือส่ง --</option>
                {outgoingDocs.map(doc => (
                  <option key={doc.id} value={doc.id}>
                    {doc.running_number} : {doc.subject.substring(0, 50)} (ส่งถึง: {doc.recipient})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                เลข Tracking พัสดุ <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="tracking_number"
                required
                value={formData.tracking_number}
                onChange={handleChange}
                placeholder="เช่น ED123456789TH"
                className="w-full px-4 py-2 border border-gray-300 rounded-md font-mono text-base uppercase focus:ring-blue-500 focus:border-blue-500"
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ผู้ให้บริการจัดส่ง</label>
              <select
                name="courier"
                value={formData.courier}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ไปรษณีย์ไทย (EMS)">ไปรษณีย์ไทย (EMS)</option>
                <option value="ไปรษณีย์ไทย (ลงทะเบียน)">ไปรษณีย์ไทย (ลงทะเบียน)</option>
                <option value="ไปรษณีย์ไทย (พัสดุในประเทศ)">ไปรษณีย์ไทย (พัสดุในประเทศ)</option>
                <option value="Flash Express">Flash Express</option>
                <option value="Kerry Express">Kerry Express</option>
                <option value="J&T Express">J&T Express</option>
                <option value="อื่นๆ">อื่นๆ</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                เรื่อง / รายการเอกสารหรือพัสดุที่ส่ง <span className="text-red-500">*</span>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ชื่อผู้รับ <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="recipient_name"
                required
                value={formData.recipient_name}
                onChange={handleChange}
                placeholder="ชื่อบุคคล หรือชื่อหน่วยงานผู้รับ"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ค่าบริการจัดส่ง (บาท)</label>
              <input
                type="number"
                step="0.5"
                name="fee"
                value={formData.fee}
                onChange={handleChange}
                placeholder="เช่น 42"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ที่อยู่ผู้รับ / ปลายทาง</label>
              <input
                type="text"
                name="recipient_address"
                value={formData.recipient_address}
                onChange={handleChange}
                placeholder="ที่อยู่หรือจังหวัดปลายทาง"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุเพิ่มเติม</label>
              <textarea
                name="notes"
                rows={3}
                value={formData.notes}
                onChange={handleChange}
                placeholder="หมายเหตุหรือข้อมูลอ้างอิง..."
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
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-70 flex items-center shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  กำลังบันทึก...
                </>
              ) : (
                "บันทึกข้อมูลการจัดส่ง"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
