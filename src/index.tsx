// src/index.tsx
import CodePush from './codepush';

//TODO: Remove this method
// export function multiply(a: number, b: number): number {
//   return CodePush.multiply(a, b);
// }
// Export the main CodePush object as default
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
