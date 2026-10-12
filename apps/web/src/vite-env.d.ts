/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  /** auto (padrão), firebase ou local. */
  readonly VITE_DATA_MODE?: string;
  /** Host dos emuladores do Firebase (Auth na porta 9099, Firestore na 8080). */
  readonly VITE_FIREBASE_EMULATOR_HOST?: string;
}
