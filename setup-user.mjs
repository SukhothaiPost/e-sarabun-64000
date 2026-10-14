import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDZwXgKt2jbjSQN-oSDLz4iwvXM-LfsuU",
  authDomain: "e-saraban-7231f.firebaseapp.com",
  projectId: "e-saraban-7231f",
  storageBucket: "e-saraban-7231f.firebasestorage.app",
  messagingSenderId: "780746153339",
  appId: "1:780746153339:web:0d1f5b3ebe742e35f1f1de"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function setup() {
  try {
    console.log("Creating user 64000@post.com...");
    const userCredential = await createUserWithEmailAndPassword(auth, "64000@post.com", "Post64000");
    const user = userCredential.user;
    console.log("User created with UID:", user.uid);

    console.log("Creating Firestore document...");
    await setDoc(doc(db, "users", user.uid), {
      id: user.uid,
      email: "64000@post.com",
      displayName: "ผู้ดูแลระบบ",
      role: "super_admin",
      isActive: true,
      department: "ผู้บริหาร",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log("Firestore document created successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

setup();
