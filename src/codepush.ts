// // src/CodePush.ts
// import { Alert, AppState, Platform } from 'react-native';
// import hoistStatics from 'hoist-non-react-statics';

// import NativeCodePush from './NativeReactNativeCodePush';
// import PackageMixins from './package-mixins';
// import { AcquisitionManager as Sdk } from './acquisition-sdk';
// import requestFetchAdapter from './request-fetch-adapter';
// import log from './logging';
// import React from 'react';
// import {
//   type CodePushConfiguration,
//   type LocalPackage,
//   type RemotePackage,
//   type SyncOptions,
//   SyncStatus,
//   InstallMode,
//   CheckFrequency,
//   UpdateState,
//   type UpdateDialogOptions,
//   type SyncStatusChangeCallback,
//   type DownloadProgressCallback,
//   type HandleBinaryVersionMismatchCallback,
//   type RollbackRetryOptions,
//   type LatestRollbackInfo,
// } from './types';

// // Configuration management
// const getConfiguration = (() => {
//   let config: CodePushConfiguration | undefined;
//   return async function getConfiguration(): Promise<CodePushConfiguration> {
//     if (config) {
//       log('getConfiguration: returning cached config');
//       return config;
//     } else {
//       log('getConfiguration: fetching from native module');
//       config = await NativeCodePush.getConfiguration();
//       log(
//         `getConfiguration: received config with serverUrl=${config.serverUrl}, deploymentKey=${config.deploymentKey?.substring(0, 10)}...`
//       );
//       return config;
//     }
//   };
// })();

// // Get promisified SDK instance
// function getPromisifiedSdk(
//   requestFetchAdapter: any,
//   config: CodePushConfiguration
// ) {
//   log(`getPromisifiedSdk: creating SDK instance`);
//   return new Sdk(requestFetchAdapter, config);
// }

// // Core update checking logic with proper SDK integration
// async function checkForUpdate(
//   deploymentKey: string | null = null,
//   handleBinaryVersionMismatchCallback: HandleBinaryVersionMismatchCallback | null = null
// ): Promise<RemotePackage | null> {
//   log(
//     `checkForUpdate called with deploymentKey: ${deploymentKey?.substring(0, 10)}...`
//   );

//   /*
//    * Before we ask the server if an update exists, we
//    * need to retrieve three pieces of information from the
//    * native side: deployment key, app version (e.g. 1.0.1)
//    * and the hash of the currently running update (if there is one).
//    * This allows the client to only receive updates which are targetted
//    * for their specific deployment and version and which are actually
//    * different from the CodePush update they have already installed.
//    */
//   const nativeConfig = await getConfiguration();
//   log(`checkForUpdate: got native config`);

//   /*
//    * If a deployment key was explicitly provided,
//    * then let's override the one we retrieved
//    * from the native-side of the app. This allows
//    * dynamically "redirecting" end-users at different
//    * deployments (e.g. an early access deployment for insiders).
//    */
//   const config = deploymentKey
//     ? { ...nativeConfig, deploymentKey }
//     : nativeConfig;
//   log(
//     `checkForUpdate: using config with deploymentKey=${config.deploymentKey?.substring(0, 10)}...`
//   );

//   const sdk = getPromisifiedSdk(requestFetchAdapter, config);

//   // Use dynamically overridden getCurrentPackage() during tests.
//   const localPackage = await getCurrentPackage();
//   log(
//     `checkForUpdate: got local package: ${localPackage ? localPackage.label : 'null'}`
//   );

//   /*
//    * If the app has a previously installed update, and that update
//    * was targetted at the same app version that is currently running,
//    * then we want to use its package hash to determine whether a new
//    * release has been made on the server. Otherwise, we only need
//    * to send the app version to the server, since we are interested
//    * in any updates for current binary version, regardless of hash.
//    */
//   let queryPackage: any;
//   if (localPackage) {
//     queryPackage = localPackage;
//     log(`checkForUpdate: using local package for query`);
//   } else {
//     queryPackage = { appVersion: config.appVersion };
//     if (Platform.OS === 'ios' && config.packageHash) {
//       queryPackage.packageHash = config.packageHash;
//     }
//     log(`checkForUpdate: using app version for query: ${config.appVersion}`);
//   }

//   const update = await sdk.queryUpdateWithCurrentPackage(queryPackage);
//   log(
//     `checkForUpdate: received update from SDK: ${update ? 'available' : 'none'}`
//   );

//   /*
//    * There are four cases where checkForUpdate will resolve to null:
//    * ----------------------------------------------------------------
//    * 1) The server said there isn't an update. This is the most common case.
//    * 2) The server said there is an update but it requires a newer binary version.
//    * This would occur when end-users are running an older binary version than
//    * is available, and CodePush is making sure they don't get an update that
//    * potentially wouldn't be compatible with what they are running.
//    * 3) The server said there is an update, but the update's hash is the same as
//    * the currently running update. This should _never_ happen, unless there is a
//    * bug in the server, but we're adding this check just to double-check that the
//    * client app is resilient to a potential issue with the update check.
//    * 4) The server said there is an update, but the update's hash is the same as that
//    * of the binary's currently running version. This should only happen in Android -
//    * unlike iOS, we don't attach the binary's hash to the updateCheck request
//    * because we want to avoid having to install diff updates against the binary's
//    * version, which we can't do yet on Android.
//    */
//   if (
//     !update ||
//     update.updateAppVersion ||
//     (localPackage && update.packageHash === localPackage.packageHash) ||
//     ((!localPackage || localPackage._isDebugOnly) &&
//       config.packageHash === update.packageHash)
//   ) {
//     if (update && update.updateAppVersion) {
//       log(
//         'checkForUpdate: An update is available but it is not targeting the binary version of your app.'
//       );
//       if (
//         handleBinaryVersionMismatchCallback &&
//         typeof handleBinaryVersionMismatchCallback === 'function'
//       ) {
//         handleBinaryVersionMismatchCallback(update);
//       }
//     }

//     log(`checkForUpdate: returning null (no applicable update)`);
//     return null;
//   } else {
//     const remotePackage = {
//       ...update,
//       ...PackageMixins.remote(sdk.reportStatusDownload),
//     };
//     remotePackage.failedInstall = await NativeCodePush.isFailedUpdate(
//       remotePackage.packageHash
//     );
//     remotePackage.deploymentKey = deploymentKey || nativeConfig.deploymentKey;
//     log(`checkForUpdate: returning remote package: ${remotePackage.label}`);
//     return remotePackage;
//   }
// }

// // Get current package metadata
// async function getCurrentPackage(): Promise<LocalPackage | null> {
//   log('getCurrentPackage called');
//   return await getUpdateMetadata(CodePush.UpdateState.LATEST);
// }

// async function getUpdateMetadata(
//   updateState: UpdateState
// ): Promise<LocalPackage | null> {
//   log(`getUpdateMetadata called with state: ${updateState}`);
//   let updateMetadata = await NativeCodePush.getUpdateMetadata(
//     updateState || CodePush.UpdateState.RUNNING
//   );
//   if (updateMetadata) {
//     updateMetadata = { ...PackageMixins.local, ...updateMetadata };
//     updateMetadata.failedInstall = await NativeCodePush.isFailedUpdate(
//       updateMetadata.packageHash
//     );
//     updateMetadata.isFirstRun = await NativeCodePush.isFirstRun(
//       updateMetadata.packageHash
//     );
//     log(
//       `getUpdateMetadata: returning metadata for package: ${updateMetadata.label}`
//     );
//   } else {
//     log(`getUpdateMetadata: no metadata found`);
//   }
//   return updateMetadata;
// }

