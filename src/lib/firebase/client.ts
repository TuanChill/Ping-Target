'use client';

import { firebaseWebConfig, hasFirebaseWebConfig } from '@/config/env';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';

let firebaseClient: { app: FirebaseApp; auth: Auth; db: Firestore } | null = null;

export function getFirebaseClient(): { app: FirebaseApp; auth: Auth; db: Firestore } | null {
  if (!hasFirebaseWebConfig) return null;
  if (firebaseClient) return firebaseClient;

  const app = getApps().length ? getApp() : initializeApp(firebaseWebConfig);
  firebaseClient = { app, auth: getAuth(app), db: getFirestore(app) };

  return firebaseClient;
}
