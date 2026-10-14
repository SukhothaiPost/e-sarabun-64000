"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { db } from "@/lib/firebase/config";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewArchiveLocationPage() {
  const { appUser } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    cabinet: "1",
    shelf: "01",
    category: "",
    folder: "",
    sequence: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const generateLocationCode = () => {
    const p1 = formData.cabinet.replace(/^ตู้\s*/, "").trim() || "1";
    const p2Raw = formData.shelf.replace(/^ชั้น\s*/, "").trim();
    const p2 = !isNaN(Number(p2Raw)) && p2Raw ? p2Raw.padStart(2, '0') : (p2Raw || "01");
    const p3 = formData.category.trim() || "XX";
    const p4Raw = formData.folder.trim();
    const p4 = !isNaN(Number(p4Raw)) && p4Raw ? p4Raw.padStart(3, '0') : (p4Raw || "000");
    const p5Raw = formData.sequence.trim();
    const p5 = !isNaN(Number(p5Raw)) && p5Raw ? p5Raw.padStart(3, '0') : (p5Raw || "000");
    return `${p1}-${p2}-${p3}-${p4}-${p5}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appUser) return;
    
    setIsSubmitting(true);
    setError("");

    try {
      const newRef = doc(collection(db, "archive_locations"));
      const locationCode = generateLocationCode();

      await setDoc(newRef, {
        id: newRef.id,
        ...formData,
        location_code: locationCode,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Add Activity Log
      const logRef = doc(collection(db, "activity_logs"));
      await setDoc(logRef, {
        id: logRef.id,
        user_id: appUser.id,
        user_name: appUser.displayName,
        action: "CREATE_ARCHIVE_LOCATION",
        entity_type: "archive_location",
        entity_id: newRef.id,
        new_value: { location_code: locationCode },
        timestamp: serverTimestamp(),
      });

      router.push("/archive");
    } catch (err: any) {
      console.error(err);
      setError("เกิดข้อผิดพลาดในการสร้างจุดจัดเก็บ: " + err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Link href="/archive" className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">เพิ่มจุดจัดเก็บเอกสาร</h1>
          <p className="text-sm text-gray-500">กำหนดตู้ ชั้น แฟ้ม สำหรับจัดเก็บเอกสารตัวจริง</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-md text-sm border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ตู้ (Cabinet) <span className="text-red-500">*</span></label>
            <input type="text" name="cabinet" required value={formData.cabinet} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="เช่น 1 หรือ ตู้ 1" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชั้น (Shelf) <span className="text-red-500">*</span></label>
            <input type="text" name="shelf" required value={formData.shelf} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="เช่น 01 หรือ 1" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">หมวดหมู่/งาน (Category) <span className="text-red-500">*</span></label>
            <input type="text" name="category" required value={formData.category} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="เช่น งานสารบรรณ, งานบุคคล, การเงิน" />
            <p className="text-xs text-gray-500 mt-1">* จะแสดง Fulltext เต็มตามชื่อหมวดหมู่ที่ระบุในรหัสสถานที่</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">แฟ้ม (Folder) <span className="text-red-500">*</span></label>
            <input type="text" name="folder" required value={formData.folder} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="เช่น 001, 01" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ลำดับ (Sequence) <span className="text-red-500">*</span></label>
            <input type="text" name="sequence" required value={formData.sequence} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="เช่น 001" />
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-md flex items-center justify-between border border-gray-200">
          <div>
            <span className="block text-xs text-gray-500 font-medium">ตัวอย่างรหัสสถานที่ (Location Code)</span>
            <span className="block text-lg font-mono font-bold text-blue-700 mt-1">{generateLocationCode()}</span>
          </div>
        </div>

        <div className="flex justify-end space-x-4 pt-4">
          <Link href="/archive" className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition-colors">
            ยกเลิก
          </Link>
          <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-70 flex items-center">
            {isSubmitting ? (
              <><div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div> บันทึกข้อมูล...</>
            ) : "บันทึกจุดจัดเก็บ"}
          </button>
        </div>
      </form>
    </div>
  );
}