// // This ensures that notifyApplicationReadyInternal is only called once
// // in the lifetime of this module instance.
// const notifyApplicationReady = (() => {
//   let notifyApplicationReadyPromise: Promise<any> | undefined;
//   return () => {
//     if (!notifyApplicationReadyPromise) {
//       log('notifyApplicationReady: first call, executing internal method');
//       notifyApplicationReadyPromise = notifyApplicationReadyInternal();
//     } else {
//       log('notifyApplicationReady: returning cached promise');
//     }
//     return notifyApplicationReadyPromise;
//   };
// })();

// async function notifyApplicationReadyInternal() {
//   log('notifyApplicationReadyInternal: calling native module');
//   await NativeCodePush.notifyApplicationReady();

//   // Try to report any pending status
//   try {
//     log('notifyApplicationReadyInternal: checking for status reports');
//     const statusReport = await tryGetStatusReport();
//     if (statusReport) {
//       log(
//         'notifyApplicationReadyInternal: found status report, attempting to send'
//       );
//       tryReportStatus(statusReport); // Don't wait for this to complete.
//     }
//   } catch (error) {
//     log(
//       `notifyApplicationReadyInternal: error getting status report: ${error}`
//     );
//   }

//   return true;
// }

// async function tryGetStatusReport(): Promise<any> {
//   try {
//     // This would be implemented in your native module
//     // For now, return null as placeholder
//     return null;
//   } catch (error) {
//     log(`tryGetStatusReport error: ${error}`);
//     return null;
//   }
// }

// async function tryReportStatus(statusReport: any, retryOnAppResume?: any) {
//   const config = await getConfiguration();
//   const previousLabelOrAppVersion = statusReport.previousLabelOrAppVersion;
//   const previousDeploymentKey =
//     statusReport.previousDeploymentKey || config.deploymentKey;

//   log(`tryReportStatus: attempting to report status`);

//   try {
//     if (statusReport.appVersion) {
//       log(`Reporting binary update (${statusReport.appVersion})`);

//       if (!config.deploymentKey) {
//         throw new Error('Deployment key is missing');
//       }

//       const sdk = getPromisifiedSdk(requestFetchAdapter, config);
//       await sdk.reportStatusDeploy(
//         /* deployedPackage */ null,
//         /* status */ null,
//         previousLabelOrAppVersion,
//         previousDeploymentKey
//       );
//     } else {
//       const label = statusReport.package.label;
//       if (statusReport.status === 'DeploymentSucceeded') {
//         log(`Reporting CodePush update success (${label})`);
//       } else {
//         log(`Reporting CodePush update rollback (${label})`);
//         await NativeCodePush.setLatestRollbackInfo(
//           statusReport.package.packageHash
//         );
//       }

//       config.deploymentKey = statusReport.package.deploymentKey;
//       const sdk = getPromisifiedSdk(requestFetchAdapter, config);
//       await sdk.reportStatusDeploy(
//         statusReport.package,
//         statusReport.status,
//         previousLabelOrAppVersion,
//         previousDeploymentKey
//       );
//     }

//     // Record that status was reported successfully
//     // This would be implemented in your native module
//     log('tryReportStatus: status reported successfully');
//     retryOnAppResume && retryOnAppResume.remove();
//   } catch (e) {
//     log(`Report status failed: ${JSON.stringify(statusReport)} - Error: ${e}`);

//     // Try again when the app resumes
//     if (!retryOnAppResume) {
//       const resumeListener = AppState.addEventListener(
//         'change',
//         async (newState) => {
//           if (newState !== 'active') return;
//           const refreshedStatusReport = await tryGetStatusReport();
//           if (refreshedStatusReport) {
//             tryReportStatus(refreshedStatusReport, resumeListener);
//           } else {
//             resumeListener && resumeListener.remove();
//           }
//         }
//       );
//     }
//   }
// }

// // Restart app functionality
// async function restartApp(
//   onlyIfUpdateIsPending: boolean = false
// ): Promise<void> {
//   await NativeCodePush.restartApp(onlyIfUpdateIsPending);
// }

// // Check if update should be ignored due to rollback retry options
// async function shouldUpdateBeIgnored(
//   remotePackage: RemotePackage,
//   syncOptions: SyncOptions
// ): Promise<boolean> {
//   let { rollbackRetryOptions } = syncOptions;

//   const isFailedPackage = remotePackage && remotePackage.failedInstall;
//   if (!isFailedPackage || !syncOptions.ignoreFailedUpdates) {
//     return false;
//   }

//   if (!rollbackRetryOptions) {
//     return true;
//   }

//   if (typeof rollbackRetryOptions !== 'object') {
//     rollbackRetryOptions = CodePush.DEFAULT_ROLLBACK_RETRY_OPTIONS;
//   } else {
//     rollbackRetryOptions = {
//       ...CodePush.DEFAULT_ROLLBACK_RETRY_OPTIONS,
//       ...rollbackRetryOptions,
//     };
//   }

//   if (!validateRollbackRetryOptions(rollbackRetryOptions)) {
//     return true;
//   }

//   const latestRollbackInfo = await NativeCodePush.getLatestRollbackInfo();
//   if (
//     !validateLatestRollbackInfo(latestRollbackInfo, remotePackage.packageHash!)
//   ) {
//     log('The latest rollback info is not valid.');
//     return true;
//   }

//   const { delayInHours, maxRetryAttempts } = rollbackRetryOptions;
//   const hoursSinceLatestRollback =
//     (Date.now() - latestRollbackInfo!.time) / (1000 * 60 * 60);
//   if (
//     hoursSinceLatestRollback! >= delayInHours! &&
//     maxRetryAttempts! >= latestRollbackInfo!.count
//   ) {
//     log('Previous rollback should be ignored due to rollback retry options.');
//     return false;
//   }

//   return true;
// }

// function validateLatestRollbackInfo(
//   latestRollbackInfo: LatestRollbackInfo | null,
//   packageHash: string
// ): boolean {
//   return !!(
//     latestRollbackInfo &&
//     latestRollbackInfo.time &&
//     latestRollbackInfo.count &&
//     latestRollbackInfo.packageHash &&
//     latestRollbackInfo.packageHash === packageHash
//   );
// }

// function validateRollbackRetryOptions(
//   rollbackRetryOptions: RollbackRetryOptions
// ): boolean {
//   if (typeof rollbackRetryOptions.delayInHours !== 'number') {
//     log("The 'delayInHours' rollback retry parameter must be a number.");
//     return false;
//   }

//   if (typeof rollbackRetryOptions.maxRetryAttempts !== 'number') {
//     log("The 'maxRetryAttempts' rollback retry parameter must be a number.");
//     return false;
//   }

//   if (rollbackRetryOptions.maxRetryAttempts! < 1) {
//     log(
//       "The 'maxRetryAttempts' rollback retry parameter cannot be less then 1."
//     );
//     return false;
//   }

//   return true;
// }

// // Sync functionality with status tracking
// const sync = (() => {
//   let syncInProgress = false;
//   const setSyncCompleted = () => {
//     syncInProgress = false;
//   };

//   return (
//     options: SyncOptions = {},
//     syncStatusChangeCallback?: SyncStatusChangeCallback,
//     downloadProgressCallback?: DownloadProgressCallback,
//     handleBinaryVersionMismatchCallback?: HandleBinaryVersionMismatchCallback
//   ): Promise<SyncStatus> => {
//     let syncStatusCallbackWithTryCatch: SyncStatusChangeCallback | undefined;
//     let downloadProgressCallbackWithTryCatch:
//       | DownloadProgressCallback
//       | undefined;

