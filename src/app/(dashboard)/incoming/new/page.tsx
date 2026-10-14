"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { db } from "@/lib/firebase/config";
import { collection, doc, runTransaction, getDoc, serverTimestamp } from "firebase/firestore";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const SENDER_ORGANIZATIONS = [
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

export default function NewIncomingDocumentPage() {
  const { appUser } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [runningNumber, setRunningNumber] = useState("");
  const [senderOption, setSenderOption] = useState("ปข.6");
  const [customSender, setCustomSender] = useState("");

  // Form State
  const [formData, setFormData] = useState({
    document_number: "",
    document_date: "",
    received_date: new Date().toISOString().split('T')[0],
    subject: "",
    notes: "",
  });

  const [driveLink, setDriveLink] = useState({
    title: "",
    url: "",
  });

  useEffect(() => {
    // Fetch next running number preview on load
    const fetchNextRunningNumber = async () => {
      try {
        const currentYear = new Date().getFullYear() + 543;
        const configRef = doc(db, "system_configs", "running_numbers");
        const configSnap = await getDoc(configRef);
        let lastNum = 0;
        if (configSnap.exists()) {
          const data = configSnap.data();
          lastNum = data.incoming_last_number || 0;
        }
        const nextNum = (lastNum + 1).toString();
        setRunningNumber(nextNum);
      } catch (err) {
        console.error("Failed to fetch running number preview", err);
        setRunningNumber("1");
      }
    };

    fetchNextRunningNumber();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appUser) return;

    const finalSender = senderOption === "อื่นๆ (ระบุเอง)" ? customSender.trim() : senderOption;
    if (!finalSender) {
      setError("กรุณาระบุหน่วยงานที่ส่งมา");
      return;
    }

    if (!runningNumber.trim()) {
      setError("กรุณาระบุเลขที่ลงรับ");
      return;
    }
    
    setIsSubmitting(true);
    setError("");

    try {
      await runTransaction(db, async (transaction) => {
        const currentYear = new Date().getFullYear() + 543; // BE Year
        const configRef = doc(db, "system_configs", "running_numbers");
        const configDoc = await transaction.get(configRef);

        let incomingLastNumber = 0;
        let yearInConfig = currentYear;

        if (configDoc.exists()) {
          const data = configDoc.data();
          if (data.current_year === currentYear) {
            incomingLastNumber = data.incoming_last_number || 0;
          }
          yearInConfig = data.current_year;
        }

        const nextNumber = incomingLastNumber + 1;
        const finalRunningNumber = runningNumber.trim();

        // Update config
        transaction.set(configRef, {
          current_year: currentYear,
          incoming_last_number: nextNumber,
          outgoing_last_number: configDoc.exists() && yearInConfig === currentYear ? configDoc.data().outgoing_last_number : 0,
          internal_last_number: configDoc.exists() && yearInConfig === currentYear ? configDoc.data().internal_last_number : 0,
        }, { merge: true });

        // Create new document
        const newDocRef = doc(collection(db, "documents"));
        const docData = {
          id: newDocRef.id,
          running_number: finalRunningNumber,
          document_type: "incoming",
          document_number: formData.document_number,
          document_date: formData.document_date ? new Date(formData.document_date) : null,
          received_date: formData.received_date ? new Date(formData.received_date) : null,
          subject: formData.subject,
          description: "",
          sender: finalSender,
          recipient: "ผู้อำนวยการ",
          department: finalSender,
          urgency: "ปกติ",
          confidentiality: "ปกติ",
          responsible_user_id: "",
          status: "registered",
          notes: formData.notes,
          drive_links: driveLink.url.trim() ? [{
            title: driveLink.title.trim() || "เอกสารแนบ Google Drive",
            url: driveLink.url.trim().startsWith("http") ? driveLink.url.trim() : `https://${driveLink.url.trim()}`,
            description: "",
            created_by: appUser.displayName || "เจ้าหน้าที่",
            created_at: new Date(),
          }] : [],
          archive_location_id: "",
          related_documents: [],
          created_by: appUser.id,
          updated_by: appUser.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          deleted: false,
        };
        transaction.set(newDocRef, docData);

        // Add Activity Log
        const logRef = doc(collection(db, "activity_logs"));
        transaction.set(logRef, {
          id: logRef.id,
          user_id: appUser.id,
          user_name: appUser.displayName,
          action: "CREATE_DOCUMENT",
          entity_type: "document",
          entity_id: newDocRef.id,
          new_value: { running_number: finalRunningNumber, subject: formData.subject, sender: finalSender },
          timestamp: serverTimestamp(),
        });
      });

      router.push("/incoming");
    } catch (err: any) {
      console.error(err);
      setError("เกิดข้อผิดพลาดในการลงทะเบียนหนังสือ: " + err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Link href="/incoming" className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ลงทะเบียนหนังสือรับภายนอก</h1>
          <p className="text-sm text-gray-500">บันทึกข้อมูลหนังสือรับใหม่เข้าระบบสารบรรณ</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-md text-sm border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">ข้อมูลเอกสารรับเข้า</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. เลขที่ลงรับ */}
            <div className="md:col-span-2 bg-red-50/50 p-4 rounded-xl border border-red-200">
              <label className="block text-sm font-semibold text-red-900 mb-1">
                เลขที่ลงรับ (เลขทะเบียนรับ) <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                required 
                value={runningNumber} 
                onChange={(e) => setRunningNumber(e.target.value)} 
                className="w-full md:w-1/2 px-4 py-2 border border-red-200 rounded-lg font-mono text-lg font-bold text-red-700 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500" 
                placeholder="เช่น 1, 2, 3..." 
              />
              <p className="text-xs text-red-600/80 mt-1">
                ระบบรันตัวเลขอัตโนมัติให้ต่อเนื่อง (สามารถปรับเปลี่ยนหรือระบุเองได้)
              </p>
            </div>

            {/* เลขที่หนังสือภายนอก */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                เลขที่หนังสือ (ภายนอก) <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                name="document_number" 
                required 
                value={formData.document_number} 
                onChange={handleChange} 
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" 
                placeholder="เช่น ที่ มท 0201.2/123" 
              />
            </div>

            {/* วันที่ลงในหนังสือ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                วันที่ลงในหนังสือ <span className="text-red-500">*</span>
              </label>
              <input 
                type="date" 
                name="document_date" 
                required 
                value={formData.document_date} 
                onChange={handleChange} 
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" 
              />
            </div>

            {/* เรื่อง */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                เรื่อง <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                name="subject" 
                required 
                value={formData.subject} 
                onChange={handleChange} 
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" 
                placeholder="ชื่อเรื่องหนังสือ" 
              />
            </div>

            {/* 3. จาก (หน่วยงานที่ส่งมา) - Dropdown List */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                จาก (หน่วยงานที่ส่งมา) <span className="text-red-500">*</span>
              </label>
              <select
                value={senderOption}
                onChange={(e) => setSenderOption(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                {SENDER_ORGANIZATIONS.map((org) => (
                  <option key={org} value={org}>{org}</option>
                ))}
              </select>

              {senderOption === "อื่นๆ (ระบุเอง)" && (
                <div className="mt-2">
                  <input
                    type="text"
                    required
                    value={customSender}
                    onChange={(e) => setCustomSender(e.target.value)}
                    placeholder="กรุณาระบุชื่อหน่วยงานที่ส่งมา..."
                    className="w-full px-4 py-2 border border-blue-400 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-blue-50/30"
                  />
                </div>
              )}
            </div>

            {/* วันที่รับหนังสือ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                วันที่รับหนังสือ <span className="text-red-500">*</span>
              </label>
              <input 
                type="date" 
                name="received_date" 
                required 
                value={formData.received_date} 
                onChange={handleChange} 
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" 
              />
            </div>

            {/* แนบลิงก์ Google Drive (ถ้ามี) */}
            <div className="md:col-span-2 pt-2 border-t border-gray-100">
              <label className="block text-sm font-semibold text-gray-800 mb-2">แนบลิงก์ Google Drive (ถ้ามี)</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">ชื่อไฟล์ / หัวข้อเอกสาร</label>
                  <input
                    type="text"
                    value={driveLink.title}
                    onChange={(e) => setDriveLink({ ...driveLink, title: e.target.value })}
                    placeholder="เช่น หนังสือสแกนต้นฉบับ.pdf"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">URL ลิงก์ Google Drive</label>
                  <input
                    type="text"
                    value={driveLink.url}
                    onChange={(e) => setDriveLink({ ...driveLink, url: e.target.value })}
                    placeholder="https://drive.google.com/..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* 2. หมายเหตุ (คงไว้ ส่วนระดับความสำคัญและการมอบหมายเอาออกแล้ว) */}
            <div className="md:col-span-2 pt-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
              <textarea 
                name="notes" 
                value={formData.notes} 
                onChange={handleChange} 
                rows={3} 
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" 
                placeholder="ระบุข้อมูลเพิ่มเติม (ถ้ามี)..." 
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-4 pt-4 border-t">
          <Link href="/incoming" className="px-6 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm">
            ยกเลิก
          </Link>
          <button 
            type="submit" 
            disabled={isSubmitting} 
            className="px-6 py-2.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-all shadow-md shadow-red-200 hover:shadow-lg hover:shadow-red-300/40 disabled:opacity-70 flex items-center text-sm"
          >
            {isSubmitting ? (
              <><div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div> บันทึกข้อมูล...</>
            ) : "ลงทะเบียนรับหนังสือ"}
          </button>
        </div>
      </form>
    </div>
  );
}
