import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import type { AuthUserProfile } from '../types/cartoon';

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig?.apiKey && firebaseConfig?.projectId && firebaseConfig.projectId !== 'remixed-project-id');
}

export function getFirebaseServices(): {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
} {
  if (!appInstance) {
    appInstance = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    authInstance = getAuth(appInstance);
    dbInstance = getFirestore(appInstance, firebaseConfig.firestoreDatabaseId);
    storageInstance = getStorage(appInstance);
  }
  return {
    app: appInstance,
    auth: authInstance!,
    db: dbInstance!,
    storage: storageInstance!,
  };
}

export function userToProfile(user: User | null): AuthUserProfile | null {
  if (!user) return null;
  return {
    uid: user.uid,
    displayName: user.displayName || `ผู้ใช้ ${user.uid.slice(0, 6)}`,
    photoURL: user.photoURL || null,
  };
}

export function subscribeFirebaseAuth(
  cb: (profile: AuthUserProfile | null) => void,
  onError?: (err: unknown) => void
): () => void {
  if (!isFirebaseConfigured()) {
    cb(null);
    return () => {};
  }
  const { auth } = getFirebaseServices();
  return onAuthStateChanged(
    auth,
    (user) => cb(userToProfile(user)),
    (err) => {
      if (onError) onError(err);
    }
  );
}

export async function signInWithGooglePopup(forceSelectAccount = false): Promise<AuthUserProfile> {
  if (!isFirebaseConfigured()) {
    throw new Error('ยังไม่ได้ตั้งค่า Firebase สำหรับโปรเจกต์นี้');
  }
  const { auth } = getFirebaseServices();
  const provider = new GoogleAuthProvider();
  if (forceSelectAccount) {
    provider.setCustomParameters({ prompt: 'select_account' });
  }
  const cred = await signInWithPopup(auth, provider);
  const profile = userToProfile(cred.user);
  if (!profile) {
    throw new Error('ไม่สามารถอ่านข้อมูลผู้ใช้จาก Firebase Auth ได้');
  }
  return profile;
}

export async function signOutFirebase(): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const { auth } = getFirebaseServices();
  await signOut(auth);
}

export function getCurrentFirebaseUid(): string | null {
  if (!isFirebaseConfigured()) return null;
  const { auth } = getFirebaseServices();
  return auth.currentUser?.uid || null;
}

export async function testFirestoreServerConnection(): Promise<'online' | 'offline' | 'unconfigured'> {
  if (!isFirebaseConfigured()) return 'unconfigured';
  const { db } = getFirebaseServices();
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return 'online';
  } catch (err) {
    if (err instanceof Error && err.message.includes('the client is offline')) {
      return 'offline';
    }
    // Permission denied / not found still means Firestore server is reachable
    return 'online';
  }
}
