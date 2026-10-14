"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { db } from "@/lib/firebase/config";
import { collection, doc, runTransaction, getDocs, query, where, serverTimestamp } from "firebase/firestore";
import { User } from "@/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewIncomingDocumentPage() {
  const { appUser } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [users, setUsers] = useState<User[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    document_number: "",
    document_date: "",
    received_date: new Date().toISOString().split('T')[0],
    subject: "",
    sender: "",
    department: "",
    urgency: "ปกติ",
    confidentiality: "ปกติ",
    responsible_user_id: "",
    notes: "",
  });

  useEffect(() => {
    // Fetch users for the assigned to dropdown
    const fetchUsers = async () => {
      try {
        const q = query(collection(db, "users"), where("isActive", "==", true));
        const querySnapshot = await getDocs(q);
        const usersList: User[] = [];
        querySnapshot.forEach((doc) => {
          usersList.push(doc.data() as User);
        });
        setUsers(usersList);
      } catch (err) {
        console.error("Failed to fetch users", err);
      }
    };
    fetchUsers();
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
      // Create document via Transaction to safely generate running number
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
        
        // Pad with zeros, e.g., 0001
        const formattedNumber = nextNumber.toString().padStart(4, "0");
        const runningNumber = `${formattedNumber}/${currentYear}`;

        // Update config
        transaction.set(configRef, {
          current_year: currentYear,
          incoming_last_number: nextNumber,
          // Keep other fields if they exist
          outgoing_last_number: configDoc.exists() && yearInConfig === currentYear ? configDoc.data().outgoing_last_number : 0,
          internal_last_number: configDoc.exists() && yearInConfig === currentYear ? configDoc.data().internal_last_number : 0,
        }, { merge: true });

        // Create new document
        const newDocRef = doc(collection(db, "documents"));
        const docData = {
          id: newDocRef.id,
          running_number: runningNumber,
          document_type: "incoming",
          document_number: formData.document_number,
          document_date: formData.document_date ? new Date(formData.document_date) : null,
          received_date: formData.received_date ? new Date(formData.received_date) : null,
          subject: formData.subject,
          description: "", // Can add later
          sender: formData.sender,
          recipient: "ผู้อำนวยการ", // Default or form field
          department: formData.department,
          urgency: formData.urgency,
          confidentiality: formData.confidentiality,
          responsible_user_id: formData.responsible_user_id,
          status: "registered",
          notes: formData.notes,
          drive_links: [],
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
          new_value: { running_number: runningNumber, subject: formData.subject },
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
          <p className="text-sm text-gray-500">บันทึกข้อมูลหนังสือรับใหม่เข้าระบบ</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-md text-sm border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-8">
        {/* Section 1: Document Info */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">ข้อมูลเอกสาร</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เลขที่หนังสือ (ภายนอก) <span className="text-red-500">*</span></label>
              <input type="text" name="document_number" required value={formData.document_number} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="เช่น ที่ มท 0201.2/123" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">วันที่ลงในหนังสือ <span className="text-red-500">*</span></label>
              <input type="date" name="document_date" required value={formData.document_date} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">เรื่อง <span className="text-red-500">*</span></label>
              <input type="text" name="subject" required value={formData.subject} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="ชื่อเรื่องหนังสือ" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">จาก (หน่วยงานที่ส่งมา) <span className="text-red-500">*</span></label>
              <input type="text" name="sender" required value={formData.sender} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="ชื่อหน่วยงานผู้ส่ง" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">วันที่รับหนังสือ <span className="text-red-500">*</span></label>
              <input type="date" name="received_date" required value={formData.received_date} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
            </div>
          </div>
        </div>

        {/* Section 2: Routing & Status */}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">ชั้นความลับ</label>
              <select name="confidentiality" value={formData.confidentiality} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                <option value="ปกติ">ปกติ (เปิดเผย)</option>
                <option value="ลับ">ลับ</option>
                <option value="ลับมาก">ลับมาก</option>
                <option value="ลับที่สุด">ลับที่สุด</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">มอบหมายผู้รับผิดชอบ (Optional)</label>
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
          <Link href="/incoming" className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition-colors">
            ยกเลิก
          </Link>
          <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-70 flex items-center">
            {isSubmitting ? (
              <><div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div> บันทึกข้อมูล...</>
            ) : "ลงทะเบียนรับหนังสือ"}
          </button>
        </div>
      </form>
    </div>
  );
}
