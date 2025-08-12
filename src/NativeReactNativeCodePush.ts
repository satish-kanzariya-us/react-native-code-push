import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  getValue(key: string): Promise<string>;

  getConfiguration(): Promise<{
    appVersion: string;
    clientUniqueId: string;
    deploymentKey: string;
    serverUrl: string;
    packageHash?: string;
  }>;

  getCurrentPackage(): Promise<{
    appVersion: string;
    description: string;
    failedInstall: boolean;
    failedUpdate: boolean;
    isFirstRun: boolean;
    isPending: boolean;
    label: string;
    packageHash: string;
    packageSize: number;
  } | null>;

  downloadUpdate(
    updatePackage: {
      downloadUrl: string;
      packageHash: string;
      label: string;
      packageSize: number;
    },
    notifyProgress: boolean
  ): Promise<{
    appVersion: string;
    description: string;
    failedInstall: boolean;
    failedUpdate: boolean;
    isFirstRun: boolean;
    isPending: boolean;
    label: string;
    packageHash: string;
    packageSize: number;
  }>;

  installUpdate(
    updatePackage: {
      packageHash: string;
      label: string;
    },
    installMode: number,
    minimumBackgroundDuration: number
  ): Promise<void>;

  notifyApplicationReady(): Promise<void>;
  restartApp(onlyIfUpdateIsPending?: boolean): Promise<void>;
  clearPendingRestart(): Promise<void>;

  isFailedUpdate(packageHash: string): Promise<boolean>;
  getLatestRollbackInfo(): Promise<{
    packageHash: string;
    time: number;
    count: number;
  } | null>;
  setLatestRollbackInfo(packageHash: string): Promise<void>;
  isFirstRun(packageHash: string): Promise<boolean>;

  allowRestart(): Promise<void>;
  disallowRestart(): Promise<void>;
  getUpdateMetadata(updateState: number): Promise<{
    appVersion: string;
    description: string;
    label: string;
    packageHash: string;
    packageSize: number;
  } | null>;

  // ✅ ADD: Missing methods that were causing the compile errors
  getNewStatusReport(): Promise<
    | {
      appVersion?: string;
      status?: string;
      package?: {
        appVersion: string;
        deploymentKey: string;
        description: string;
        label: string;
        packageHash: string;
        packageSize: number;
      };
      previousLabelOrAppVersion?: string;
      previousDeploymentKey?: string;
    }
    | string
  >;

  recordStatusReported(statusReport: {
    appVersion?: string;
    status?: string;
    package?: {
      appVersion: string;
      deploymentKey: string;
      description: string;
      label: string;
      packageHash: string;
      packageSize: number;
    };
    previousLabelOrAppVersion?: string;
    previousDeploymentKey?: string;
  }): void;

  saveStatusReportForRetry(statusReport: {
    appVersion?: string;
    status?: string;
    package?: {
      appVersion: string;
      deploymentKey: string;
      description: string;
      label: string;
      packageHash: string;
      packageSize: number;
    };
    previousLabelOrAppVersion?: string;
    previousDeploymentKey?: string;
  }): void;

  clearUpdates(): Promise<void>;

  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('ReactNativeCodePush');
