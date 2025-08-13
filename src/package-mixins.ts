// // src/package-mixins.ts
// import { NativeEventEmitter, type EmitterSubscription } from 'react-native';
// import NativeCodePush from './NativeReactNativeCodePush';
// import log from './logging';
// import {
//   type LocalPackage,
//   type RemotePackage,
//   type DownloadProgress,
//   InstallMode,
// } from './types';

// interface RemotePackageMixin {
//   download(
//     downloadProgressCallback?: (progress: DownloadProgress) => void
//   ): Promise<LocalPackage>;
//   isPending: boolean;
// }

// interface LocalPackageMixin {
//   install(
//     installMode?: InstallMode,
//     minimumBackgroundDuration?: number,
//     updateInstalledCallback?: () => void
//   ): Promise<void>;
//   isPending: boolean;
// }

// interface PackageMixinsType {
//   remote: (
//     reportStatusDownload?: (pkg: RemotePackage) => Promise<void>
//   ) => RemotePackageMixin;
//   local: LocalPackageMixin;
// }

// // This function is used to augment remote and local package objects
// // following the exact pattern from CodePushNext
// const createPackageMixins = (NativeCodePushModule: any): PackageMixinsType => {
//   const remote = (
//     reportStatusDownload?: (pkg: RemotePackage) => Promise<void>
//   ): RemotePackageMixin => {
//     return {
//       async download(
//         this: RemotePackage,
//         downloadProgressCallback?: (progress: DownloadProgress) => void
//       ): Promise<LocalPackage> {
//         if (!this.downloadUrl) {
//           throw new Error('Cannot download an update without a download url');
//         }

//         let downloadProgressSubscription: EmitterSubscription | undefined;
//         if (downloadProgressCallback) {
//           const codePushEventEmitter = new NativeEventEmitter(
//             NativeCodePushModule
//           );
//           // Use event subscription to obtain download progress.
//           downloadProgressSubscription = codePushEventEmitter.addListener(
//             'CodePushDownloadProgress',
//             downloadProgressCallback
//           );
//         }

//         // Use the downloaded package info. Native code will save the package info
//         // so that the client knows what the current package version is.
//         try {
//           const updatePackageCopy: Partial<RemotePackage> = Object.assign(
//             {},
//             this
//           );
//           Object.keys(updatePackageCopy).forEach(
//             (key) =>
//               typeof (updatePackageCopy as any)[key] === 'function' &&
//               delete (updatePackageCopy as any)[key]
//           );

//           const downloadedPackage = await NativeCodePushModule.downloadUpdate(
//             updatePackageCopy as any,
//             !!downloadProgressCallback
//           );

//           if (reportStatusDownload) {
//             reportStatusDownload(this).catch((err: any) => {
//               log(`Report download status failed: ${err}`);
//             });
//           }

//           return { ...downloadedPackage, ...local } as LocalPackage;
//         } finally {
//           downloadProgressSubscription && downloadProgressSubscription.remove();
//         }
//       },

//       isPending: false, // A remote package could never be in a pending state
//     };
//   };

//   const local: LocalPackageMixin = {
//     async install(
//       this: LocalPackage,
//       installMode: InstallMode = InstallMode.ON_NEXT_RESTART,
//       minimumBackgroundDuration: number = 0,
//       updateInstalledCallback?: () => void
//     ): Promise<void> {
//       const localPackage = this;
//       const localPackageCopy: Partial<LocalPackage> = Object.assign(
//         {},
//         localPackage
//       );

//       await NativeCodePushModule.installUpdate(
//         localPackageCopy as any,
//         installMode,
//         minimumBackgroundDuration
//       );

//       updateInstalledCallback && updateInstalledCallback();

//       if (installMode === InstallMode.IMMEDIATE) {
//         await NativeCodePushModule.restartApp(false);
//       } else {
//         await NativeCodePushModule.clearPendingRestart();
//         localPackage.isPending = true; // Mark the package as pending since it hasn't been applied yet
//       }
//     },

//     isPending: false, // A local package wouldn't be pending until it was installed
//   };

//   return { local, remote };
// };

// // Export following the CodePushNext pattern
// const PackageMixins = createPackageMixins(NativeCodePush);
// export default PackageMixins;

// src/package-mixins.ts (Enhanced)

import { NativeEventEmitter, type EmitterSubscription } from 'react-native';
import NativeCodePush from './NativeReactNativeCodePush';
import log from './logging';

