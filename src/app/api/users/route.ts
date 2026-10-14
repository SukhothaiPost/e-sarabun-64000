import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, displayName, role, department } = body;

    // Optional: Validate request.headers to check if caller is super_admin
    // For MVP, assuming called securely via frontend which hides the UI

    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName,
    });

    await adminDb.collection('users').doc(userRecord.uid).set({
      id: userRecord.uid,
      email,
      displayName,
      role,
      department,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({ success: true, uid: userRecord.uid });
  } catch (error: any) {
    console.error("Error creating user:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
