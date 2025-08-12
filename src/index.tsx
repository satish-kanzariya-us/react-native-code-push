// src/index.tsx
import CodePush from './codepush';

export default CodePush;

// Also export named exports for convenience
export const {
  checkForUpdate,
  getCurrentPackage,
  getConfiguration,
  sync,
  restartApp,
  notifyApplicationReady,
  allowRestart,
  disallowRestart,
  InstallMode,
  SyncStatus,
  CheckFrequency,
  UpdateState,
} = CodePush;

export * from './types';