import {
  type LocalPackage,
  type RemotePackage,
  type DownloadProgress,
  InstallMode,
} from './types';

interface RemotePackageMixin {
  download(
    downloadProgressCallback?: (progress: DownloadProgress) => void
  ): Promise<LocalPackage>;
  isPending: boolean;
}

interface LocalPackageMixin {
  install(
    installMode?: InstallMode,
    minimumBackgroundDuration?: number,
    updateInstalledCallback?: () => void
  ): Promise<void>;
  isPending: boolean;
}

interface PackageMixinsType {
  remote: (
    reportStatusDownload?: (pkg: RemotePackage) => Promise<void>
  ) => RemotePackageMixin;
  local: LocalPackageMixin;
}

const createPackageMixins = (NativeCodePushModule: any): PackageMixinsType => {
  const remote = (
    reportStatusDownload?: (pkg: RemotePackage) => Promise<void>
  ): RemotePackageMixin => {
    return {
      async download(
        this: RemotePackage,
        downloadProgressCallback?: (progress: DownloadProgress) => void
      ): Promise<LocalPackage> {
        if (!this.downloadUrl) {
          throw new Error('Cannot download an update without a download url');
        }

        let downloadProgressSubscription: EmitterSubscription | undefined;

        if (downloadProgressCallback) {
          const codePushEventEmitter = new NativeEventEmitter(
            NativeCodePushModule
          );

          // ✅ FIX: Use event subscription to obtain download progress
          downloadProgressSubscription = codePushEventEmitter.addListener(
            'CodePushDownloadProgress',
            (progress: DownloadProgress) => {
              log(
                `Download progress: ${progress.receivedBytes}/${progress.totalBytes} bytes`
              );
              downloadProgressCallback(progress);
            }
          );
        }

        try {
          // Create clean copy without functions for native module
          const updatePackageCopy: Partial<RemotePackage> = Object.assign(
            {},
            this
          );
          Object.keys(updatePackageCopy).forEach(
            (key) =>
              typeof (updatePackageCopy as any)[key] === 'function' &&
              delete (updatePackageCopy as any)[key]
          );

          log(`Starting download for package: ${this.packageHash}`);

          const downloadedPackage = await NativeCodePushModule.downloadUpdate(
            updatePackageCopy as any,
            !!downloadProgressCallback
          );

          log(`Download completed for package: ${this.packageHash}`);

          // Report download status if callback provided
          if (reportStatusDownload) {
            try {
              await reportStatusDownload(this);
              log('Download status reported successfully');
            } catch (err: any) {
              log(`Report download status failed: ${err}`);
            }
          }

          // Return local package with mixins
          return { ...downloadedPackage, ...local } as LocalPackage;
        } finally {
          downloadProgressSubscription?.remove();
        }
      },
      isPending: false, // A remote package could never be in a pending state
    };
  };

  const local: LocalPackageMixin = {
    async install(
      this: LocalPackage,
      installMode: InstallMode = InstallMode.ON_NEXT_RESTART,
      minimumBackgroundDuration: number = 0,
      updateInstalledCallback?: () => void
    ): Promise<void> {
      const localPackage = this;
      log(
        `Installing package: ${localPackage.packageHash} with mode: ${installMode}`
      );

      // Create clean copy for native module
      const localPackageCopy: Partial<LocalPackage> = Object.assign(
        {},
        localPackage
      );
      Object.keys(localPackageCopy).forEach(
        (key) =>
          typeof (localPackageCopy as any)[key] === 'function' &&
          delete (localPackageCopy as any)[key]
      );

      await NativeCodePushModule.installUpdate(
        localPackageCopy as any,
        installMode,
        minimumBackgroundDuration
      );

      log(`Package installed: ${localPackage.packageHash}`);
      updateInstalledCallback?.();

      if (installMode === InstallMode.IMMEDIATE) {
        log('Restarting app immediately');
        await NativeCodePushModule.restartApp(false);
      } else {
        await NativeCodePushModule.clearPendingRestart();
        localPackage.isPending = true; // Mark as pending until restart
        log('Package marked as pending until restart');
      }
    },
    isPending: false, // A local package wouldn't be pending until it was installed
  };

  return { local, remote };
};

const PackageMixins = createPackageMixins(NativeCodePush);
export default PackageMixins;
