"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, getDocs, doc, setDoc, serverTimestamp, query } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/lib/contexts/AuthContext";
import { ArchiveLocation, THAIPOST_ORGANIZATIONS } from "@/types";
import { 
  Archive, 
  Plus, 
  Folder, 
  Search, 
  Camera, 
  X, 
  Maximize2, 
  ChevronRight, 
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Layers, 
  ArrowLeft, 
  FolderCheck,
  CheckCircle,
  Upload,
  ExternalLink,
  History,
  Save,
  FileText,
  Trash2
} from "lucide-react";
import { compressImage } from "@/lib/imageUtils";

function normalizeCabinet(val: string): string {
  if (!val) return "1";
  return val.replace(/^ตู้\s*/i, "").trim() || val.trim();
}

function normalizeShelf(val: string): string {
  if (!val) return "01";
  const cleaned = val.replace(/^ชั้น\s*/i, "").trim();
  if (!isNaN(Number(cleaned)) && cleaned) {
    return cleaned.padStart(2, "0");
  }
  return cleaned;
}

function ArchiveContent() {
  const { appUser } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [locations, setLocations] = useState<ArchiveLocation[]>([]);
  const [structurePhotos, setStructurePhotos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Hierarchy Navigation State: 1. ตู้ (Cabinet) -> 2. ชั้นในตู้ (Shelf) -> 3. แฟ้ม (Folder)
  const initialCabinet = searchParams.get("cabinet") || null;
  const initialShelf = searchParams.get("shelf") || null;

  const [selectedCabinet, setSelectedCabinet] = useState<string | null>(initialCabinet);
  const [selectedShelf, setSelectedShelf] = useState<string | null>(initialShelf);

  // Sync state with URL params
  useEffect(() => {
    const cab = searchParams.get("cabinet");
    const shf = searchParams.get("shelf");
    setSelectedCabinet(cab);
    setSelectedShelf(shf);
  }, [searchParams]);

  const setHierarchy = (cabinet: string | null, shelf: string | null = null) => {
    setSelectedCabinet(cabinet);
    setSelectedShelf(shelf);
    const params = new URLSearchParams();
    if (cabinet) params.set("cabinet", cabinet);
    if (shelf) params.set("shelf", shelf);
    const q = params.toString();
    router.push(q ? `/archive?${q}` : "/archive", { scroll: false });
  };

  // Modals state
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string; subtitle?: string } | null>(null);
  const [photoModal, setPhotoModal] = useState<{
    cabinet: string;
    title: string;
    currentUrl?: string;
  } | null>(null);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string>("");
  const [uploadUrlInput, setUploadUrlInput] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [modalError, setModalError] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  // Global Historical modal states
  const [isHistModalOpen, setIsHistModalOpen] = useState(false);
  const [histSubmitting, setHistSubmitting] = useState(false);
  const [histError, setHistError] = useState("");
  const [histSenderOption, setHistSenderOption] = useState("");
  const [histCustomSender, setHistCustomSender] = useState("");
  const [histRecipientOption, setHistRecipientOption] = useState("");
  const [histCustomRecipient, setHistCustomRecipient] = useState("");
  const [showMoreHistFields, setShowMoreHistFields] = useState(false);
  const [histForm, setHistForm] = useState({
    targetLocationId: "",
    subject: "",
    historical_type: "หนังสือรับ (ย้อนหลัง)",
    document_number: "",
    document_date: new Date().toISOString().split("T")[0],
    historical_year: String(new Date().getFullYear() + 543 - 1),
    google_drive_link: "",
    page_count: "1",
    notes: "",
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  // Fetch locations & structure photos
  const fetchAll = async () => {
    try {
      const qLocs = query(collection(db, "archive_locations"));
      const snapLocs = await getDocs(qLocs);
      const locs: ArchiveLocation[] = [];
      snapLocs.forEach(doc => {
        locs.push(doc.data() as ArchiveLocation);
      });
      locs.sort((a, b) => a.location_code.localeCompare(b.location_code));
      setLocations(locs);

      // Fetch cabinet & shelf photos
      const qPhotos = query(collection(db, "archive_structure_photos"));
      const snapPhotos = await getDocs(qPhotos);
      const photoMap: Record<string, string> = {};
      snapPhotos.forEach(doc => {
        const d = doc.data();
        if (d.image_url) {
          photoMap[doc.id] = d.image_url;
        }
      });
      setStructurePhotos(photoMap);
    } catch (err) {
      console.error("Error fetching archives:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // Hierarchical Grouping: Cabinets -> Shelves -> Folders
  const hierarchyData = useMemo(() => {
    const cabinetsMap = new Map<string, {
      cabinetId: string;
      rawName: string;
      displayName: string;
      imageUrl?: string;
      shelvesMap: Map<string, {
        shelfId: string;
        rawName: string;
        displayName: string;
        categories: Set<string>;
        imageUrl?: string;
        folders: ArchiveLocation[];
      }>;
      totalFolders: number;
      categories: Set<string>;
    }>();

    for (const loc of locations) {
      const cabId = normalizeCabinet(loc.cabinet);
      const shelfId = normalizeShelf(loc.shelf);

      // 1. Cabinet
      if (!cabinetsMap.has(cabId)) {
        const cabKey = `cabinet_${cabId}`;
        cabinetsMap.set(cabId, {
          cabinetId: cabId,
          rawName: loc.cabinet,
          displayName: `ตู้ ${cabId}`,
          imageUrl: structurePhotos[cabKey] || undefined,
          shelvesMap: new Map(),
          totalFolders: 0,
          categories: new Set(),
        });
      }

      const cabEntry = cabinetsMap.get(cabId)!;
      cabEntry.totalFolders += 1;
      if (loc.category) cabEntry.categories.add(loc.category);
      if (!cabEntry.imageUrl && loc.image_url) {
        // Fallback to location photo if no specific cabinet photo
        cabEntry.imageUrl = loc.image_url;
      }

      // 2. Shelf
      if (!cabEntry.shelvesMap.has(shelfId)) {
        const shelfKey = `shelf_${cabId}_${shelfId}`;
        cabEntry.shelvesMap.set(shelfId, {
          shelfId: shelfId,
          rawName: loc.shelf,
          displayName: `ชั้น ${shelfId}`,
          categories: new Set(),
          imageUrl: structurePhotos[shelfKey] || undefined,
          folders: [],
        });
      }

      const shelfEntry = cabEntry.shelvesMap.get(shelfId)!;
      shelfEntry.folders.push(loc);
      if (loc.category) shelfEntry.categories.add(loc.category);
      if (!shelfEntry.imageUrl && loc.image_url) {
        shelfEntry.imageUrl = loc.image_url;
      }
    }

    // Sort cabinets by natural order
    const sortedCabinets = Array.from(cabinetsMap.values()).sort((a, b) => {
      const numA = Number(a.cabinetId);
      const numB = Number(b.cabinetId);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.cabinetId.localeCompare(b.cabinetId);
    });

    return sortedCabinets;
  }, [locations, structurePhotos]);

  // Current active cabinet and shelf data
  const currentCabinetData = useMemo(() => {
    if (!selectedCabinet) return null;
    const norm = normalizeCabinet(selectedCabinet);
    return hierarchyData.find(c => c.cabinetId === norm) || null;
  }, [hierarchyData, selectedCabinet]);

  const currentShelfData = useMemo(() => {
    if (!currentCabinetData || !selectedShelf) return null;
    const norm = normalizeShelf(selectedShelf);
    return currentCabinetData.shelvesMap.get(norm) || null;
  }, [currentCabinetData, selectedShelf]);

  // Filtered results for search
  const searchResults = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return null;
    return locations.filter(loc => 
      loc.location_code.toLowerCase().includes(term) ||
      loc.cabinet.toLowerCase().includes(term) ||
      loc.shelf.toLowerCase().includes(term) ||
      loc.category.toLowerCase().includes(term) ||
      loc.folder.toLowerCase().includes(term) ||
      (loc.folder_name && loc.folder_name.toLowerCase().includes(term)) ||
      (loc.sequence && loc.sequence.toLowerCase().includes(term))
    );
  }, [locations, searchTerm]);

  // Handle Photo Upload (เฉพาะตู้เอกสาร - ชั้นและแฟ้มไม่ต้องมีรูป)
  const handleOpenPhotoModal = (
    cabinet: string
  ) => {
    const cabId = normalizeCabinet(cabinet);
    const key = `cabinet_${cabId}`;
    const currentUrl = structurePhotos[key] || "";

    setPhotoModal({
      cabinet: cabId,
      title: `รูปถ่าย ตู้ ${cabId}`,
      currentUrl,
    });
    setUploadPreview(currentUrl);
    setUploadUrlInput(currentUrl.startsWith("http") ? currentUrl : "");
    setUploadFile(null);
    setModalError("");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setModalError("");
    try {
      const compressed = await compressImage(file, 1280, 1280, 0.8);
      setUploadPreview(compressed);
      setUploadFile(file);
    } catch (err: any) {
      setModalError("ไม่สามารถประมวลผลรูปภาพได้: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSavePhotoModal = async () => {
    if (!photoModal) return;

    const finalUrl = uploadPreview.trim() || uploadUrlInput.trim();
    setIsProcessing(true);
    setModalError("");

    try {
      const key = `cabinet_${photoModal.cabinet}`;

      const photoDocRef = doc(db, "archive_structure_photos", key);
      await setDoc(photoDocRef, {
        id: key,
        type: "cabinet",
        cabinet: photoModal.cabinet,
        shelf: "",
        image_url: finalUrl,
        updatedAt: serverTimestamp(),
      });

      setStructurePhotos(prev => ({
        ...prev,
        [key]: finalUrl,
      }));

      showToast(`บันทึกรูปภาพ ${photoModal.title} สำเร็จ`);
      setPhotoModal(null);
    } catch (err: any) {
      console.error(err);
      setModalError("เกิดข้อผิดพลาดในการบันทึกรูป: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeletePhoto = async () => {
    if (!photoModal) return;
    if (!confirm(`คุณต้องการลบรูปภาพ ${photoModal.title} ใช่หรือไม่?`)) return;

    setIsProcessing(true);
    try {
      const key = `cabinet_${photoModal.cabinet}`;

      const photoDocRef = doc(db, "archive_structure_photos", key);
      await setDoc(photoDocRef, {
        id: key,
        type: "cabinet",
        cabinet: photoModal.cabinet,
        shelf: "",
        image_url: "",
        updatedAt: serverTimestamp(),
      });

      setStructurePhotos(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });

      showToast(`ลบรูปภาพเรียบร้อยแล้ว`);
      setPhotoModal(null);
    } catch (err: any) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenGlobalHistModal = () => {
    setHistError("");
    let defaultLocId = "";
    if (selectedCabinet && selectedShelf && currentShelfData?.folders?.length) {
      defaultLocId = currentShelfData.folders[0].id;
    } else if (selectedCabinet && currentCabinetData) {
      const firstShelf = Array.from(currentCabinetData.shelvesMap.values())[0];
      if (firstShelf?.folders?.length) {
        defaultLocId = firstShelf.folders[0].id;
      } else if (locations.length > 0) {
        defaultLocId = locations[0].id;
      }
    } else if (locations.length > 0) {
      defaultLocId = locations[0].id;
    }

    const defaultYear = String(new Date().getFullYear() + 543 - 1);
    const todayStr = new Date().toISOString().split("T")[0];
    setHistSenderOption("");
    setHistCustomSender("");
    setHistRecipientOption("");
    setHistCustomRecipient("");
    setShowMoreHistFields(false);
    setHistForm({
      targetLocationId: defaultLocId,
      subject: "",
      historical_type: "หนังสือรับ (ย้อนหลัง)",
      document_number: "",
      document_date: todayStr,
      historical_year: defaultYear,
      google_drive_link: "",
      page_count: "1",
      notes: "",
    });
    setIsHistModalOpen(true);
  };

  const handleSaveGlobalHist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!histForm.targetLocationId) {
      setHistError("กรุณาเลือกแฟ้มจัดเก็บปลายทาง");
      return;
    }
    if (!histForm.subject.trim()) {
      setHistError("กรุณาระบุเรื่อง / ชื่อเอกสาร");
      return;
    }

    const targetLoc = locations.find(l => l.id === histForm.targetLocationId);
    if (!targetLoc) {
      setHistError("ไม่พบแฟ้มจัดเก็บที่เลือก");
      return;
    }

    let finalSender = "-";
    if (histSenderOption === "อื่นๆ (ระบุเอง)") {
      finalSender = histCustomSender.trim() || "-";
    } else if (histSenderOption) {
      finalSender = histSenderOption;
    }

    let finalRecipient = "-";
    if (histRecipientOption === "อื่นๆ (ระบุเอง)") {
      finalRecipient = histCustomRecipient.trim() || "-";
    } else if (histRecipientOption) {
      finalRecipient = histRecipientOption;
    }

    setHistSubmitting(true);
    setHistError("");

    try {
      const docDate = new Date(histForm.document_date);
      const driveLinks = histForm.google_drive_link.trim() ? [{
        title: "ไฟล์สแกนเอกสารเดิม (Google Drive)",
        url: histForm.google_drive_link.trim(),
        description: "ไฟล์สแกนเอกสารย้อนหลัง",
        created_by: appUser?.displayName || "เจ้าหน้าที่",
        created_at: new Date(),
      }] : [];

      const newDocRef = doc(collection(db, "documents"));
      const runningNum = histForm.document_number.trim() || `HIST-${Date.now().toString().slice(-6)}`;

      await setDoc(newDocRef, {
        id: newDocRef.id,
        running_number: runningNum,
        document_type: "historical",
        is_historical: true,
        historical_type: histForm.historical_type,
        historical_year: histForm.historical_year.trim(),
        document_number: histForm.document_number.trim(),
        document_date: docDate,
        subject: histForm.subject.trim(),
        sender: finalSender,
        recipient: finalRecipient,
        department: targetLoc.category || "งานสารบรรณ",
        urgency: "ปกติ",
        confidentiality: "ปกติ",
        responsible_user_id: appUser?.id || "",
        status: "archived",
        notes: histForm.notes.trim(),
        google_drive_link: histForm.google_drive_link.trim(),
        drive_links: driveLinks,
        page_count: histForm.page_count.trim(),
        archive_location_id: targetLoc.id,
        archive_location_code: targetLoc.location_code,
        archive_cabinet: targetLoc.cabinet,
        archive_shelf: targetLoc.shelf,
        archive_folder: targetLoc.folder,
        archive_folder_name: targetLoc.folder_name || targetLoc.sequence,
        related_documents: [],
        created_by: appUser?.displayName || "เจ้าหน้าที่",
        updated_by: appUser?.displayName || "เจ้าหน้าที่",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deleted: false,
      });

      showToast(`บันทึกเรื่องเก่าเข้าแฟ้ม "${targetLoc.folder_name || targetLoc.sequence}" สำเร็จ!`);
      setIsHistModalOpen(false);
      await fetchAll();
    } catch (err: any) {
      console.error(err);
      setHistError("เกิดข้อผิดพลาดในการบันทึกเอกสาร: " + err.message);
    } finally {
      setHistSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg flex items-center space-x-2 animate-in fade-in">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Main Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Archive className="w-7 h-7 mr-2.5 text-red-600" />
            จัดการคลังเอกสาร
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            โครงสร้างกายภาพ 3 ระดับ: <strong>1. ตู้เอกสาร</strong> ➔ <strong>2. ชั้นในตู้</strong> ➔ <strong>3. แฟ้มเอกสาร</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {appUser?.role !== 'viewer' && (
            <button
              type="button"
              onClick={handleOpenGlobalHistModal}
              className="flex items-center bg-white border border-red-200 hover:bg-red-50 text-red-700 font-semibold py-2.5 px-4 rounded-xl shadow-xs transition-all text-sm"
            >
              <History className="w-4 h-4 mr-1.5 text-red-600" />
              + บันทึกเรื่องเก่าย้อนหลัง
            </button>
          )}
          <Link 
            href={
              selectedShelf && selectedCabinet
                ? `/archive/new?cabinet=${selectedCabinet}&shelf=${selectedShelf}`
                : selectedCabinet
                ? `/archive/new?cabinet=${selectedCabinet}`
                : "/archive/new"
            } 
            className="flex items-center bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-md shadow-red-200 hover:shadow-lg hover:shadow-red-300/40 transition-all text-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            {selectedShelf 
              ? `เพิ่มแฟ้มในชั้น ${selectedShelf}` 
              : selectedCabinet 
              ? `เพิ่มแฟ้มในตู้ ${selectedCabinet}` 
              : "เพิ่มจุดจัดเก็บ / แฟ้มใหม่"}
          </Link>
        </div>
      </div>

      {/* Breadcrumb Navigation & Steps Indicator */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Breadcrumb Links */}
          <nav className="flex items-center space-x-2 text-sm overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => {
                setSearchTerm("");
                setHierarchy(null, null);
              }}
              className={`flex items-center px-2.5 py-1.5 rounded-lg transition-colors font-semibold ${
                !selectedCabinet 
                  ? "bg-red-100 text-red-900" 
                  : "text-gray-600 hover:text-red-700 hover:bg-gray-100"
              }`}
            >
              <Archive className="w-4 h-4 mr-1.5" />
              1. คลังตู้เอกสารทั้งหมด
            </button>

            {selectedCabinet && (
              <>
                <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setHierarchy(selectedCabinet, null);
                  }}
                  className={`flex items-center px-2.5 py-1.5 rounded-lg transition-colors font-semibold ${
                    selectedCabinet && !selectedShelf 
                      ? "bg-red-100 text-red-900" 
                      : "text-gray-600 hover:text-red-700 hover:bg-gray-100"
                  }`}
                >
                  <Layers className="w-4 h-4 mr-1.5" />
                  2. ตู้ {selectedCabinet} (ชั้นวาง)
                </button>
              </>
            )}

            {selectedCabinet && selectedShelf && (
              <>
                <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="flex items-center px-2.5 py-1.5 rounded-lg font-bold bg-red-600 text-white shadow-xs">
                  <Folder className="w-4 h-4 mr-1.5" />
                  3. ชั้น {selectedShelf} (แฟ้มเอกสาร)
                </span>
              </>
            )}
          </nav>

          {/* Quick Search across archives */}
          <div className="relative w-full md:w-72">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="ค้นหาตู้, ชั้น, ชื่อแฟ้ม, รหัส..."
              className="w-full pl-9 pr-8 py-1.5 text-xs border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:ring-1 focus:ring-red-500 focus:border-red-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* IF SEARCH IS ACTIVE: Show matched folders with breadcrumb path */}
      {searchResults !== null ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-red-50/50 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">
              ผลการค้นหา: &quot;{searchTerm}&quot; ({searchResults.length} รายการ)
            </h2>
            <button
              onClick={() => setSearchTerm("")}
              className="text-xs text-red-700 hover:underline"
            >
              ล้างการค้นหา (กลับสู่โหมดลำดับตู้/ชั้น/แฟ้ม)
            </button>
          </div>

          {searchResults.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Search className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-base font-medium text-gray-700">ไม่พบจุดจัดเก็บหรือแฟ้มที่ตรงกับคำค้น</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {searchResults.map(loc => (
                <div key={loc.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow bg-white flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-red-700 font-medium mb-2 bg-red-50 p-2 rounded-lg border border-red-100">
                      <span>ตู้ {loc.cabinet}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-red-400" />
                      <span>ชั้น {loc.shelf}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-red-400" />
                      <span className="font-bold text-gray-900">แฟ้ม {loc.folder}</span>
                    </div>

                    <p className="font-bold text-gray-900 text-sm mb-1">{loc.folder_name || loc.sequence}</p>
                    <p className="font-mono text-xs text-gray-500 mb-2">{loc.location_code}</p>
                    <p className="text-xs text-gray-500">หมวดหมู่: {loc.category}</p>
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setSearchTerm("");
                        setHierarchy(normalizeCabinet(loc.cabinet), normalizeShelf(loc.shelf));
                      }}
                      className="text-xs text-red-600 hover:underline font-medium"
                    >
                      ดูทั้งชั้นนี้ →
                    </button>
                    <Link
                      href={`/archive/${loc.id}`}
                      className="text-xs font-semibold text-red-600 hover:text-red-800 bg-red-50 px-2.5 py-1 rounded-md border border-red-100"
                    >
                      ดูเอกสารในแฟ้ม
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : loading ? (
        <div className="p-16 text-center text-gray-500 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="h-8 w-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          กำลังโหลดข้อมูลคลังเอกสาร...
        </div>
      ) : hierarchyData.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-xl border border-gray-200 shadow-sm">
          <Archive className="h-14 w-14 mx-auto text-gray-300 mb-3" />
          <p className="text-lg font-bold text-gray-800">ยังไม่มีข้อมูลจุดจัดเก็บในคลังเอกสาร</p>
          <p className="text-sm text-gray-500 mt-1 mb-5">
            เริ่มต้นเพิ่มตู้ ชั้น และแฟ้มจัดเก็บเอกสารตัวจริงเพื่อใช้งานระบบ
          </p>
          <Link
            href="/archive/new"
            className="inline-flex items-center bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-5 rounded-xl text-sm transition-colors shadow-md shadow-red-200"
          >
            <Plus className="w-4 h-4 mr-2" />
            เพิ่มตู้และจุดจัดเก็บแรก
          </Link>
        </div>
      ) : !selectedCabinet ? (
        /* ========================================================
           LEVEL 1: รายการตู้เอกสาร (CABINETS VIEW)
           ======================================================== */
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white px-5 py-3 rounded-xl border border-gray-200 shadow-2xs">
            <div>
              <h2 className="text-base font-bold text-gray-900">
                1. ตู้เอกสารทั้งหมด ({hierarchyData.length} ตู้)
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                คลิกเลือกตู้ เพื่อเปิดดูชั้นวางเอกสารภายในตู้นั้นๆ
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {hierarchyData.map(cab => {
              const cabPhoto = structurePhotos[`cabinet_${cab.cabinetId}`] || cab.imageUrl;
              const shelvesCount = cab.shelvesMap.size;
              const catsList = Array.from(cab.categories).slice(0, 3).join(", ");

              return (
                <div 
                  key={cab.cabinetId}
                  className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-red-300 transition-all overflow-hidden flex flex-col justify-between group"
                >
                  <div>
                    {/* Cabinet Photo or Graphic Header */}
                    <div className="relative h-44 bg-gradient-to-br from-slate-100 to-red-50/40 border-b border-gray-100 overflow-hidden">
                      {cabPhoto ? (
                        <>
                          <img 
                            src={cabPhoto} 
                            alt={cab.displayName}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
                            onClick={() => setPreviewImage({
                              url: cabPhoto,
                              title: cab.displayName,
                              subtitle: `มี ${shelvesCount} ชั้นวาง • ทั้งหมด ${cab.totalFolders} แฟ้มเอกสาร`
                            })}
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewImage({
                                url: cabPhoto,
                                title: cab.displayName,
                                subtitle: `มี ${shelvesCount} ชั้นวาง • ทั้งหมด ${cab.totalFolders} แฟ้มเอกสาร`
                              });
                            }}
                            className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-lg backdrop-blur-sm transition-colors text-xs flex items-center shadow-xs"
                            title="กดดูรูปตู้ขนาดเต็ม"
                          >
                            <Maximize2 className="w-3.5 h-3.5 mr-1" />
                            ดูรูปตู้
                          </button>
                        </>
                      ) : (
                        <div 
                          className="w-full h-full flex flex-col items-center justify-center text-gray-400 cursor-pointer p-4 hover:bg-red-50/60 transition-colors"
                          onClick={() => setHierarchy(cab.cabinetId, null)}
                        >
                          <Archive className="w-14 h-14 text-red-300 mb-1.5 stroke-[1.5]" />
                          <span className="text-xs font-medium text-gray-500">คลิกเพื่อเปิดดูชั้นในตู้</span>
                        </div>
                      )}

                      {/* Cabinet ID badge overlay */}
                      <div className="absolute bottom-2 left-2 bg-slate-900/85 backdrop-blur-sm text-white px-3 py-1 rounded-lg text-xs font-bold shadow-xs">
                        🏛️ {cab.displayName}
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 
                          onClick={() => setHierarchy(cab.cabinetId, null)}
                          className="text-lg font-bold text-gray-900 group-hover:text-red-600 cursor-pointer transition-colors"
                        >
                          {cab.displayName}
                        </h3>
                        <span className="text-xs font-semibold px-2.5 py-1 bg-red-50 text-red-700 rounded-lg border border-red-200">
                          {shelvesCount} ชั้นวาง
                        </span>
                      </div>

                      <div className="text-xs text-gray-600 space-y-1.5">
                        <p className="flex items-center justify-between">
                          <span className="text-gray-400 font-medium">จำนวนแฟ้มทั้งหมด:</span>
                          <span className="font-bold text-gray-800">{cab.totalFolders} แฟ้ม</span>
                        </p>
                        {catsList && (
                          <p className="text-gray-500 line-clamp-1">
                            <span className="text-gray-400 font-medium">หมวดหมู่:</span> {catsList}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Actions Footer */}
                  <div className="p-4 pt-0 space-y-2">
                    <button
                      onClick={() => setHierarchy(cab.cabinetId, null)}
                      className="w-full flex items-center justify-center bg-red-50 hover:bg-red-600 text-red-700 hover:text-white font-semibold py-2.5 px-4 rounded-xl transition-all text-xs border border-red-200 hover:border-red-600 shadow-2xs group-hover:bg-red-600 group-hover:text-white"
                    >
                      <span>เปิดดูชั้นในตู้ ({shelvesCount} ชั้น)</span>
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </button>

                    {appUser?.role !== "viewer" && (
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => handleOpenPhotoModal(cab.cabinetId)}
                          className="text-[11px] text-gray-500 hover:text-red-700 flex items-center font-medium"
                        >
                          <Camera className="w-3.5 h-3.5 mr-1 text-red-500" />
                          {cabPhoto ? "เปลี่ยนรูปถ่ายตู้" : "+ ถ่ายรูป/เพิ่มรูปตู้"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : !selectedShelf ? (
        /* ========================================================
           LEVEL 2: รายการชั้นวางในตู้ (SHELVES VIEW)
           ======================================================== */
        <div className="space-y-5">
          {/* Active Cabinet Banner */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setHierarchy(null, null)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-600"
                title="กลับไปหน้ารวมตู้"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-gray-900">
                    🏛️ ตู้ {selectedCabinet}
                  </h2>
                  <span className="text-xs font-semibold px-2.5 py-0.5 bg-red-100 text-red-800 rounded-md">
                    {currentCabinetData ? currentCabinetData.shelvesMap.size : 0} ชั้นวาง
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-md">
                    {currentCabinetData ? currentCabinetData.totalFolders : 0} แฟ้ม
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  ขั้นตอนที่ 2: เลือกชั้นวาง เพื่อเปิดดูแฟ้มเอกสารที่จัดวางอยู่ในชั้นนี้
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {structurePhotos[`cabinet_${normalizeCabinet(selectedCabinet)}`] && (
                <button
                  onClick={() => setPreviewImage({
                    url: structurePhotos[`cabinet_${normalizeCabinet(selectedCabinet)}`],
                    title: `รูปถ่าย ตู้ ${selectedCabinet}`,
                  })}
                  className="flex items-center text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg border border-red-200"
                >
                  <Maximize2 className="w-3.5 h-3.5 mr-1" />
                  ดูรูปตู้จริง
                </button>
              )}
              {appUser?.role !== "viewer" && (
                <button
                  onClick={() => handleOpenPhotoModal(selectedCabinet)}
                  className="flex items-center text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg"
                >
                  <Camera className="w-3.5 h-3.5 mr-1 text-red-600" />
                  ถ่ายรูป/เปลี่ยนรูปตู้
                </button>
              )}
            </div>
          </div>

          {/* Shelves Grid (ชั้นที่จัดวาง - ไม่มีรูปภาพ) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {currentCabinetData && Array.from(currentCabinetData.shelvesMap.values()).map(shelf => {
              const cats = Array.from(shelf.categories).join(", ");

              return (
                <div
                  key={shelf.shelfId}
                  className="bg-white rounded-2xl border border-gray-200 shadow-xs hover:shadow-md hover:border-red-300 transition-all p-5 flex flex-col justify-between group"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 group-hover:bg-red-600 group-hover:text-white transition-colors shrink-0">
                          <Layers className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 
                            onClick={() => setHierarchy(selectedCabinet, shelf.shelfId)}
                            className="text-lg font-bold text-gray-900 group-hover:text-red-600 cursor-pointer transition-colors"
                          >
                            {shelf.displayName}
                          </h3>
                          <p className="text-xs text-gray-500">
                            ตู้ {selectedCabinet}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1 bg-red-50 text-red-700 rounded-lg border border-red-200">
                        {shelf.folders.length} แฟ้ม
                      </span>
                    </div>

                    {cats && (
                      <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-xs">
                        <span className="text-gray-400 font-medium">หมวดหมู่ในชั้น:</span>
                        <p className="text-gray-800 font-semibold mt-0.5 line-clamp-2">{cats}</p>
                      </div>
                    )}
                  </div>

                  {/* Shelf Actions Footer */}
                  <div className="pt-4 mt-2 border-t border-gray-100">
                    <button
                      onClick={() => setHierarchy(selectedCabinet, shelf.shelfId)}
                      className="w-full flex items-center justify-center bg-red-50 hover:bg-red-600 text-red-700 hover:text-white font-semibold py-2.5 px-4 rounded-xl transition-all text-xs border border-red-200 hover:border-red-600 shadow-2xs group-hover:bg-red-600 group-hover:text-white"
                    >
                      <span>เปิดดูแฟ้มในชั้นนี้ ({shelf.folders.length} แฟ้ม)</span>
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ========================================================
           LEVEL 3: รายการแฟ้มเอกสารบนชั้น (FOLDERS VIEW)
           ======================================================== */
        <div className="space-y-5">
          {/* Active Shelf Banner */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setHierarchy(selectedCabinet, null)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-600"
                title="กลับไปเลือกชั้นอื่นในตู้นี้"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-gray-900">
                    📁 ตู้ {selectedCabinet} / ชั้น {selectedShelf}
                  </h2>
                  <span className="text-xs font-semibold px-2.5 py-0.5 bg-red-100 text-red-800 rounded-md">
                    {currentShelfData ? currentShelfData.folders.length : 0} แฟ้มเอกสาร
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  ขั้นตอนที่ 3: แฟ้มเอกสารทั้งหมดที่จัดวางอยู่บนชั้นนี้ คลิกเพื่อเปิดดูรายละเอียดและเอกสารภายในแฟ้ม
                </p>
              </div>
            </div>
          </div>

          {/* Folders on this Shelf */}
          {currentShelfData && currentShelfData.folders.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
              <Folder className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-700">ยังไม่มีแฟ้มบนชั้นนี้</p>
              <Link
                href={`/archive/new?cabinet=${selectedCabinet}&shelf=${selectedShelf}`}
                className="inline-flex items-center text-xs font-semibold text-red-600 hover:underline mt-2"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                เพิ่มแฟ้มใหม่บนชั้นนี้
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentShelfData && currentShelfData.folders.map(loc => (
                <Link
                  key={loc.id}
                  href={`/archive/${loc.id}`}
                  className="border border-gray-200 rounded-xl p-5 hover:shadow-lg hover:border-red-300 hover:bg-red-50/20 transition-all cursor-pointer block group bg-white flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center min-w-0">
                        <Folder className="h-5 w-5 text-red-600 mr-2 shrink-0" />
                        <span className="font-mono font-bold text-xs text-red-900 group-hover:text-red-700 truncate">
                          {loc.location_code}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1 mb-3">
                      <h4 className="text-base font-bold text-gray-900 group-hover:text-red-700 transition-colors">
                        {loc.folder_name || loc.sequence || "แฟ้มเอกสาร"}
                      </h4>
                      <p className="text-xs text-gray-500">
                        เลขที่แฟ้ม: <strong className="text-gray-800">{loc.folder}</strong> • หมวด: {loc.category}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center text-xs font-semibold text-red-600 group-hover:text-red-700 pt-3 border-t border-gray-100 justify-between">
                    <span>เปิดดูเอกสารและรายละเอียดแฟ้ม</span>
                    <span className="text-base font-bold transition-transform group-hover:translate-x-1">→</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          MODAL 1: LIGHTBOX ดูรูปภาพขนาดเต็ม
          ======================================================== */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between w-full text-white mb-3 px-2">
              <div>
                <h3 className="text-base font-bold">{previewImage.title}</h3>
                {previewImage.subtitle && (
                  <p className="text-xs text-gray-300">{previewImage.subtitle}</p>
                )}
              </div>
              <button 
                onClick={() => setPreviewImage(null)}
                className="text-white hover:text-gray-300 bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors"
                title="ปิด"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-black/40 rounded-2xl overflow-hidden max-h-[80vh] flex items-center justify-center border border-white/20 shadow-2xl">
              <img 
                src={previewImage.url} 
                alt={previewImage.title}
                className="max-h-[78vh] max-w-full object-contain rounded-xl"
              />
            </div>

            <p className="text-xs text-gray-400 mt-2 text-center">
              กดที่พื้นที่ว่างหรือปุ่ม X เพื่อปิด
            </p>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 2: ถ่ายรูป / อัปโหลดรูปภาพตู้เอกสาร
          ======================================================== */}
      {photoModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b">
              <h3 className="text-base font-bold text-gray-900 flex items-center">
                <Camera className="w-5 h-5 mr-2 text-red-600" />
                {photoModal.title}
              </h3>
              <button 
                onClick={() => setPhotoModal(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                {modalError}
              </div>
            )}

            <div className="mt-4 space-y-4">
              {uploadPreview ? (
                <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50 h-52 flex items-center justify-center">
                  <img 
                    src={uploadPreview} 
                    alt="ตัวอย่างรูป" 
                    className="w-full h-full object-cover rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setUploadPreview("");
                      setUploadUrlInput("");
                      setUploadFile(null);
                    }}
                    className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-full shadow-md transition-colors"
                    title="ลบรูปตัวอย่าง"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-red-300 hover:border-red-500 bg-red-50/50 hover:bg-red-50/80 rounded-xl p-6 cursor-pointer transition-colors group">
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment"
                      onChange={handleFileChange}
                      className="hidden" 
                      disabled={isProcessing}
                    />
                    <Camera className="w-8 h-8 text-red-600 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-semibold text-red-800">
                      {isProcessing ? "กำลังประมวลผล..." : "ถ่ายรูปจากกล้อง หรือเลือกไฟล์รูป"}
                    </span>
                    <span className="text-xs text-gray-400 mt-1">
                      ระบบจะปรับขนาดและบีบอัดรูปภาพให้อัตโนมัติ
                    </span>
                  </label>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 shrink-0">หรือใส่ URL:</span>
                    <input 
                      type="url" 
                      value={uploadUrlInput} 
                      onChange={(e) => {
                        setUploadUrlInput(e.target.value);
                        setUploadPreview(e.target.value);
                      }} 
                      placeholder="https://..."
                      className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t">
                {photoModal.currentUrl ? (
                  <button
                    type="button"
                    onClick={handleDeletePhoto}
                    disabled={isProcessing}
                    className="text-xs text-red-600 hover:text-red-800 font-medium"
                  >
                    ลบรูปภาพนี้
                  </button>
                ) : <div></div>}

                <div className="flex items-center space-x-2">
                  <button 
                    type="button"
                    onClick={() => setPhotoModal(null)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    type="button"
                    onClick={handleSavePhotoModal}
                    disabled={isProcessing || !uploadPreview}
                    className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-md shadow-red-200 transition-colors disabled:opacity-50 flex items-center"
                  >
                    {isProcessing ? "กำลังบันทึก..." : "บันทึกรูปภาพ"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ========================================================
          MODAL 3: บันทึกเรื่องเก่า / เอกสารย้อนหลังเข้าแฟ้ม
          ======================================================== */}
      {isHistModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b">
              <h3 className="text-base font-bold text-gray-900 flex items-center">
                <History className="w-5 h-5 mr-2 text-red-600" />
                บันทึกเรื่องเก่า / เอกสารย้อนหลังเข้าแฟ้มจัดเก็บ
              </h3>
              <button 
                onClick={() => setIsHistModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {histError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                {histError}
              </div>
            )}

            <form onSubmit={handleSaveGlobalHist} className="mt-4 space-y-3.5">
              {/* แฟ้มจัดเก็บปลายทาง */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  เลือกแฟ้มจัดเก็บปลายทาง <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={histForm.targetLocationId}
                  onChange={(e) => setHistForm({ ...histForm, targetLocationId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
                >
                  <option value="">-- กรุณาเลือกแฟ้มจัดเก็บ --</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      [{loc.location_code}] {loc.folder_name || loc.sequence} (ตู้ {loc.cabinet} / ชั้น {loc.shelf})
                    </option>
                  ))}
                </select>
              </div>

              {/* เรื่อง / ชื่อเอกสาร */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  เรื่อง / ชื่อเอกสาร <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  required
                  value={histForm.subject}
                  onChange={(e) => setHistForm({ ...histForm, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="เช่น ขออนุมัติจัดซื้ออุปกรณ์สำนักงานประจำปี 2565"
                />
              </div>

              {/* ผู้ส่ง & ผู้รับ (Drop down list + อื่นๆ ระบุเอง) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    จาก (หน่วยงานผู้ส่ง / ต้นเรื่อง)
                  </label>
                  <select
                    value={histSenderOption}
                    onChange={(e) => setHistSenderOption(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
                  >
                    <option value="">-- เลือกหน่วยงานผู้ส่ง --</option>
                    {THAIPOST_ORGANIZATIONS.map((org) => (
                      <option key={org} value={org}>{org}</option>
                    ))}
                  </select>
                  {histSenderOption === "อื่นๆ (ระบุเอง)" && (
                    <input 
                      type="text" 
                      required
                      value={histCustomSender}
                      onChange={(e) => setHistCustomSender(e.target.value)}
                      className="mt-1.5 w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-red-50/20 animate-in fade-in"
                      placeholder="พิมพ์ระบุชื่อหน่วยงานผู้ส่ง..."
                      autoFocus
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    ถึง / เรียน (หน่วยงานผู้รับ)
                  </label>
                  <select
                    value={histRecipientOption}
                    onChange={(e) => setHistRecipientOption(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
                  >
                    <option value="">-- เลือกหน่วยงานผู้รับ --</option>
                    {THAIPOST_ORGANIZATIONS.map((org) => (
                      <option key={org} value={org}>{org}</option>
                    ))}
                  </select>
                  {histRecipientOption === "อื่นๆ (ระบุเอง)" && (
                    <input 
                      type="text" 
                      required
                      value={histCustomRecipient}
                      onChange={(e) => setHistCustomRecipient(e.target.value)}
                      className="mt-1.5 w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-red-50/20 animate-in fade-in"
                      placeholder="พิมพ์ระบุชื่อหน่วยงานผู้รับ..."
                      autoFocus
                    />
                  )}
                </div>
              </div>

              {/* เลขที่หนังสือ & ลงวันที่เอกสาร */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    เลขที่หนังสือ / เลขทะเบียนเดิม
                  </label>
                  <input 
                    type="text" 
                    value={histForm.document_number}
                    onChange={(e) => setHistForm({ ...histForm, document_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="เช่น ปณท(สท) 124/2565"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    ลงวันที่เอกสาร
                  </label>
                  <input 
                    type="date" 
                    value={histForm.document_date}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      const yr = newDate ? String(new Date(newDate).getFullYear() + 543) : histForm.historical_year;
                      setHistForm({ 
                        ...histForm, 
                        document_date: newDate,
                        historical_year: yr 
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
                  />
                </div>
              </div>

              {/* ลิงก์ Google Drive */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  ลิงก์ Google Drive (ไฟล์สแกน PDF)
                </label>
                <input 
                  type="url" 
                  value={histForm.google_drive_link}
                  onChange={(e) => setHistForm({ ...histForm, google_drive_link: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="https://drive.google.com/..."
                />
              </div>

              {/* ส่วนพับเก็บตัวเลือกเพิ่มเติม (ลดความเยอะ ไม่ต้องกรอกหลายช่องถ้าไม่จำเป็น) */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowMoreHistFields(!showMoreHistFields)}
                  className="flex items-center justify-between w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-gray-500" />
                    {showMoreHistFields ? "ซ่อนตัวเลือกเพิ่มเติม" : "+ ข้อมูลเพิ่มเติม (ประเภทเอกสาร, ปี พ.ศ., จำนวนแผ่น, หมายเหตุ)"}
                  </span>
                  {showMoreHistFields ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>

                {showMoreHistFields && (
                  <div className="mt-3 p-3 bg-gray-50/70 rounded-xl border border-gray-200 space-y-3 animate-in fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          ประเภทเอกสารย้อนหลัง
                        </label>
                        <select
                          value={histForm.historical_type}
                          onChange={(e) => setHistForm({ ...histForm, historical_type: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
                        >
                          <option value="หนังสือรับ (ย้อนหลัง)">หนังสือรับ (ย้อนหลัง)</option>
                          <option value="หนังสือส่ง (ย้อนหลัง)">หนังสือส่ง (ย้อนหลัง)</option>
                          <option value="คำสั่ง / ประกาศ">คำสั่ง / ประกาศ</option>
                          <option value="รายงาน / สรุปผลการปฏิบัติงาน">รายงาน / สรุปผลการปฏิบัติงาน</option>
                          <option value="สัญญา / เอกสารทางกฎหมาย">สัญญา / เอกสารทางกฎหมาย</option>
                          <option value="บันทึกข้อความภายใน">บันทึกข้อความภายใน</option>
                          <option value="เอกสารทั่วไป / อื่นๆ">เอกสารทั่วไป / อื่นๆ</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          ปี พ.ศ. ของเอกสาร
                        </label>
                        <input 
                          type="text" 
                          value={histForm.historical_year}
                          onChange={(e) => setHistForm({ ...histForm, historical_year: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
                          placeholder="เช่น 2564, 2565, 2566"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        จำนวนแผ่น
                      </label>
                      <input 
                        type="text" 
                        value={histForm.page_count}
                        onChange={(e) => setHistForm({ ...histForm, page_count: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
                        placeholder="เช่น 1 หรือ 3 แผ่น"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        หมายเหตุ / รายละเอียดการจัดเก็บเพิ่มเติม
                      </label>
                      <textarea 
                        rows={2}
                        value={histForm.notes}
                        onChange={(e) => setHistForm({ ...histForm, notes: e.target.value })}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
                        placeholder="เช่น เอกสารต้นฉบับเย็บเล่มรวมกับสัญญาปี 2565"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t">
                <button 
                  type="button"
                  onClick={() => setIsHistModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit"
                  disabled={histSubmitting}
                  className="flex items-center px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold shadow-md shadow-red-200 transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {histSubmitting ? "กำลังบันทึก..." : "บันทึกเข้าแฟ้ม"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ArchivePage() {
  return (
    <Suspense fallback={
      <div className="p-16 text-center text-gray-500">
        <div className="h-8 w-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        กำลังโหลดคลังเอกสาร...
      </div>
    }>
      <ArchiveContent />
    </Suspense>
  );
}
