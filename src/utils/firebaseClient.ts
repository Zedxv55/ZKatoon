import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
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

export async function signUpWithEmailPassword(
  email: string,
  password: string,
  displayName?: string
): Promise<AuthUserProfile> {
  if (!isFirebaseConfigured()) throw new Error('ยังไม่ได้ตั้งค่า Firebase');
  const { auth } = getFirebaseServices();
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (displayName?.trim()) {
    await updateProfile(cred.user, { displayName: displayName.trim() }).catch(() => {});
  }
  await sendEmailVerification(cred.user).catch(() => {});
  return userToProfile(cred.user)!;
}

export async function signInWithEmailPassword(
  email: string,
  password: string
): Promise<AuthUserProfile> {
  if (!isFirebaseConfigured()) throw new Error('ยังไม่ได้ตั้งค่า Firebase');
  const { auth } = getFirebaseServices();
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return userToProfile(cred.user)!;
}

export async function resendVerificationEmail(): Promise<void> {
  if (!isFirebaseConfigured()) throw new Error('ยังไม่ได้ตั้งค่า Firebase');
  const { auth } = getFirebaseServices();
  if (!auth.currentUser) throw new Error('กรุณาเข้าสู่ระบบก่อน');
  await sendEmailVerification(auth.currentUser);
}

export async function sendResetPasswordEmail(email: string): Promise<void> {
  if (!isFirebaseConfigured()) throw new Error('ยังไม่ได้ตั้งค่า Firebase');
  const { auth } = getFirebaseServices();
  await sendPasswordResetEmail(auth, email.trim());
}

export async function refreshCurrentFirebaseUser(): Promise<{ emailVerified: boolean; email: string | null }> {
  if (!isFirebaseConfigured()) return { emailVerified: false, email: null };
  const { auth } = getFirebaseServices();
  if (!auth.currentUser) return { emailVerified: false, email: null };
  await reload(auth.currentUser);
  return {
    emailVerified: auth.currentUser.emailVerified,
    email: auth.currentUser.email,
  };
}

export async function getFirebaseIdToken(forceRefresh = false): Promise<string | null> {
  if (!isFirebaseConfigured()) return null;
  const { auth } = getFirebaseServices();
  if (!auth.currentUser) return null;
  return await auth.currentUser.getIdToken(forceRefresh);
}

export function getCurrentFirebaseUid(): string | null {
  if (!isFirebaseConfigured()) return null;
  const { auth } = getFirebaseServices();
  return auth.currentUser?.uid || null;
}

export function getCurrentFirebaseAuthInfo(): {
  uid: string | null;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
} {
  if (!isFirebaseConfigured()) {
    return { uid: null, email: null, emailVerified: false, displayName: null };
  }
  const { auth } = getFirebaseServices();
  const u = auth.currentUser;
  return {
    uid: u?.uid || null,
    email: u?.email || null,
    emailVerified: Boolean(u?.emailVerified),
    displayName: u?.displayName || null,
  };
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
