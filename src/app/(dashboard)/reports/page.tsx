"use client";

import { useState } from "react";
import { collection, query, getDocs, where } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/lib/contexts/AuthContext";
import { SarabanDocument } from "@/types";
import { formatToBuddhistEra } from "@/lib/dateUtils";
import { FileSpreadsheet, Download, Filter } from "lucide-react";

export default function ReportsPage() {
  const { appUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<SarabanDocument[]>([]);
  
  const [filters, setFilters] = useState({
    year: new Date().getFullYear() + 543 + "",
    month: "",
    document_type: "",
  });

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const q = query(collection(db, "documents"), where("deleted", "==", false));
      const snapshot = await getDocs(q);
      
      let docs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          document_date: data.document_date?.toDate(),
          received_date: data.received_date?.toDate(),
          sent_date: data.sent_date?.toDate(),
          createdAt: data.createdAt?.toDate(),
        } as SarabanDocument;
      });

      // Filter by type
      if (filters.document_type) {
        docs = docs.filter(d => d.document_type === filters.document_type);
      }
      
      // Filter by year
      if (filters.year) {
        const beYear = parseInt(filters.year);
        docs = docs.filter(d => {
          const docDate = d.document_date || d.sent_date || d.received_date || d.createdAt;
          const docYear = docDate ? (docDate.getFullYear() + 543) : null;
          return docYear === beYear || (d.running_number && d.running_number.endsWith(`/${filters.year}`));
        });
      }

      // Filter by month (createdAt)
      if (filters.month) {
        docs = docs.filter(d => {
          if (!d.createdAt) return false;
          return d.createdAt.getMonth() === parseInt(filters.month);
        });
      }

      setReportData(docs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (reportData.length === 0) return;

    // Headers
    const headers = ['เลขที่ (ระบบ)', 'ประเภท', 'วันที่ลงในหนังสือ', 'เรื่อง', 'จาก/เรียน', 'ความเร่งด่วน', 'สถานะ'];
    
    // Rows
    const rows = reportData.map(doc => [
      doc.running_number,
      doc.document_type === 'incoming' ? 'หนังสือรับ' : 'หนังสือส่ง',
      doc.document_date ? doc.document_date.toLocaleDateString('th-TH') : '',
      `"${doc.subject.replace(/"/g, '""')}"`, // escape quotes for CSV
      doc.document_type === 'incoming' ? `"${doc.sender}"` : `"${doc.recipient}"`,
      doc.urgency,
      doc.status
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    // Create Blob and download
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); // \uFEFF for Excel UTF-8 BOM
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `saraban_report_${filters.year}${filters.month ? '_'+filters.month : ''}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (appUser?.role !== 'super_admin' && appUser?.role !== 'admin') {
    return <div className="p-12 text-center">ไม่มีสิทธิ์เข้าถึงหน้านี้</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ออกรายงานระบบสารบรรณ</h1>
        <p className="text-sm text-gray-500">สรุปข้อมูลและส่งออกเป็นไฟล์ CSV</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleGenerateReport} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ปี พ.ศ.</label>
            <select value={filters.year} onChange={e => setFilters({...filters, year: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
              <option value="2569">2569</option>
              <option value="2568">2568</option>
              <option value="2567">2567</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">เดือน (ถ้าต้องการระบุ)</label>
            <select value={filters.month} onChange={e => setFilters({...filters, month: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
              <option value="">ทั้งหมดทั้งปี</option>
              <option value="0">มกราคม</option>
              <option value="1">กุมภาพันธ์</option>
              <option value="2">มีนาคม</option>
              <option value="3">เมษายน</option>
              <option value="4">พฤษภาคม</option>
              <option value="5">มิถุนายน</option>
              <option value="6">กรกฎาคม</option>
              <option value="7">สิงหาคม</option>
              <option value="8">กันยายน</option>
              <option value="9">ตุลาคม</option>
              <option value="10">พฤศจิกายน</option>
              <option value="11">ธันวาคม</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ประเภท</label>
            <select value={filters.document_type} onChange={e => setFilters({...filters, document_type: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
              <option value="">รวมทุกประเภท</option>
              <option value="incoming">เฉพาะหนังสือรับ</option>
              <option value="outgoing">เฉพาะหนังสือส่ง</option>
            </select>
          </div>
          <button type="submit" disabled={loading} className="w-full bg-gray-800 hover:bg-gray-900 text-white font-medium py-2 px-4 rounded-md flex items-center justify-center">
            {loading ? "กำลังประมวลผล..." : <><Filter className="w-4 h-4 mr-2"/> ดึงข้อมูลรายงาน</>}
          </button>
        </form>
      </div>

      {reportData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h3 className="font-medium text-gray-700">พบข้อมูลจำนวน {reportData.length} รายการ</h3>
            <button onClick={exportToCSV} className="flex items-center text-green-700 bg-green-100 hover:bg-green-200 px-3 py-1.5 rounded-md text-sm font-medium transition-colors">
              <FileSpreadsheet className="w-4 h-4 mr-1.5" />
              ส่งออกเป็น CSV (Excel)
            </button>
          </div>
          <div className="p-0 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-white">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">เลขที่ (ระบบ)</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ประเภท</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">เรื่อง</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {reportData.slice(0, 10).map(doc => (
                  <tr key={doc.id}>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{doc.running_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{doc.document_type === 'incoming' ? 'หนังสือรับ' : 'หนังสือส่ง'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 truncate max-w-xs">{doc.subject}</td>
                  </tr>
                ))}
                {reportData.length > 10 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-sm text-center text-gray-500">และอีก {reportData.length - 10} รายการ... (กรุณาส่งออก CSV เพื่อดูทั้งหมด)</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
