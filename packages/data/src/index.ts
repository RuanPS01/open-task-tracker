export { AppError } from './errors';
export { createBackend, type Backend, type FallbackReason } from './backend';
export {
  connect,
  createLocalBackend,
  isFirebaseConfigured,
  LOCAL_STORAGE_KEY,
  type ConnectOptions,
  type PreferredMode,
} from './connect';
export { DEMO_EMAIL, DEMO_PASSWORD } from './services/demo';
export type { DataMode } from './store/types';
