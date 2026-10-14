"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { db } from "@/lib/firebase/config";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { ArrowLeft, Camera, Image as ImageIcon, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { compressImage } from "@/lib/imageUtils";

function NewArchiveLocationContent() {
  const { appUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const prefilledCabinet = searchParams.get("cabinet") || "1";
  const prefilledShelf = searchParams.get("shelf") || "01";

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    cabinet: prefilledCabinet,
    shelf: prefilledShelf,
    category: "",
    folder: "",
    sequence: "",
    image_url: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingImage(true);
    setError("");
    try {
      const compressed = await compressImage(file, 1280, 1280, 0.8);
      setFormData(prev => ({ ...prev, image_url: compressed }));
    } catch (err: any) {
      setError("ไม่สามารถประมวลผลรูปภาพได้: " + err.message);
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setFormData(prev => ({ ...prev, image_url: "" }));
  };

  const generateLocationCode = () => {
    const p1 = formData.cabinet.replace(/^ตู้\s*/, "").trim() || "1";
    const p2Raw = formData.shelf.replace(/^ชั้น\s*/, "").trim();
    const p2 = !isNaN(Number(p2Raw)) && p2Raw ? p2Raw.padStart(2, '0') : (p2Raw || "01");
    const p3 = formData.category.trim() || "XX";
    const p4Raw = formData.folder.trim();
    const p4 = !isNaN(Number(p4Raw)) && p4Raw ? p4Raw.padStart(3, '0') : (p4Raw || "000");
    const p5Raw = formData.sequence.trim();
    const p5 = p5Raw || "ชื่อแฟ้ม";
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
        folder_name: formData.sequence,
        location_code: locationCode,
        image_url: formData.image_url || "",
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

      // Return directly to the shelf in archive view
      router.push(`/archive?cabinet=${encodeURIComponent(formData.cabinet)}&shelf=${encodeURIComponent(formData.shelf)}`);
    } catch (err: any) {
      console.error(err);
      setError("เกิดข้อผิดพลาดในการสร้างจุดจัดเก็บ: " + err.message);
      setIsSubmitting(false);
    }
  };

  const backUrl = prefilledCabinet && prefilledShelf 
    ? `/archive?cabinet=${prefilledCabinet}&shelf=${prefilledShelf}`
    : prefilledCabinet 
    ? `/archive?cabinet=${prefilledCabinet}`
    : "/archive";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Link href={backUrl} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">เพิ่มจุดจัดเก็บเอกสาร</h1>
          <p className="text-sm text-gray-500">กำหนด 1.ตู้ 2.ชั้น 3.แฟ้ม สำหรับจัดเก็บเอกสารตัวจริง</p>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              1. ตู้ (Cabinet) <span className="text-red-500">*</span>
            </label>
            <input 
              type="text" 
              name="cabinet" 
              required 
              value={formData.cabinet} 
              onChange={handleChange} 
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500" 
              placeholder="เช่น 1 หรือ ตู้ 1" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              2. ชั้นในตู้ (Shelf) <span className="text-red-500">*</span>
            </label>
            <input 
              type="text" 
              name="shelf" 
              required 
              value={formData.shelf} 
              onChange={handleChange} 
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500" 
              placeholder="เช่น 01 หรือ 1" 
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              หมวดหมู่/งาน (Category) <span className="text-red-500">*</span>
            </label>
            <input 
              type="text" 
              name="category" 
              required 
              value={formData.category} 
              onChange={handleChange} 
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500" 
              placeholder="เช่น งานสารบรรณ, งานบุคคล, การเงิน" 
            />
            <p className="text-xs text-gray-500 mt-1">* จะแสดง Fulltext เต็มตามชื่อหมวดหมู่ที่ระบุในรหัสสถานที่</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              3. เลขที่แฟ้ม (Folder No.) <span className="text-red-500">*</span>
            </label>
            <input 
              type="text" 
              name="folder" 
              required 
              value={formData.folder} 
              onChange={handleChange} 
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500" 
              placeholder="เช่น 001" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ชื่อแฟ้ม (Folder Name) <span className="text-red-500">*</span>
            </label>
            <input 
              type="text" 
              name="sequence" 
              required 
              value={formData.sequence} 
              onChange={handleChange} 
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500" 
              placeholder="เช่น แฟ้มหนังสือส่ง, แฟ้มคำสั่งแต่งตั้ง" 
            />
            <p className="text-xs text-gray-500 mt-1">* เปลี่ยนจากลำดับ (Sequence) มาเป็นชื่อแฟ้มระบุเนื้อหา</p>
          </div>
        </div>

        {/* Photo Upload Section */}
        <div className="border border-dashed border-gray-300 rounded-xl p-4 bg-gray-50/50">
          <label className="block text-sm font-semibold text-gray-800 mb-1 flex items-center">
            <Camera className="w-4 h-4 mr-2 text-red-600" />
            รูปภาพตู้ / ชั้นจัดเก็บ (ไม่บังคับ)
          </label>
          <p className="text-xs text-gray-500 mb-3">
            ถ่ายรูปหรือแนบรูปถ่ายตู้จริง / ชั้นจริง เพื่อความสะดวกในการค้นหาเอกสารทางกายภาพ
          </p>

          {formData.image_url ? (
            <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-white max-w-sm">
              <img 
                src={formData.image_url} 
                alt="รูปภาพตู้/ชั้น" 
                className="w-full h-48 object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-full shadow-md transition-colors"
                title="ลบรูปภาพ"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="flex items-center justify-center border-2 border-dashed border-red-300 hover:border-red-500 bg-red-50/40 hover:bg-red-50/80 rounded-xl p-4 cursor-pointer transition-colors group">
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment"
                  onChange={handleImageFileChange} 
                  className="hidden" 
                  disabled={isProcessingImage}
                />
                <div className="flex items-center space-x-2 text-red-700 font-medium text-sm">
                  {isProcessingImage ? (
                    <>
                      <div className="h-4 w-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>กำลังประมวลผลรูปภาพ...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-5 h-5 group-hover:scale-110 transition-transform" />
                      <span>ถ่ายรูป / อัปโหลดรูปภาพตู้และชั้น</span>
                    </>
                  )}
                </div>
              </label>
              
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">หรือระบุ URL รูปภาพ:</span>
                <input 
                  type="url" 
                  name="image_url" 
                  value={formData.image_url} 
                  onChange={handleChange} 
                  placeholder="https://..."
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
                />
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-50 p-4 rounded-xl flex items-center justify-between border border-gray-200">
          <div>
            <span className="block text-xs text-gray-500 font-medium">ตัวอย่างรหัสสถานที่ (Location Code)</span>
            <span className="block text-lg font-mono font-bold text-red-700 mt-1">{generateLocationCode()}</span>
          </div>
        </div>

        <div className="flex justify-end space-x-4 pt-4">
          <Link href={backUrl} className="px-6 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors text-sm">
            ยกเลิก
          </Link>
          <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-all shadow-md shadow-red-200 hover:shadow-lg hover:shadow-red-300/40 disabled:opacity-70 flex items-center text-sm">
            {isSubmitting ? (
              <><div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div> บันทึกข้อมูล...</>
            ) : "บันทึกจุดจัดเก็บ"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewArchiveLocationPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-gray-500">กำลังโหลด...</div>}>
      <NewArchiveLocationContent />
    </Suspense>
  );
}
