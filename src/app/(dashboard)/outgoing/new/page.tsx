"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { db } from "@/lib/firebase/config";
import { collection, doc, runTransaction, getDocs, getDoc, query, where, serverTimestamp } from "firebase/firestore";
import { SarabanDocument } from "@/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const RECIPIENT_ORGANIZATIONS = [
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

export default function NewOutgoingDocumentPage() {
  const { appUser } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [incomingDocs, setIncomingDocs] = useState<SarabanDocument[]>([]);
  const [runningNumber, setRunningNumber] = useState("");

  const [recipientOption, setRecipientOption] = useState("ปข.6");
  const [customRecipient, setCustomRecipient] = useState("");

  // Form State
  const [formData, setFormData] = useState({
    document_date: new Date().toISOString().split('T')[0],
    sent_date: new Date().toISOString().split('T')[0],
    subject: "",
    notes: "",
    related_document_id: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const currentYear = new Date().getFullYear() + 543;

        // 1. Fetch next outgoing running number preview
        const configRef = doc(db, "system_configs", "running_numbers");
        const configSnap = await getDoc(configRef);
        let lastNum = 0;
        if (configSnap.exists()) {
          const data = configSnap.data();
          lastNum = data.outgoing_last_number || 0;
        }
        const nextNum = (lastNum + 1).toString();
        setRunningNumber(nextNum);

        // 2. Fetch incoming docs for reply reference
        const qDocs = query(
          collection(db, "documents"), 
          where("document_type", "==", "incoming"), 
          where("deleted", "==", false)
        );
        const docsSnap = await getDocs(qDocs);
        const docsList: SarabanDocument[] = [];
        docsSnap.forEach((doc) => docsList.push(doc.data() as SarabanDocument));
        setIncomingDocs(docsList);
      } catch (err) {
        console.error("Failed to fetch data", err);
        const currentYear = new Date().getFullYear() + 543;
        setRunningNumber(`ส่ง.0001/${currentYear}`);
      }
    };
    fetchData();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appUser) return;
    
    if (!runningNumber.trim()) {
      setError("กรุณาระบุเลขทะเบียนส่ง");
      return;
    }

    const finalRecipient = recipientOption === "อื่นๆ (ระบุเอง)" ? customRecipient.trim() : recipientOption;
    if (!finalRecipient) {
      setError("กรุณาระบุหน่วยงานผู้รับ");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await runTransaction(db, async (transaction) => {
        const currentYear = new Date().getFullYear() + 543;
        const configRef = doc(db, "system_configs", "running_numbers");
        const configDoc = await transaction.get(configRef);

        let outgoingLastNumber = 0;
        let yearInConfig = currentYear;

        if (configDoc.exists()) {
          const data = configDoc.data();
          if (data.current_year === currentYear) {
            outgoingLastNumber = data.outgoing_last_number || 0;
          }
          yearInConfig = data.current_year;
        }

        const nextNumber = outgoingLastNumber + 1;
        const finalRunningNumber = runningNumber.trim();

        transaction.set(configRef, {
          current_year: currentYear,
          incoming_last_number: configDoc.exists() && yearInConfig === currentYear ? configDoc.data().incoming_last_number : 0,
          outgoing_last_number: nextNumber,
          internal_last_number: configDoc.exists() && yearInConfig === currentYear ? configDoc.data().internal_last_number : 0,
        }, { merge: true });

        const newDocRef = doc(collection(db, "documents"));
        const docData = {
          id: newDocRef.id,
          running_number: finalRunningNumber,
          document_type: "outgoing",
          document_number: finalRunningNumber,
          document_date: formData.document_date ? new Date(formData.document_date) : null,
          sent_date: formData.sent_date ? new Date(formData.sent_date) : null,
          subject: formData.subject,
          description: "",
          sender: appUser.department || "สำนักงาน",
          recipient: finalRecipient,
          department: appUser.department || "สำนักงาน",
          urgency: "ปกติ",
          confidentiality: "ปกติ",
          responsible_user_id: "",
          status: "registered",
          notes: formData.notes,
          drive_links: [],
          archive_location_id: "",
          related_documents: formData.related_document_id ? [formData.related_document_id] : [],
          created_by: appUser.id,
          updated_by: appUser.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          deleted: false,
        };
        transaction.set(newDocRef, docData);

        // Link back from the incoming document if selected
        if (formData.related_document_id) {
          const relatedDocRef = doc(db, "documents", formData.related_document_id);
          const relatedDocSnap = await transaction.get(relatedDocRef);
          if (relatedDocSnap.exists()) {
            const relatedDocData = relatedDocSnap.data();
            const existingLinks = relatedDocData.related_documents || [];
            if (!existingLinks.includes(newDocRef.id)) {
              transaction.update(relatedDocRef, {
                related_documents: [...existingLinks, newDocRef.id],
                updatedAt: serverTimestamp()
              });
            }
          }
        }

        const logRef = doc(collection(db, "activity_logs"));
        transaction.set(logRef, {
          id: logRef.id,
          user_id: appUser.id,
          user_name: appUser.displayName,
          action: "CREATE_DOCUMENT",
          entity_type: "document",
          entity_id: newDocRef.id,
          new_value: { running_number: finalRunningNumber, subject: formData.subject, type: "outgoing" },
          timestamp: serverTimestamp(),
        });
      });

      router.push("/outgoing");
    } catch (err: any) {
      console.error(err);
      setError("เกิดข้อผิดพลาดในการลงทะเบียนหนังสือ: " + err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Link href="/outgoing" className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ทะเบียนหนังสือส่ง</h1>
          <p className="text-sm text-gray-500">สร้างและออกเลขหนังสือส่งออกภายนอกหน่วยงาน</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-md text-sm border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">ข้อมูลหนังสือส่ง</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 3. เลขทะเบียนส่ง */}
            <div className="md:col-span-2 bg-emerald-50/60 p-4 rounded-lg border border-emerald-200">
              <label className="block text-sm font-semibold text-emerald-900 mb-1">
                เลขทะเบียนส่ง (เลขที่ส่ง) <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                required 
                value={runningNumber} 
                onChange={(e) => setRunningNumber(e.target.value)} 
                className="w-full md:w-1/2 px-4 py-2 border border-emerald-300 rounded-md font-mono text-lg font-bold text-emerald-800 bg-white focus:ring-emerald-500 focus:border-emerald-500" 
                placeholder="เช่น 1, 2, 3..." 
              />
              <p className="text-xs text-emerald-700 mt-1">
                ระบบรันตัวเลขอัตโนมัติต่อเนื่อง (สามารถปรับเปลี่ยนหรือกำหนดเลขเองได้)
              </p>
            </div>

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
                placeholder="ชื่อเรื่องหนังสือส่ง" 
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                เรียน (หน่วยงานผู้รับ) <span className="text-red-500">*</span>
              </label>
              <select
                value={recipientOption}
                onChange={(e) => setRecipientOption(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                {RECIPIENT_ORGANIZATIONS.map((org) => (
                  <option key={org} value={org}>{org}</option>
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
                    className="w-full px-4 py-2 border border-emerald-400 rounded-md focus:ring-emerald-500 focus:border-emerald-500 bg-emerald-50/30"
                  />
                </div>
              )}
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
          </div>
        </div>

        {/* ความเชื่อมโยงกับหนังสือรับ */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">ความเชื่อมโยงกับหนังสือรับ (ตอบกลับ)</h2>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">อ้างอิงหนังสือรับ (ถ้ามี)</label>
            <select 
              name="related_document_id" 
              value={formData.related_document_id} 
              onChange={handleChange} 
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="">-- ไม่ระบุอ้างอิง --</option>
              {incomingDocs.map(doc => (
                <option key={doc.id} value={doc.id}>
                  {doc.running_number} - {doc.subject.substring(0, 50)}{doc.subject.length > 50 ? '...' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 1. หมายเหตุ (คงไว้ ส่วนระดับความสำคัญและการมอบหมายเอาออกแล้ว) */}
        <div>
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

        <div className="flex justify-end space-x-4 pt-4 border-t">
          <Link href="/outgoing" className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition-colors">
            ยกเลิก
          </Link>
          <button 
            type="submit" 
            disabled={isSubmitting} 
            className="px-6 py-2 bg-emerald-600 text-white font-medium rounded-md hover:bg-emerald-700 transition-colors disabled:opacity-70 flex items-center shadow-sm"
          >
            {isSubmitting ? (
              <><div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div> บันทึกข้อมูล...</>
            ) : "ออกเลขหนังสือส่ง"}
          </button>
        </div>
      </form>
    </div>
  );
}
