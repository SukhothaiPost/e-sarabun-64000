"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { db } from "@/lib/firebase/config";
import { collection, doc, runTransaction, getDocs, query, where, serverTimestamp } from "firebase/firestore";
import { User, SarabanDocument } from "@/types";
import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";

export default function NewOutgoingDocumentPage() {
  const { appUser } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [incomingDocs, setIncomingDocs] = useState<SarabanDocument[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Form State
  const [formData, setFormData] = useState({
    document_date: new Date().toISOString().split('T')[0],
    sent_date: new Date().toISOString().split('T')[0],
    subject: "",
    recipient: "",
    department: "",
    urgency: "ปกติ",
    confidentiality: "ปกติ",
    responsible_user_id: "",
    notes: "",
    related_document_id: "",
    tracking_number: "",
    courier: "ไปรษณีย์ไทย (EMS)",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const qUsers = query(collection(db, "users"), where("isActive", "==", true));
        const usersSnap = await getDocs(qUsers);
        const usersList: User[] = [];
        usersSnap.forEach((doc) => usersList.push(doc.data() as User));
        setUsers(usersList);

        const qDocs = query(collection(db, "documents"), where("document_type", "==", "incoming"), where("deleted", "==", false));
        const docsSnap = await getDocs(qDocs);
        const docsList: SarabanDocument[] = [];
        docsSnap.forEach((doc) => docsList.push(doc.data() as SarabanDocument));
        setIncomingDocs(docsList);
      } catch (err) {
        console.error("Failed to fetch data", err);
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
        const formattedNumber = nextNumber.toString().padStart(4, "0");
        const runningNumber = `ส่ง.${formattedNumber}/${currentYear}`; // Prefix with ส่ง (Sent) or similar depending on org rules

        transaction.set(configRef, {
          current_year: currentYear,
          incoming_last_number: configDoc.exists() && yearInConfig === currentYear ? configDoc.data().incoming_last_number : 0,
          outgoing_last_number: nextNumber,
          internal_last_number: configDoc.exists() && yearInConfig === currentYear ? configDoc.data().internal_last_number : 0,
        }, { merge: true });

        const newDocRef = doc(collection(db, "documents"));
        const docData = {
          id: newDocRef.id,
          running_number: runningNumber,
          document_type: "outgoing",
          document_number: runningNumber, // Often same as running number for internal sending
          document_date: formData.document_date ? new Date(formData.document_date) : null,
          sent_date: formData.sent_date ? new Date(formData.sent_date) : null,
          subject: formData.subject,
          description: "",
          sender: appUser.department || "สำนักงาน",
          recipient: formData.recipient,
          department: formData.department,
          urgency: formData.urgency,
          confidentiality: formData.confidentiality,
          responsible_user_id: formData.responsible_user_id,
          status: "registered",
          notes: formData.notes,
          tracking_number: formData.tracking_number.trim().toUpperCase(),
          courier: formData.courier,
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

        // If tracking number provided, also record in postal_trackings
        if (formData.tracking_number.trim()) {
          const postalRef = doc(collection(db, "postal_trackings"));
          transaction.set(postalRef, {
            id: postalRef.id,
            tracking_number: formData.tracking_number.trim().toUpperCase(),
            courier: formData.courier,
            source_type: "outgoing_doc",
            outgoing_doc_id: newDocRef.id,
            outgoing_running_number: runningNumber,
            subject: formData.subject.trim(),
            recipient_name: formData.recipient.trim(),
            sent_date: formData.sent_date ? new Date(formData.sent_date) : new Date(),
            notes: formData.notes.trim(),
            created_by: appUser.displayName || "เจ้าหน้าที่",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            deleted: false,
          });
        }

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
          new_value: { running_number: runningNumber, subject: formData.subject, type: "outgoing" },
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
          <p className="text-sm text-gray-500">สร้างหนังสือส่งออกภายนอกหน่วยงาน</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-md text-sm border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-8">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">ข้อมูลการส่ง</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">เรื่อง <span className="text-red-500">*</span></label>
              <input type="text" name="subject" required value={formData.subject} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="ชื่อเรื่องหนังสือส่ง" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เรียน (ผู้รับ) <span className="text-red-500">*</span></label>
              <input type="text" name="recipient" required value={formData.recipient} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="ชื่อหน่วยงานผู้รับ" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">วันที่ส่ง <span className="text-red-500">*</span></label>
              <input type="date" name="sent_date" required value={formData.sent_date} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">วันที่ลงในหนังสือ <span className="text-red-500">*</span></label>
              <input type="date" name="document_date" required value={formData.document_date} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">ความเชื่อมโยงกับหนังสือรับ (ตอบกลับ)</h2>
          <div className="md:col-span-2 relative">
             <label className="block text-sm font-medium text-gray-700 mb-1">อ้างอิงหนังสือรับ (ถ้ามี)</label>
             <select name="related_document_id" value={formData.related_document_id} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                <option value="">-- ไม่ระบุอ้างอิง --</option>
                {incomingDocs.map(doc => (
                  <option key={doc.id} value={doc.id}>
                    {doc.running_number} - {doc.subject.substring(0, 50)}{doc.subject.length > 50 ? '...' : ''}
                  </option>
                ))}
              </select>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">ข้อมูลการจัดส่งพัสดุ / ไปรษณีย์ (Tracking)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เลข Tracking พัสดุ (ถ้ามี)</label>
              <input 
                type="text" 
                name="tracking_number" 
                value={formData.tracking_number} 
                onChange={handleChange} 
                className="w-full px-4 py-2 border border-gray-300 rounded-md font-mono uppercase focus:ring-blue-500 focus:border-blue-500" 
                placeholder="เช่น ED123456789TH" 
              />
              <p className="text-xs text-gray-500 mt-1">สามารถบันทึกหรือเพิ่มภายหลังในเมนู บันทึกเลข Tracking ได้</p>
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
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">ระดับความสำคัญและการมอบหมาย</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ความเร่งด่วน</label>
              <select name="urgency" value={formData.urgency} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                <option value="ปกติ">ปกติ</option>
                <option value="ด่วน">ด่วน</option>
                <option value="ด่วนมาก">ด่วนมาก</option>
                <option value="ด่วนที่สุด">ด่วนที่สุด</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ผู้รับผิดชอบงานนี้</label>
              <select name="responsible_user_id" value={formData.responsible_user_id} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                <option value="">-- ยังไม่ระบุ --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.displayName} ({u.department})</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
              <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="ข้อมูลเพิ่มเติม..." />
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-4 pt-4">
          <Link href="/outgoing" className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition-colors">
            ยกเลิก
          </Link>
          <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-70 flex items-center">
            {isSubmitting ? (
              <><div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div> บันทึกข้อมูล...</>
            ) : "สร้างหนังสือส่ง"}
          </button>
        </div>
      </form>
    </div>
  );
}