//     if (typeof syncStatusChangeCallback === 'function') {
//       syncStatusCallbackWithTryCatch = (...args: [SyncStatus]) => {
//         try {
//           syncStatusChangeCallback(...args);
//         } catch (error: any) {
//           log(`An error has occurred: ${error.stack}`);
//         }
//       };
//     }

//     if (typeof downloadProgressCallback === 'function') {
//       downloadProgressCallbackWithTryCatch = (
//         ...args: Parameters<DownloadProgressCallback>
//       ) => {
//         try {
//           downloadProgressCallback(...args);
//         } catch (error: any) {
//           log(`An error has occurred: ${error.stack}`);
//         }
//       };
//     }

//     if (syncInProgress) {
//       typeof syncStatusCallbackWithTryCatch === 'function'
//         ? syncStatusCallbackWithTryCatch(CodePush.SyncStatus.SYNC_IN_PROGRESS)
//         : log('Sync already in progress.');
//       return Promise.resolve(CodePush.SyncStatus.SYNC_IN_PROGRESS);
//     }

//     syncInProgress = true;
//     const syncPromise = syncInternal(
//       options,
//       syncStatusCallbackWithTryCatch,
//       downloadProgressCallbackWithTryCatch,
//       handleBinaryVersionMismatchCallback
//     );
//     syncPromise.then(setSyncCompleted).catch(setSyncCompleted);

//     return syncPromise;
//   };
// })();

// // Internal sync implementation
// async function syncInternal(
//   options: SyncOptions = {},
//   syncStatusChangeCallback?: SyncStatusChangeCallback,
//   downloadProgressCallback?: DownloadProgressCallback,
//   handleBinaryVersionMismatchCallback?: HandleBinaryVersionMismatchCallback
// ): Promise<SyncStatus> {
//   let resolvedInstallMode: InstallMode;
//   const syncOptions: Required<SyncOptions> = {
//     deploymentKey: null,
//     ignoreFailedUpdates: true,
//     rollbackRetryOptions: null,
//     installMode: CodePush.InstallMode.ON_NEXT_RESTART,
//     mandatoryInstallMode: CodePush.InstallMode.IMMEDIATE,
//     minimumBackgroundDuration: 0,
//     updateDialog: null,
//     ...options,
//   } as Required<SyncOptions>;

//   const defaultSyncStatusCallback: SyncStatusChangeCallback = (
//     syncStatus: SyncStatus
//   ) => {
//     switch (syncStatus) {
//       case CodePush.SyncStatus.CHECKING_FOR_UPDATE:
//         log('Checking for update.');
//         break;
//       case CodePush.SyncStatus.DOWNLOADING_PACKAGE:
//         log('Downloading package.');
//         break;
//       case CodePush.SyncStatus.INSTALLING_UPDATE:
//         log('Installing update.');
//         break;
//       case CodePush.SyncStatus.UP_TO_DATE:
//         log('App is up to date.');
//         break;
//       case CodePush.SyncStatus.UPDATE_INSTALLED:
//         log('Update is installed.');
//         break;
//       default:
//         break;
//     }
//   };

//   syncStatusChangeCallback =
//     typeof syncStatusChangeCallback === 'function'
//       ? syncStatusChangeCallback
//       : defaultSyncStatusCallback;

//   try {
//     await CodePush.notifyApplicationReady();

//     syncStatusChangeCallback(CodePush.SyncStatus.CHECKING_FOR_UPDATE);
//     const remotePackage = await checkForUpdate(
//       syncOptions.deploymentKey,
//       handleBinaryVersionMismatchCallback
//     );

//     const doDownloadAndInstall = async (): Promise<SyncStatus> => {
//       syncStatusChangeCallback!(CodePush.SyncStatus.DOWNLOADING_PACKAGE);
//       const localPackage = await remotePackage!.download(
//         downloadProgressCallback
//       );

//       resolvedInstallMode = localPackage.isMandatory
//         ? syncOptions.mandatoryInstallMode
//         : syncOptions.installMode;

//       syncStatusChangeCallback!(CodePush.SyncStatus.INSTALLING_UPDATE);
//       await localPackage.install(
//         resolvedInstallMode,
//         syncOptions.minimumBackgroundDuration,
//         () => {
//           syncStatusChangeCallback!(CodePush.SyncStatus.UPDATE_INSTALLED);
//         }
//       );

//       return CodePush.SyncStatus.UPDATE_INSTALLED;
//     };

//     const updateShouldBeIgnored = await shouldUpdateBeIgnored(
//       remotePackage!,
//       syncOptions
//     );

//     if (!remotePackage || updateShouldBeIgnored) {
//       const currentPackage = await CodePush.getCurrentPackage();
//       if (currentPackage && currentPackage.isPending) {
//         syncStatusChangeCallback(CodePush.SyncStatus.UPDATE_INSTALLED);
//         return CodePush.SyncStatus.UPDATE_INSTALLED;
//       } else {
//         syncStatusChangeCallback(CodePush.SyncStatus.UP_TO_DATE);
//         return CodePush.SyncStatus.UP_TO_DATE;
//       }
//     } else if (syncOptions.updateDialog) {
//       let dialogOptions: UpdateDialogOptions;

//       if (typeof syncOptions.updateDialog !== 'object') {
//         dialogOptions = CodePush.DEFAULT_UPDATE_DIALOG;
//       } else {
//         dialogOptions = {
//           ...CodePush.DEFAULT_UPDATE_DIALOG,
//           ...syncOptions.updateDialog,
//         };
//       }

//       return await new Promise<SyncStatus>((resolve, reject) => {
//         let message: string;
//         let installButtonText: string;
//         const dialogButtons: Array<{ text: string; onPress: () => void }> = [];

//         if (remotePackage.isMandatory) {
//           message = dialogOptions.mandatoryUpdateMessage!;
//           installButtonText = dialogOptions.mandatoryContinueButtonLabel!;
//         } else {
//           message = dialogOptions.optionalUpdateMessage!;
//           installButtonText = dialogOptions.optionalInstallButtonLabel!;

//           dialogButtons.push({
//             text: dialogOptions.optionalIgnoreButtonLabel!,
//             onPress: () => {
//               syncStatusChangeCallback!(CodePush.SyncStatus.UPDATE_IGNORED);
//               resolve(CodePush.SyncStatus.UPDATE_IGNORED);
//             },
//           });
//         }

//         dialogButtons.push({
//           text: installButtonText,
//           onPress: () => {
//             doDownloadAndInstall().then(resolve, reject);
//           },
//         });

//         if (
//           dialogOptions.appendReleaseDescription &&
//           remotePackage.description
//         ) {
//           message += `${dialogOptions.descriptionPrefix} ${remotePackage.description}`;
//         }

//         syncStatusChangeCallback!(CodePush.SyncStatus.AWAITING_USER_ACTION);
//         Alert.alert(dialogOptions.title!, message, dialogButtons);
//       });
//     } else {
//       return await doDownloadAndInstall();
//     }
//   } catch (error: any) {
//     syncStatusChangeCallback!(CodePush.SyncStatus.UNKNOWN_ERROR);
//     log(error.message);
//     throw error;
//   }
// }

