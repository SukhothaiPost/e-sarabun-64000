import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

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

async function testSignIn() {
  try {
    console.log("Signing in as 64000@post.com...");
    const cred = await signInWithEmailAndPassword(auth, "64000@post.com", "Post64000");
    console.log("SUCCESS! Logged in with UID:", cred.user.uid);

    console.log("Setting up Firestore super_admin document...");
    await setDoc(doc(db, "users", cred.user.uid), {
      id: cred.user.uid,
      email: "64000@post.com",
      displayName: "ผู้ดูแลระบบ",
      role: "super_admin",
      department: "บริหาร",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log("Firestore super_admin document saved successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Sign in / Firestore error:", err);
    process.exit(1);
  }
}

testSignIn();
