"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { User as AppUser } from '@/types';

interface AuthContextType {
  user: FirebaseUser | null;
  appUser: AppUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  appUser: null,
  loading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for hardcoded bypass
    if (typeof window !== 'undefined' && localStorage.getItem("hardcoded_user") === "true") {
      setUser({ uid: "DUMMY_UID", email: "64000@post.com" } as FirebaseUser);
      setAppUser({
        id: "DUMMY_UID",
        email: "64000@post.com",
        displayName: "ผู้ดูแลระบบ (Demo)",
        role: "super_admin",
        department: "บริหาร",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      } as AppUser);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          
          if (userDocSnap.exists()) {
            setAppUser(userDocSnap.data() as AppUser);
          } else {
            const isSuperAdminEmail = 
              firebaseUser.email === "64000@post.com" || 
              firebaseUser.email === "game@64000.com";
            
            const defaultUser: AppUser = {
              id: firebaseUser.uid,
              email: firebaseUser.email || "",
              displayName: isSuperAdminEmail ? "ผู้ดูแลระบบ" : (firebaseUser.displayName || "เจ้าหน้าที่"),
              role: isSuperAdminEmail ? "super_admin" : "officer",
              department: "บริหาร",
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            setAppUser(defaultUser);
          }
        } catch (err) {
          console.warn("Could not load user document from firestore:", err);
          const isSuperAdminEmail = 
            firebaseUser.email === "64000@post.com" || 
            firebaseUser.email === "game@64000.com";
          
          setAppUser({
            id: firebaseUser.uid,
            email: firebaseUser.email || "",
            displayName: isSuperAdminEmail ? "ผู้ดูแลระบบ" : "เจ้าหน้าที่",
            role: isSuperAdminEmail ? "super_admin" : "officer",
            department: "บริหาร",
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      } else {
        setAppUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, appUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