// // Higher-Order Component (HOC) interface
// interface CodePushOptions {
//   checkFrequency?: CheckFrequency;
//   installMode?: InstallMode;
//   mandatoryInstallMode?: InstallMode;
//   minimumBackgroundDuration?: number;
//   updateDialog?: UpdateDialogOptions | boolean;
//   deploymentKey?: string;
// }

// interface ComponentWithCodePush extends React.Component {
//   codePushStatusDidChange?(syncStatus: SyncStatus): void;
//   codePushDownloadDidProgress?(progress: any): void;
//   codePushOnBinaryVersionMismatch?(update: RemotePackage): void;
// }

// // Overloaded function signatures for codePushify
// // Overload signatures
// function codePushify<P extends {}>(
//   RootComponent: React.ComponentType<P>
// ): React.ComponentType<P>;
// function codePushify<P extends {}>(
//   options?: CodePushOptions
// ): <T extends React.ComponentType<P>>(
//   RootComponent: T
// ) => React.ComponentType<P>;

// // Single implementation
// function codePushify<P extends {}>(
//   optionsOrComponent?: CodePushOptions | React.ComponentType<P>
// ): any {
//   if (typeof optionsOrComponent === 'function') {
//     const decorator = makeDecorator({});
//     return decorator(optionsOrComponent);
//   } else {
//     return makeDecorator(optionsOrComponent || {});
//   }

//   // Internal function so we don't duplicate the logic
//   function makeDecorator(options: CodePushOptions) {
//     return <T extends React.ComponentType<P>>(RootComponent: T) => {
//       class CodePushComponent extends React.Component<P> {
//         private rootComponentRef = React.createRef<ComponentWithCodePush>();
//         componentDidMount() {
//           if (options.checkFrequency === CodePush.CheckFrequency.MANUAL) {
//             CodePush.notifyAppReady();
//           } else {
//             const rootInstance = this.rootComponentRef.current;
//             let syncStatusCallback: SyncStatusChangeCallback | undefined;
//             if (rootInstance && rootInstance.codePushStatusDidChange)
//               syncStatusCallback =
//                 rootInstance.codePushStatusDidChange.bind(rootInstance);

//             let downloadProgressCallback: DownloadProgressCallback | undefined;
//             if (rootInstance && rootInstance.codePushDownloadDidProgress)
//               downloadProgressCallback =
//                 rootInstance.codePushDownloadDidProgress.bind(rootInstance);

//             let handleBinaryVersionMismatchCallback:
//               | HandleBinaryVersionMismatchCallback
//               | undefined;
//             if (rootInstance && rootInstance.codePushOnBinaryVersionMismatch)
//               handleBinaryVersionMismatchCallback =
//                 rootInstance.codePushOnBinaryVersionMismatch.bind(rootInstance);

//             CodePush.sync(
//               options,
//               syncStatusCallback,
//               downloadProgressCallback,
//               handleBinaryVersionMismatchCallback
//             );

//             if (
//               options.checkFrequency === CodePush.CheckFrequency.ON_APP_RESUME
//             ) {
//               AppState.addEventListener('change', (state) => {
//                 if (state === 'active') {
//                   CodePush.sync(
//                     options,
//                     syncStatusCallback,
//                     downloadProgressCallback
//                   );
//                 }
//               });
//             }
//           }
//         }
//         render() {
//           const props = { ...this.props } as P;
//           if ((RootComponent as any).prototype?.render) {
//             (props as any).ref = this.rootComponentRef;
//           }
//           return React.createElement(RootComponent, props);
//         }
//       }
//       return hoistStatics(
//         CodePushComponent,
//         RootComponent as React.ComponentClass<P>
//       );
//     };
//   }
// }

// // Main CodePush interface
// interface CodePushStatic {
//   (
//     options?: CodePushOptions
//   ): <P extends {}>(
//     component: React.ComponentType<P>
//   ) => React.ComponentType<P>;
//   <P extends {}>(component: React.ComponentType<P>): React.ComponentType<P>;

//   checkForUpdate: typeof checkForUpdate;
//   getConfiguration: typeof getConfiguration;
//   getCurrentPackage: typeof getCurrentPackage;
//   getUpdateMetadata: typeof getUpdateMetadata;
//   log: typeof log;
//   notifyAppReady: typeof notifyApplicationReady;
//   notifyApplicationReady: typeof notifyApplicationReady;
//   restartApp: typeof restartApp;
//   sync: typeof sync;
//   disallowRestart: () => Promise<void>;
//   allowRestart: () => Promise<void>;

//   InstallMode: typeof InstallMode;
//   SyncStatus: typeof SyncStatus;
//   CheckFrequency: typeof CheckFrequency;
//   UpdateState: typeof UpdateState;

//   DEFAULT_UPDATE_DIALOG: Required<UpdateDialogOptions>;
//   DEFAULT_ROLLBACK_RETRY_OPTIONS: Required<RollbackRetryOptions>;
// }

// // Export the AcquisitionSdk for testing
// let testConfig: any;
// function setUpTestDependencies(
//   testSdk?: any,
//   providedTestConfig?: any,
//   testNativeBridge?: any
// ) {
//   if (testSdk) module.exports.AcquisitionSdk = testSdk;
//   if (providedTestConfig) testConfig = providedTestConfig;
//   if (testNativeBridge) NativeCodePush = testNativeBridge;
// }

// // Main CodePush object
// let CodePush: any;

// if (NativeCodePush) {
//   const codePushBase = codePushify as any;

//   // Attach all methods and constants to CodePush
//   Object.assign(codePushBase, {
//     AcquisitionSdk: Sdk, // Export the acquisition SDK
//     checkForUpdate,
//     getConfiguration,
//     getCurrentPackage,
//     getUpdateMetadata,
//     log,
//     notifyAppReady: notifyApplicationReady,
//     notifyApplicationReady,
//     restartApp: async (onlyIfUpdateIsPending: boolean = false) =>
//       await NativeCodePush.restartApp(onlyIfUpdateIsPending),
//     sync, // Your existing sync implementation
//     disallowRestart: async () => await NativeCodePush.disallowRestart(),
//     allowRestart: async () => await NativeCodePush.allowRestart(),
//     setUpTestDependencies, // For testing

//     // Constants
//     InstallMode,
//     SyncStatus,
//     CheckFrequency,
//     UpdateState,

//     // Default configurations
//     DEFAULT_UPDATE_DIALOG: {
//       appendReleaseDescription: false,
//       descriptionPrefix: ' Description: ',
//       mandatoryContinueButtonLabel: 'Continue',
//       mandatoryUpdateMessage: 'An update is available that must be installed.',
//       optionalIgnoreButtonLabel: 'Ignore',
//       optionalInstallButtonLabel: 'Install',
//       optionalUpdateMessage:
//         'An update is available. Would you like to install it?',
//       title: 'Update available',
//     } as Required<UpdateDialogOptions>,

//     DEFAULT_ROLLBACK_RETRY_OPTIONS: {
//       delayInHours: 24,
//       maxRetryAttempts: 1,
//     } as Required<RollbackRetryOptions>,
//   });

//   CodePush = codePushBase;
// } else {
//   log(
//     "The CodePush module doesn't appear to be properly installed. Please double-check that everything is setup correctly."
//   );
//   CodePush = null as any;
// }

// export default CodePush;
// export * from './types';

// src/CodePush.ts
import { Alert, AppState, Platform } from 'react-native';
import hoistStatics from 'hoist-non-react-statics';

