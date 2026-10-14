"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/lib/contexts/AuthContext";
import { User } from "@/types";
import { Users, UserPlus, ShieldAlert, Check, X } from "lucide-react";

export default function UsersManagementPage() {
  const { appUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    displayName: "",
    role: "officer",
    department: "",
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "users"));
      const snapshot = await getDocs(q);
      const usersList = snapshot.docs.map(doc => doc.data() as User);
      setUsers(usersList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (appUser?.role === 'super_admin') {
      fetchUsers();
    } else {
      setLoading(false);
    }
  }, [appUser]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        setShowAddForm(false);
        setFormData({ email: "", password: "", displayName: "", role: "officer", department: "" });
        fetchUsers();
      } else {
        alert("Error: " + data.error);
      }
    } catch (err) {
      alert("Failed to create user.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, "users", userId), {
        isActive: !currentStatus
      });
      fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  if (appUser?.role !== 'super_admin') {
    return (
      <div className="p-12 text-center">
        <ShieldAlert className="h-16 w-16 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900">ไม่มีสิทธิ์เข้าถึง</h2>
        <p className="text-gray-500 mt-2">เฉพาะผู้ดูแลระบบสูงสุด (Super Admin) เท่านั้น</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">จัดการผู้ใช้งานระบบ</h1>
          <p className="text-sm text-gray-500">เพิ่ม กำหนดสิทธิ์ และระงับบัญชีผู้ใช้</p>
        </div>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-xl shadow-md shadow-red-200 transition-colors text-sm"
        >
          {showAddForm ? <X className="w-5 h-5 mr-2" /> : <UserPlus className="w-5 h-5 mr-2" />}
          {showAddForm ? "ปิดหน้าต่าง" : "เพิ่มผู้ใช้งานใหม่"}
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">ข้อมูลผู้ใช้งานใหม่</h2>
          <form onSubmit={handleAddUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ-นามสกุล <span className="text-red-500">*</span></label>
                <input required type="text" value={formData.displayName} onChange={e => setFormData({...formData, displayName: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">แผนก/ส่วนงาน <span className="text-red-500">*</span></label>
                <input required type="text" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">อีเมล <span className="text-red-500">*</span></label>
                <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่านชั่วคราว <span className="text-red-500">*</span></label>
                <input required type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm" minLength={6} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">สิทธิ์การใช้งาน (Role)</label>
                <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm">
                  <option value="super_admin">Super Admin (ควบคุมสูงสุด)</option>
                  <option value="admin">Admin (ผู้ดูแลสารบรรณ)</option>
                  <option value="officer">Officer (เจ้าหน้าที่ปฏิบัติงาน)</option>
                  <option value="viewer">Viewer (อ่านอย่างเดียว)</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <button type="submit" disabled={isSubmitting} className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-6 rounded-lg shadow-md shadow-red-200 transition-colors disabled:opacity-50 text-sm">
                {isSubmitting ? "กำลังบันทึก..." : "สร้างบัญชี"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ชื่อ-นามสกุล</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">อีเมล</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ส่วนงาน</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">สิทธิ์</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">สถานะ</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">จัดการ</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">กำลังโหลดข้อมูล...</td></tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.displayName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.department || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className="px-2 py-1 rounded bg-gray-100 text-xs font-medium">{user.role}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {user.isActive ? (
                        <span className="flex items-center text-green-600"><Check className="w-4 h-4 mr-1"/> ปกติ</span>
                      ) : (
                        <span className="flex items-center text-red-600"><X className="w-4 h-4 mr-1"/> ระงับใช้งาน</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={() => toggleUserStatus(user.id, user.isActive)}
                        className={`text-${user.isActive ? 'red' : 'green'}-600 hover:text-${user.isActive ? 'red' : 'green'}-900`}
                        disabled={user.id === appUser?.id}
                      >
                        {user.isActive ? "ระงับบัญชี" : "เปิดใช้งาน"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
