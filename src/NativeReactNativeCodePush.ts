// import type { TurboModule } from 'react-native';
// import { TurboModuleRegistry } from 'react-native';


// export interface Spec extends TurboModule {
//   multiply(a: number, b: number): number;
//   helloWorld(): Promise<string>;
//   getValue(key: string): Promise<string>;
//   getConfiguration(): Promise<{
//     appVersion: string;
//     clientUniqueId: string;
//     deploymentKey: string;
//     serverUrl: string;
//     packageHash?: string;
//   }>;
//   checkForUpdate(deploymentKey?: string): Promise<{
//     updateAvailable: boolean;
//     appVersion: string;
//     description?: string;
//     label?: string;
//     packageHash?: string;
//     downloadUrl?: string;
//     isMandatory?: boolean;
//   } | null>;
//   getCurrentPackage(): Promise<{
//     appVersion: string;
//     description: string;
//     failedInstall: boolean;
//     failedUpdate: boolean;
//     isFirstRun: boolean;
//     isPending: boolean;
//     label: string;
//     packageHash: string;
//     packageSize: number;
//   } | null>;

//   // Add more methods as needed
// }

// export default TurboModuleRegistry.getEnforcing<Spec>('ReactNativeCodePush');

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  multiply(a: number, b: number): number;
  helloWorld(): Promise<string>;
  getValue(key: string): Promise<string>;

  getConfiguration(): Promise<{
    appVersion: string;
    clientUniqueId: string;
    deploymentKey: string;
    serverUrl: string;
    packageHash?: string;
  }>;

  // checkForUpdate(deploymentKey?: string): Promise<{
  //   updateAvailable: boolean;
  //   appVersion: string;
  //   description?: string;
  //   label?: string;
  //   packageHash?: string;
  //   downloadUrl?: string;
  //   isMandatory?: boolean;
  // } | null>;

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

  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('ReactNativeCodePush');