import NativeCodePush from './NativeReactNativeCodePush';
import PackageMixins from './package-mixins';
import { getPromisifiedSdk, AcquisitionSdk as Sdk } from './acquisition-sdk';
import requestFetchAdapter from './request-fetch-adapter';
import log from './logging';
import React from 'react';
import {
  type CodePushConfiguration,
  type LocalPackage,
  type RemotePackage,
  type SyncOptions,
  SyncStatus,
  InstallMode,
  CheckFrequency,
  UpdateState,
  type UpdateDialogOptions,
  type SyncStatusChangeCallback,
  type DownloadProgressCallback,
  type HandleBinaryVersionMismatchCallback,
  type RollbackRetryOptions,
  type LatestRollbackInfo,
} from './types';

// Global reference to allow dynamic overriding during tests
let AcquisitionSdkRef = Sdk;
let getCurrentPackageRef: () => Promise<LocalPackage | null>;

// Configuration management - singleton pattern like CodePushNext
const getConfiguration = (() => {
  let config: CodePushConfiguration | undefined;
  return async function getConfiguration(): Promise<CodePushConfiguration> {
    if (config) {
      log('getConfiguration: returning cached config');
      return config;
    } else if (testConfig) {
      log('getConfiguration: returning test config');
      return testConfig;
    } else {
      log('getConfiguration: fetching from native module');
      config = await NativeCodePush.getConfiguration();
      log(
        `getConfiguration: received config with serverUrl=${config.serverUrl}, deploymentKey=${config.deploymentKey?.substring(0, 10)}...`
      );
      return config;
    }
  };
})();

// Get current package metadata
async function getCurrentPackage(): Promise<LocalPackage | null> {
  log('getCurrentPackage called');
  return await getUpdateMetadata(UpdateState.LATEST);
}

async function getUpdateMetadata(
  updateState: UpdateState
): Promise<LocalPackage | null> {
  log(`getUpdateMetadata called with state: ${updateState}`);
  let updateMetadata = await NativeCodePush.getUpdateMetadata(
    updateState || UpdateState.RUNNING
  );
  if (updateMetadata) {
    updateMetadata = { ...PackageMixins.local, ...updateMetadata };
    updateMetadata.failedInstall = await NativeCodePush.isFailedUpdate(
      updateMetadata.packageHash
    );
    updateMetadata.isFirstRun = await NativeCodePush.isFirstRun(
      updateMetadata.packageHash
    );
    log(
      `getUpdateMetadata: returning metadata for package: ${updateMetadata.label}`
    );
  } else {
    log(`getUpdateMetadata: no metadata found`);
  }
  return updateMetadata;
}

// Core update checking logic - following CodePushNext pattern exactly
async function checkForUpdate(
  deploymentKey: string | null = null,
  handleBinaryVersionMismatchCallback: HandleBinaryVersionMismatchCallback | null = null
): Promise<RemotePackage | null> {
  log(
    `checkForUpdate called with deploymentKey: ${deploymentKey?.substring(0, 10)}...`
  );

  /*
   * Before we ask the server if an update exists, we
   * need to retrieve three pieces of information from the
   * native side: deployment key, app version (e.g. 1.0.1)
   * and the hash of the currently running update (if there is one).
   * This allows the client to only receive updates which are targetted
   * for their specific deployment and version and which are actually
   * different from the CodePush update they have already installed.
   */
  const nativeConfig = await getConfiguration();
  log(`checkForUpdate: got native config`);

  /*
   * If a deployment key was explicitly provided,
   * then let's override the one we retrieved
   * from the native-side of the app. This allows
   * dynamically "redirecting" end-users at different
   * deployments (e.g. an early access deployment for insiders).
   */
  const config = deploymentKey
    ? { ...nativeConfig, deploymentKey }
    : nativeConfig;
  log(
    `checkForUpdate: using config with deploymentKey=${config.deploymentKey?.substring(0, 10)}...`
  );

  const sdk = getPromisifiedSdk(requestFetchAdapter, config);

  // Use dynamically overridden getCurrentPackage() during tests - like CodePushNext
  const localPackage = await getCurrentPackageRef();
  log(
    `checkForUpdate: got local package: ${localPackage ? localPackage.label : 'null'}`
  );

  /*
   * If the app has a previously installed update, and that update
   * was targetted at the same app version that is currently running,
   * then we want to use its package hash to determine whether a new
   * release has been made on the server. Otherwise, we only need
   * to send the app version to the server, since we are interested
   * in any updates for current binary version, regardless of hash.
   */
  let queryPackage: any;
  if (localPackage) {
    queryPackage = localPackage;
    log(`checkForUpdate: using local package for query`);
  } else {
    queryPackage = { appVersion: config.appVersion };
    if (Platform.OS === 'ios' && config.packageHash) {
      queryPackage.packageHash = config.packageHash;
    }
    log(`checkForUpdate: using app version for query: ${config.appVersion}`);
  }

  const update = await sdk.queryUpdateWithCurrentPackage(queryPackage);
  log(
    `checkForUpdate: received update from SDK: ${update ? 'available' : 'none'}`
  );

  /*
   * There are four cases where checkForUpdate will resolve to null:
   * ----------------------------------------------------------------
   * 1) The server said there isn't an update. This is the most common case.
   * 2) The server said there is an update but it requires a newer binary version.
   * This would occur when end-users are running an older binary version than
   * is available, and CodePush is making sure they don't get an update that
   * potentially wouldn't be compatible with what they are running.
   * 3) The server said there is an update, but the update's hash is the same as
   * the currently running update. This should _never_ happen, unless there is a
   * bug in the server, but we're adding this check just to double-check that the
   * client app is resilient to a potential issue with the update check.
   * 4) The server said there is an update, but the update's hash is the same as that
   * of the binary's currently running version. This should only happen in Android -
   * unlike iOS, we don't attach the binary's hash to the updateCheck request
   * because we want to avoid having to install diff updates against the binary's
   * version, which we can't do yet on Android.
   */
  if (
    !update ||
    update.updateAppVersion ||
    (localPackage && update.packageHash === localPackage.packageHash) ||
    ((!localPackage || localPackage._isDebugOnly) &&
      config.packageHash === update.packageHash)
  ) {
    if (update && update.updateAppVersion) {
      log(
        'checkForUpdate: An update is available but it is not targeting the binary version of your app.'
      );
      if (
        handleBinaryVersionMismatchCallback &&
        typeof handleBinaryVersionMismatchCallback === 'function'
      ) {
        handleBinaryVersionMismatchCallback(update);
      }
    }

    log(`checkForUpdate: returning null (no applicable update)`);
    return null;
  } else {
    const remotePackage = {
      ...update,
      ...PackageMixins.remote(sdk.reportStatusDownload),
    };
    remotePackage.failedInstall = await NativeCodePush.isFailedUpdate(
      remotePackage.packageHash
    );
    remotePackage.deploymentKey = deploymentKey || nativeConfig.deploymentKey;
    log(`checkForUpdate: returning remote package: ${remotePackage.label}`);
    return remotePackage;
  }
}

// Application ready notification (singleton)
const notifyApplicationReady = (() => {
  let notifyApplicationReadyPromise: Promise<any> | undefined;
  return () => {
    if (!notifyApplicationReadyPromise) {
      log('notifyApplicationReady: first call, executing internal method');
      notifyApplicationReadyPromise = notifyApplicationReadyInternal();
    } else {
      log('notifyApplicationReady: returning cached promise');
    }
    return notifyApplicationReadyPromise;
  };
})();

