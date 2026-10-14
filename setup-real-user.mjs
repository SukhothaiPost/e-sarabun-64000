import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDZwqXgKt2jbjSQN-oSDLz4iwvXM-LfsuU",
  authDomain: "e-saraban-7231f.firebaseapp.com",
  projectId: "e-saraban-7231f",
  storageBucket: "e-saraban-7231f.firebasestorage.app",
  messagingSenderId: "780746153339",
  appId: "1:780746153339:web:0d1f5b3ebe742e35f1f1de"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function setupRealUser() {
  try {
    // 1. Sign in with 12345678
    const cred = await signInWithEmailAndPassword(auth, "64000@post.com", "12345678");
    console.log("Logged in with UID:", cred.user.uid);

    // 2. Change password to Post64000 as requested by user!
    console.log("Updating password to Post64000...");
    await updatePassword(cred.user, "Post64000");
    console.log("Password updated successfully to Post64000!");

    // 3. Create or update user profile document in Firestore
    console.log("Creating super_admin user profile in Firestore...");
    await setDoc(doc(db, "users", cred.user.uid), {
      id: cred.user.uid,
      email: "64000@post.com",
      displayName: "ผู้ดูแลระบบ",
      role: "super_admin",
      department: "บริหาร",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }, { merge: true });

    console.log("SUPER ADMIN PROFILE CREATED SUCCESSFULLY IN FIRESTORE!");
    process.exit(0);
  } catch (err) {
    console.error("Setup error:", err);
    process.exit(1);
  }
}

setupRealUser();