async function notifyApplicationReadyInternal() {
  log('notifyApplicationReadyInternal: calling native module');
  await NativeCodePush.notifyApplicationReady();

  // Try to get status report like CodePushNext does
  try {
    log('notifyApplicationReadyInternal: checking for status reports');
    const statusReport = await tryGetStatusReport();
    if (statusReport) {
      log(
        'notifyApplicationReadyInternal: found status report, attempting to send'
      );
      tryReportStatus(statusReport); // Don't wait for this to complete.
    }
  } catch (error) {
    log(
      `notifyApplicationReadyInternal: error getting status report: ${error}`
    );
  }

  return true;
}

async function tryGetStatusReport(): Promise<any> {
  try {
    // This would be the equivalent of NativeCodePush.getNewStatusReport() in the original
    // For now, return null as placeholder - implement this in your native module
    return null;
  } catch (error) {
    log(`tryGetStatusReport error: ${error}`);
    return null;
  }
}

async function tryReportStatus(statusReport: any, retryOnAppResume?: any) {
  const config = await getConfiguration();
  const previousLabelOrAppVersion = statusReport.previousLabelOrAppVersion;
  const previousDeploymentKey =
    statusReport.previousDeploymentKey || config.deploymentKey;

  log(`tryReportStatus: attempting to report status`);

  try {
    if (statusReport.appVersion) {
      log(`Reporting binary update (${statusReport.appVersion})`);

      if (!config.deploymentKey) {
        throw new Error('Deployment key is missing');
      }

      const sdk = getPromisifiedSdk(requestFetchAdapter, config);
      await sdk.reportStatusDeploy(
        /* deployedPackage */ null,
        /* status */ null,
        previousLabelOrAppVersion,
        previousDeploymentKey
      );
    } else {
      const label = statusReport.package.label;
      if (statusReport.status === 'DeploymentSucceeded') {
        log(`Reporting CodePush update success (${label})`);
      } else {
        log(`Reporting CodePush update rollback (${label})`);
        await NativeCodePush.setLatestRollbackInfo(
          statusReport.package.packageHash
        );
      }

      config.deploymentKey = statusReport.package.deploymentKey;
      const sdk = getPromisifiedSdk(requestFetchAdapter, config);
      await sdk.reportStatusDeploy(
        statusReport.package,
        statusReport.status,
        previousLabelOrAppVersion,
        previousDeploymentKey
      );
    }

    // Record that status was reported successfully
    // This would be implemented in your native module like CodePushNext
    log('tryReportStatus: status reported successfully');
    retryOnAppResume && retryOnAppResume.remove();
  } catch (e) {
    log(`Report status failed: ${JSON.stringify(statusReport)} - Error: ${e}`);

    // Try again when the app resumes
    if (!retryOnAppResume) {
      const resumeListener = AppState.addEventListener(
        'change',
        async (newState) => {
          if (newState !== 'active') return;
          const refreshedStatusReport = await tryGetStatusReport();
          if (refreshedStatusReport) {
            tryReportStatus(refreshedStatusReport, resumeListener);
          } else {
            resumeListener && resumeListener.remove();
          }
        }
      );
    }
  }
}

// All the other functions (shouldUpdateBeIgnored, sync, etc.) remain the same...
// I'll keep them exactly as they were in your previous implementation

// Check if update should be ignored due to rollback retry options
async function shouldUpdateBeIgnored(
  remotePackage: RemotePackage,
  syncOptions: SyncOptions
): Promise<boolean> {
  let { rollbackRetryOptions } = syncOptions;

  const isFailedPackage = remotePackage && remotePackage.failedInstall;
  if (!isFailedPackage || !syncOptions.ignoreFailedUpdates) {
    return false;
  }

  if (!rollbackRetryOptions) {
    return true;
  }

  if (typeof rollbackRetryOptions !== 'object') {
    rollbackRetryOptions = DEFAULT_ROLLBACK_RETRY_OPTIONS;
  } else {
    rollbackRetryOptions = {
      ...DEFAULT_ROLLBACK_RETRY_OPTIONS,
      ...rollbackRetryOptions,
    };
  }

  if (!validateRollbackRetryOptions(rollbackRetryOptions)) {
    return true;
  }

  const latestRollbackInfo = await NativeCodePush.getLatestRollbackInfo();
  if (
    !validateLatestRollbackInfo(latestRollbackInfo, remotePackage.packageHash!)
  ) {
    log('The latest rollback info is not valid.');
    return true;
  }

  const { delayInHours, maxRetryAttempts } = rollbackRetryOptions;
  const hoursSinceLatestRollback =
    (Date.now() - latestRollbackInfo!.time) / (1000 * 60 * 60);
  if (
    hoursSinceLatestRollback! >= delayInHours! &&
    maxRetryAttempts! >= latestRollbackInfo!.count
  ) {
    log('Previous rollback should be ignored due to rollback retry options.');
    return false;
  }

  return true;
}

function validateLatestRollbackInfo(
  latestRollbackInfo: LatestRollbackInfo | null,
  packageHash: string
): boolean {
  return !!(
    latestRollbackInfo &&
    latestRollbackInfo.time &&
    latestRollbackInfo.count &&
    latestRollbackInfo.packageHash &&
    latestRollbackInfo.packageHash === packageHash
  );
}

function validateRollbackRetryOptions(
  rollbackRetryOptions: RollbackRetryOptions
): boolean {
  if (typeof rollbackRetryOptions.delayInHours !== 'number') {
    log("The 'delayInHours' rollback retry parameter must be a number.");
    return false;
  }

  if (typeof rollbackRetryOptions.maxRetryAttempts !== 'number') {
    log("The 'maxRetryAttempts' rollback retry parameter must be a number.");
    return false;
  }

  if (rollbackRetryOptions.maxRetryAttempts! < 1) {
    log(
      "The 'maxRetryAttempts' rollback retry parameter cannot be less then 1."
    );
    return false;
  }

  return true;
}

// Restart app functionality
async function restartApp(
  onlyIfUpdateIsPending: boolean = false
): Promise<void> {
  log(`restartApp called with onlyIfUpdateIsPending: ${onlyIfUpdateIsPending}`);
  await NativeCodePush.restartApp(onlyIfUpdateIsPending);
}

// Sync functionality with status tracking (keeping your existing implementation)
const sync = (() => {
  let syncInProgress = false;
  const setSyncCompleted = () => {
    syncInProgress = false;
  };

  return (
    options: SyncOptions = {},
    syncStatusChangeCallback?: SyncStatusChangeCallback,
    downloadProgressCallback?: DownloadProgressCallback,
    handleBinaryVersionMismatchCallback?: HandleBinaryVersionMismatchCallback
  ): Promise<SyncStatus> => {
    let syncStatusCallbackWithTryCatch: SyncStatusChangeCallback | undefined;
    let downloadProgressCallbackWithTryCatch:
      | DownloadProgressCallback
      | undefined;

    if (typeof syncStatusChangeCallback === 'function') {
      syncStatusCallbackWithTryCatch = (...args: [SyncStatus]) => {
        try {
          syncStatusChangeCallback(...args);
        } catch (error: any) {
          log(`An error has occurred: ${error.stack}`);
        }
      };
    }

    if (typeof downloadProgressCallback === 'function') {
      downloadProgressCallbackWithTryCatch = (
        ...args: Parameters<DownloadProgressCallback>
      ) => {
        try {
          downloadProgressCallback(...args);
        } catch (error: any) {
          log(`An error has occurred: ${error.stack}`);
        }
      };
    }

    if (syncInProgress) {
      typeof syncStatusCallbackWithTryCatch === 'function'
        ? syncStatusCallbackWithTryCatch(SyncStatus.SYNC_IN_PROGRESS)
        : log('Sync already in progress.');
      return Promise.resolve(SyncStatus.SYNC_IN_PROGRESS);
    }

    syncInProgress = true;
    const syncPromise = syncInternal(
      options,
      syncStatusCallbackWithTryCatch,
      downloadProgressCallbackWithTryCatch,
      handleBinaryVersionMismatchCallback
    );
    syncPromise.then(setSyncCompleted).catch(setSyncCompleted);

    return syncPromise;
  };
})();

// Internal sync implementation (keeping your existing logic)
async function syncInternal(
  options: SyncOptions = {},
  syncStatusChangeCallback?: SyncStatusChangeCallback,
  downloadProgressCallback?: DownloadProgressCallback,
  handleBinaryVersionMismatchCallback?: HandleBinaryVersionMismatchCallback
): Promise<SyncStatus> {
  let resolvedInstallMode: InstallMode;
  const syncOptions: Required<SyncOptions> = {
    deploymentKey: null,
    ignoreFailedUpdates: true,
    rollbackRetryOptions: null,
    installMode: InstallMode.ON_NEXT_RESTART,
    mandatoryInstallMode: InstallMode.IMMEDIATE,
    minimumBackgroundDuration: 0,
    updateDialog: null,
    ...options,
  } as Required<SyncOptions>;

  const defaultSyncStatusCallback: SyncStatusChangeCallback = (
    syncStatus: SyncStatus
  ) => {
    switch (syncStatus) {
      case SyncStatus.CHECKING_FOR_UPDATE:
        log('Checking for update.');
        break;
      case SyncStatus.AWAITING_USER_ACTION:
        log('Awaiting user action.');
        break;
      case SyncStatus.DOWNLOADING_PACKAGE:
        log('Downloading package.');
        break;
      case SyncStatus.INSTALLING_UPDATE:
        log('Installing update.');
        break;
      case SyncStatus.UP_TO_DATE:
        log('App is up to date.');
        break;
      case SyncStatus.UPDATE_IGNORED:
        log('User cancelled the update.');
        break;
      case SyncStatus.UPDATE_INSTALLED:
        if (resolvedInstallMode === InstallMode.ON_NEXT_RESTART) {
          log('Update is installed and will be run on the next app restart.');
        } else if (resolvedInstallMode === InstallMode.ON_NEXT_RESUME) {
          if (syncOptions.minimumBackgroundDuration > 0) {
            log(
              `Update is installed and will be run after the app has been in the background for at least ${syncOptions.minimumBackgroundDuration} seconds.`
            );
          } else {
            log(
              'Update is installed and will be run when the app next resumes.'
            );
          }
        }
        break;
      case SyncStatus.UNKNOWN_ERROR:
        log('An unknown error occurred.');
        break;
      default:
        break;
    }
  };

  syncStatusChangeCallback =
    typeof syncStatusChangeCallback === 'function'
      ? syncStatusChangeCallback
      : defaultSyncStatusCallback;

  try {
    await notifyApplicationReady();

    syncStatusChangeCallback(SyncStatus.CHECKING_FOR_UPDATE);
    const remotePackage = await checkForUpdate(
      syncOptions.deploymentKey,
      handleBinaryVersionMismatchCallback
    );

    const doDownloadAndInstall = async (): Promise<SyncStatus> => {
      syncStatusChangeCallback!(SyncStatus.DOWNLOADING_PACKAGE);
      const localPackage = await remotePackage!.download(
        downloadProgressCallback
      );

      // Determine the correct install mode based on whether the update is mandatory or not.
      resolvedInstallMode = localPackage.isMandatory
        ? syncOptions.mandatoryInstallMode
        : syncOptions.installMode;

      syncStatusChangeCallback!(SyncStatus.INSTALLING_UPDATE);
      await localPackage.install(
        resolvedInstallMode,
        syncOptions.minimumBackgroundDuration,
        () => {
          syncStatusChangeCallback!(SyncStatus.UPDATE_INSTALLED);
        }
      );

      return SyncStatus.UPDATE_INSTALLED;
    };

    const updateShouldBeIgnored = await shouldUpdateBeIgnored(
      remotePackage!,
      syncOptions
    );

    if (!remotePackage || updateShouldBeIgnored) {
      if (updateShouldBeIgnored) {
        log(
          'An update is available, but it is being ignored due to having been previously rolled back.'
        );
      }

      const currentPackage = await getCurrentPackage();
      if (currentPackage && currentPackage.isPending) {
        syncStatusChangeCallback(SyncStatus.UPDATE_INSTALLED);
        return SyncStatus.UPDATE_INSTALLED;
      } else {
        syncStatusChangeCallback(SyncStatus.UP_TO_DATE);
        return SyncStatus.UP_TO_DATE;
      }
    } else if (syncOptions.updateDialog) {
      // updateDialog supports any truthy value (e.g. true, "goo", 12),
      // but we should treat a non-object value as just the default dialog
      let dialogOptions: UpdateDialogOptions;

      if (typeof syncOptions.updateDialog !== 'object') {
        dialogOptions = DEFAULT_UPDATE_DIALOG;
      } else {
        dialogOptions = {
          ...DEFAULT_UPDATE_DIALOG,
          ...syncOptions.updateDialog,
        };
      }

      return await new Promise<SyncStatus>((resolve, reject) => {
        let message: string;
        let installButtonText: string;
        const dialogButtons: Array<{ text: string; onPress: () => void }> = [];

        if (remotePackage.isMandatory) {
          message = dialogOptions.mandatoryUpdateMessage!;
          installButtonText = dialogOptions.mandatoryContinueButtonLabel!;
        } else {
          message = dialogOptions.optionalUpdateMessage!;
          installButtonText = dialogOptions.optionalInstallButtonLabel!;

          // Since this is an optional update, add a button
          // to allow the end-user to ignore it
          dialogButtons.push({
            text: dialogOptions.optionalIgnoreButtonLabel!,
            onPress: () => {
              syncStatusChangeCallback!(SyncStatus.UPDATE_IGNORED);
              resolve(SyncStatus.UPDATE_IGNORED);
            },
          });
        }

        // Since the install button should be placed to the
        // right of any other button, add it last
        dialogButtons.push({
          text: installButtonText,
          onPress: () => {
            doDownloadAndInstall().then(resolve, reject);
          },
        });

        // If the update has a description, and the developer
        // explicitly chose to display it, then set that as the message
        if (
          dialogOptions.appendReleaseDescription &&
          remotePackage.description
        ) {
          message += `${dialogOptions.descriptionPrefix} ${remotePackage.description}`;
        }

        syncStatusChangeCallback!(SyncStatus.AWAITING_USER_ACTION);
        Alert.alert(dialogOptions.title!, message, dialogButtons);
      });
    } else {
      return await doDownloadAndInstall();
    }
  } catch (error: any) {
    syncStatusChangeCallback!(SyncStatus.UNKNOWN_ERROR);
    log(error.message);
    throw error;
  }
}

// Higher-Order Component implementation (keeping your existing logic)
interface CodePushOptions {
  checkFrequency?: CheckFrequency;
  installMode?: InstallMode;
  mandatoryInstallMode?: InstallMode;
  minimumBackgroundDuration?: number;
  updateDialog?: UpdateDialogOptions | boolean;
  deploymentKey?: string;
}

interface ComponentWithCodePush extends React.Component {
  codePushStatusDidChange?(syncStatus: SyncStatus): void;
  codePushDownloadDidProgress?(progress: any): void;
  codePushOnBinaryVersionMismatch?(update: RemotePackage): void;
}

// Combined overload signatures with single implementation
function codePushify<P extends {}>(
  RootComponent: React.ComponentType<P>
): React.ComponentType<P>;
function codePushify<P extends {}>(
  options?: CodePushOptions
): <T extends React.ComponentType<P>>(
  RootComponent: T
) => React.ComponentType<P>;
function codePushify<P extends {}>(
  optionsOrComponent?: CodePushOptions | React.ComponentType<P>
): any {
  if (typeof optionsOrComponent === 'function') {
    // Direct component passed - use default options
    const RootComponent = optionsOrComponent;
    return createCodePushComponent({}, RootComponent);
  } else {
    // Options passed - return decorator function
    const options = optionsOrComponent || {};
    return <T extends React.ComponentType<P>>(RootComponent: T) => {
      return createCodePushComponent(options, RootComponent);
    };
  }

  // Helper function to create the actual CodePush component
  function createCodePushComponent<T extends React.ComponentType<P>>(
    options: CodePushOptions,
    RootComponent: T
  ) {
    class CodePushComponent extends React.Component<P> {
      private rootComponentRef = React.createRef<ComponentWithCodePush>();

      componentDidMount() {
        if (options.checkFrequency === CheckFrequency.MANUAL) {
          notifyApplicationReady();
        } else {
          const rootComponentInstance = this.rootComponentRef.current;

          let syncStatusCallback: SyncStatusChangeCallback | undefined;
          if (
            rootComponentInstance &&
            rootComponentInstance.codePushStatusDidChange
          ) {
            syncStatusCallback =
              rootComponentInstance.codePushStatusDidChange.bind(
                rootComponentInstance
              );
          }

          let downloadProgressCallback: DownloadProgressCallback | undefined;
          if (
            rootComponentInstance &&
            rootComponentInstance.codePushDownloadDidProgress
          ) {
            downloadProgressCallback =
              rootComponentInstance.codePushDownloadDidProgress.bind(
                rootComponentInstance
              );
          }

          let handleBinaryVersionMismatchCallback:
            | HandleBinaryVersionMismatchCallback
            | undefined;
          if (
            rootComponentInstance &&
            rootComponentInstance.codePushOnBinaryVersionMismatch
          ) {
            handleBinaryVersionMismatchCallback =
              rootComponentInstance.codePushOnBinaryVersionMismatch.bind(
                rootComponentInstance
              );
          }

          sync(
            options,
            syncStatusCallback,
            downloadProgressCallback,
            handleBinaryVersionMismatchCallback
          );

          if (options.checkFrequency === CheckFrequency.ON_APP_RESUME) {
            AppState.addEventListener('change', (newState) => {
              if (newState === 'active') {
                sync(options, syncStatusCallback, downloadProgressCallback);
              }
            });
          }
        }
      }

      render() {
        const props = { ...this.props } as P;

        // We can set ref property on class components only (not stateless)
        // Check it by render method
        if (
          (RootComponent as any).prototype &&
          (RootComponent as any).prototype.render
        ) {
          (props as any).ref = this.rootComponentRef;
        }

        return React.createElement(RootComponent, props);
      }
    }

    return hoistStatics(
      CodePushComponent,
      RootComponent as React.ComponentClass<P>
    );
  }
}

// Constants
const DEFAULT_UPDATE_DIALOG: Required<UpdateDialogOptions> = {
  appendReleaseDescription: false,
  descriptionPrefix: ' Description: ',
  mandatoryContinueButtonLabel: 'Continue',
  mandatoryUpdateMessage: 'An update is available that must be installed.',
  optionalIgnoreButtonLabel: 'Ignore',
  optionalInstallButtonLabel: 'Install',
  optionalUpdateMessage:
    'An update is available. Would you like to install it?',
  title: 'Update available',
};

const DEFAULT_ROLLBACK_RETRY_OPTIONS: Required<RollbackRetryOptions> = {
  delayInHours: 24,
  maxRetryAttempts: 1,
};

// Test utilities - following CodePushNext pattern
let testConfig: any;
function setUpTestDependencies(
  testSdk?: any,
  providedTestConfig?: any,
  testNativeBridge?: any
) {
  log('setUpTestDependencies called - for testing purposes');
  if (testSdk) {
    AcquisitionSdkRef = testSdk;
  }
  if (providedTestConfig) {
    testConfig = providedTestConfig;
  }
  if (testNativeBridge) {
    // Replace native bridge for testing - you'd implement this
  }
}

// Initialize the getCurrentPackage reference
getCurrentPackageRef = getCurrentPackage;

// Main CodePush interface
interface CodePushStatic {
  (
    options?: CodePushOptions
  ): <P extends {}>(
    component: React.ComponentType<P>
  ) => React.ComponentType<P>;
  <P extends {}>(component: React.ComponentType<P>): React.ComponentType<P>;

  AcquisitionSdk: typeof Sdk;
  checkForUpdate: typeof checkForUpdate;
  getConfiguration: typeof getConfiguration;
  getCurrentPackage: typeof getCurrentPackage;
  getUpdateMetadata: typeof getUpdateMetadata;
  log: typeof log;
  notifyAppReady: typeof notifyApplicationReady;
  notifyApplicationReady: typeof notifyApplicationReady;
  restartApp: typeof restartApp;
  setUpTestDependencies: typeof setUpTestDependencies;
  sync: typeof sync;
  disallowRestart: () => Promise<void>;
  allowRestart: () => Promise<void>;
  clearUpdates: () => Promise<void>;

  InstallMode: typeof InstallMode;
  SyncStatus: typeof SyncStatus;
  CheckFrequency: typeof CheckFrequency;
  UpdateState: typeof UpdateState;

  DeploymentStatus: {
    FAILED: string;
    SUCCEEDED: string;
  };

  DEFAULT_UPDATE_DIALOG: Required<UpdateDialogOptions>;
  DEFAULT_ROLLBACK_RETRY_OPTIONS: Required<RollbackRetryOptions>;
}

// Main CodePush object
let CodePush: CodePushStatic;

if (NativeCodePush) {
  const codePushBase = codePushify as any;

  // Attach all methods and constants to CodePush - following CodePushNext pattern
  Object.assign(codePushBase, {
    AcquisitionSdk: AcquisitionSdkRef,
    checkForUpdate,
    getConfiguration,
    getCurrentPackage,
    getUpdateMetadata,
    log,
    notifyAppReady: notifyApplicationReady,
    notifyApplicationReady,
    restartApp,
    setUpTestDependencies,
    sync,
    disallowRestart: async () => await NativeCodePush.disallowRestart(),
    allowRestart: async () => await NativeCodePush.allowRestart(),
    clearUpdates: async () => await NativeCodePush.clearUpdates(),

    InstallMode,
    SyncStatus,
    CheckFrequency,
    UpdateState,

    DeploymentStatus: {
      FAILED: 'DeploymentFailed',
      SUCCEEDED: 'DeploymentSucceeded',
    },

    DEFAULT_UPDATE_DIALOG,
    DEFAULT_ROLLBACK_RETRY_OPTIONS,
  });

  CodePush = codePushBase;
} else {
  log(
    "The CodePush module doesn't appear to be properly installed. Please double-check that everything is setup correctly."
  );
  CodePush = null as any;
}

export default CodePush;
export * from './types';
