// // src/CodePush.ts
// import { Alert, AppState, Platform } from 'react-native';
// import hoistStatics from 'hoist-non-react-statics';

// import NativeCodePush from './NativeReactNativeCodePush';
// import PackageMixins from './package-mixins';
// import { getPromisifiedSdk, AcquisitionSdk as Sdk } from './acquisition-sdk';
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

// // Global reference to allow dynamic overriding during tests
// let AcquisitionSdkRef = Sdk;
// let getCurrentPackageRef: () => Promise<LocalPackage | null>;

// // Configuration management - singleton pattern like CodePushNext
// const getConfiguration = (() => {
//   let config: CodePushConfiguration | undefined;
//   return async function getConfiguration(): Promise<CodePushConfiguration> {
//     if (config) {
//       log('getConfiguration: returning cached config');
//       return config;
//     } else if (testConfig) {
//       log('getConfiguration: returning test config');
//       return testConfig;
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

// // Get current package metadata
// async function getCurrentPackage(): Promise<LocalPackage | null> {
//   log('getCurrentPackage called');
//   return await getUpdateMetadata(UpdateState.LATEST);
// }

// async function getUpdateMetadata(
//   updateState: UpdateState
// ): Promise<LocalPackage | null> {
//   log(`getUpdateMetadata called with state: ${updateState}`);
//   let updateMetadata = await NativeCodePush.getUpdateMetadata(
//     updateState || UpdateState.RUNNING
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

// // Core update checking logic - following CodePushNext pattern exactly
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

//   // Use dynamically overridden getCurrentPackage() during tests - like CodePushNext
//   const localPackage = await getCurrentPackageRef();
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

// // Application ready notification (singleton)
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

//   // Try to get status report like CodePushNext does
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
//     // This would be the equivalent of NativeCodePush.getNewStatusReport() in the original
//     // For now, return null as placeholder - implement this in your native module
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
//     // This would be implemented in your native module like CodePushNext
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

// // All the other functions (shouldUpdateBeIgnored, sync, etc.) remain the same...
// // I'll keep them exactly as they were in your previous implementation

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
//     rollbackRetryOptions = DEFAULT_ROLLBACK_RETRY_OPTIONS;
//   } else {
//     rollbackRetryOptions = {
//       ...DEFAULT_ROLLBACK_RETRY_OPTIONS,
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

// // Restart app functionality
// async function restartApp(
//   onlyIfUpdateIsPending: boolean = false
// ): Promise<void> {
//   log(`restartApp called with onlyIfUpdateIsPending: ${onlyIfUpdateIsPending}`);
//   await NativeCodePush.restartApp(onlyIfUpdateIsPending);
// }

// // Sync functionality with status tracking (keeping your existing implementation)
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
//         ? syncStatusCallbackWithTryCatch(SyncStatus.SYNC_IN_PROGRESS)
//         : log('Sync already in progress.');
//       return Promise.resolve(SyncStatus.SYNC_IN_PROGRESS);
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

// // Internal sync implementation (keeping your existing logic)
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
//     installMode: InstallMode.ON_NEXT_RESTART,
//     mandatoryInstallMode: InstallMode.IMMEDIATE,
//     minimumBackgroundDuration: 0,
//     updateDialog: null,
//     ...options,
//   } as Required<SyncOptions>;

//   const defaultSyncStatusCallback: SyncStatusChangeCallback = (
//     syncStatus: SyncStatus
//   ) => {
//     switch (syncStatus) {
//       case SyncStatus.CHECKING_FOR_UPDATE:
//         log('Checking for update.');
//         break;
//       case SyncStatus.AWAITING_USER_ACTION:
//         log('Awaiting user action.');
//         break;
//       case SyncStatus.DOWNLOADING_PACKAGE:
//         log('Downloading package.');
//         break;
//       case SyncStatus.INSTALLING_UPDATE:
//         log('Installing update.');
//         break;
//       case SyncStatus.UP_TO_DATE:
//         log('App is up to date.');
//         break;
//       case SyncStatus.UPDATE_IGNORED:
//         log('User cancelled the update.');
//         break;
//       case SyncStatus.UPDATE_INSTALLED:
//         if (resolvedInstallMode === InstallMode.ON_NEXT_RESTART) {
//           log('Update is installed and will be run on the next app restart.');
//         } else if (resolvedInstallMode === InstallMode.ON_NEXT_RESUME) {
//           if (syncOptions.minimumBackgroundDuration > 0) {
//             log(
//               `Update is installed and will be run after the app has been in the background for at least ${syncOptions.minimumBackgroundDuration} seconds.`
//             );
//           } else {
//             log(
//               'Update is installed and will be run when the app next resumes.'
//             );
//           }
//         }
//         break;
//       case SyncStatus.UNKNOWN_ERROR:
//         log('An unknown error occurred.');
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
//     await notifyApplicationReady();

//     syncStatusChangeCallback(SyncStatus.CHECKING_FOR_UPDATE);
//     const remotePackage = await checkForUpdate(
//       syncOptions.deploymentKey,
//       handleBinaryVersionMismatchCallback
//     );

//     const doDownloadAndInstall = async (): Promise<SyncStatus> => {
//       syncStatusChangeCallback!(SyncStatus.DOWNLOADING_PACKAGE);
//       const localPackage = await remotePackage!.download(
//         downloadProgressCallback
//       );

//       // Determine the correct install mode based on whether the update is mandatory or not.
//       resolvedInstallMode = localPackage.isMandatory
//         ? syncOptions.mandatoryInstallMode
//         : syncOptions.installMode;

//       syncStatusChangeCallback!(SyncStatus.INSTALLING_UPDATE);
//       await localPackage.install(
//         resolvedInstallMode,
//         syncOptions.minimumBackgroundDuration,
//         () => {
//           syncStatusChangeCallback!(SyncStatus.UPDATE_INSTALLED);
//         }
//       );

//       return SyncStatus.UPDATE_INSTALLED;
//     };

//     const updateShouldBeIgnored = await shouldUpdateBeIgnored(
//       remotePackage!,
//       syncOptions
//     );

//     if (!remotePackage || updateShouldBeIgnored) {
//       if (updateShouldBeIgnored) {
//         log(
//           'An update is available, but it is being ignored due to having been previously rolled back.'
//         );
//       }

//       const currentPackage = await getCurrentPackage();
//       if (currentPackage && currentPackage.isPending) {
//         syncStatusChangeCallback(SyncStatus.UPDATE_INSTALLED);
//         return SyncStatus.UPDATE_INSTALLED;
//       } else {
//         syncStatusChangeCallback(SyncStatus.UP_TO_DATE);
//         return SyncStatus.UP_TO_DATE;
//       }
//     } else if (syncOptions.updateDialog) {
//       // updateDialog supports any truthy value (e.g. true, "goo", 12),
//       // but we should treat a non-object value as just the default dialog
//       let dialogOptions: UpdateDialogOptions;

//       if (typeof syncOptions.updateDialog !== 'object') {
//         dialogOptions = DEFAULT_UPDATE_DIALOG;
//       } else {
//         dialogOptions = {
//           ...DEFAULT_UPDATE_DIALOG,
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

//           // Since this is an optional update, add a button
//           // to allow the end-user to ignore it
//           dialogButtons.push({
//             text: dialogOptions.optionalIgnoreButtonLabel!,
//             onPress: () => {
//               syncStatusChangeCallback!(SyncStatus.UPDATE_IGNORED);
//               resolve(SyncStatus.UPDATE_IGNORED);
//             },
//           });
//         }

//         // Since the install button should be placed to the
//         // right of any other button, add it last
//         dialogButtons.push({
//           text: installButtonText,
//           onPress: () => {
//             doDownloadAndInstall().then(resolve, reject);
//           },
//         });

//         // If the update has a description, and the developer
//         // explicitly chose to display it, then set that as the message
//         if (
//           dialogOptions.appendReleaseDescription &&
//           remotePackage.description
//         ) {
//           message += `${dialogOptions.descriptionPrefix} ${remotePackage.description}`;
//         }

//         syncStatusChangeCallback!(SyncStatus.AWAITING_USER_ACTION);
//         Alert.alert(dialogOptions.title!, message, dialogButtons);
//       });
//     } else {
//       return await doDownloadAndInstall();
//     }
//   } catch (error: any) {
//     syncStatusChangeCallback!(SyncStatus.UNKNOWN_ERROR);
//     log(error.message);
//     throw error;
//   }
// }

// // Higher-Order Component implementation (keeping your existing logic)
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

// // Combined overload signatures with single implementation
// function codePushify<P extends {}>(
//   RootComponent: React.ComponentType<P>
// ): React.ComponentType<P>;
// function codePushify<P extends {}>(
//   options?: CodePushOptions
// ): <T extends React.ComponentType<P>>(
//   RootComponent: T
// ) => React.ComponentType<P>;
// function codePushify<P extends {}>(
//   optionsOrComponent?: CodePushOptions | React.ComponentType<P>
// ): any {
//   if (typeof optionsOrComponent === 'function') {
//     // Direct component passed - use default options
//     const RootComponent = optionsOrComponent;
//     return createCodePushComponent({}, RootComponent);
//   } else {
//     // Options passed - return decorator function
//     const options = optionsOrComponent || {};
//     return <T extends React.ComponentType<P>>(RootComponent: T) => {
//       return createCodePushComponent(options, RootComponent);
//     };
//   }

//   // Helper function to create the actual CodePush component
//   function createCodePushComponent<T extends React.ComponentType<P>>(
//     options: CodePushOptions,
//     RootComponent: T
//   ) {
//     class CodePushComponent extends React.Component<P> {
//       private rootComponentRef = React.createRef<ComponentWithCodePush>();

//       componentDidMount() {
//         if (options.checkFrequency === CheckFrequency.MANUAL) {
//           notifyApplicationReady();
//         } else {
//           const rootComponentInstance = this.rootComponentRef.current;

//           let syncStatusCallback: SyncStatusChangeCallback | undefined;
//           if (
//             rootComponentInstance &&
//             rootComponentInstance.codePushStatusDidChange
//           ) {
//             syncStatusCallback =
//               rootComponentInstance.codePushStatusDidChange.bind(
//                 rootComponentInstance
//               );
//           }

//           let downloadProgressCallback: DownloadProgressCallback | undefined;
//           if (
//             rootComponentInstance &&
//             rootComponentInstance.codePushDownloadDidProgress
//           ) {
//             downloadProgressCallback =
//               rootComponentInstance.codePushDownloadDidProgress.bind(
//                 rootComponentInstance
//               );
//           }

//           let handleBinaryVersionMismatchCallback:
//             | HandleBinaryVersionMismatchCallback
//             | undefined;
//           if (
//             rootComponentInstance &&
//             rootComponentInstance.codePushOnBinaryVersionMismatch
//           ) {
//             handleBinaryVersionMismatchCallback =
//               rootComponentInstance.codePushOnBinaryVersionMismatch.bind(
//                 rootComponentInstance
//               );
//           }

//           sync(
//             options,
//             syncStatusCallback,
//             downloadProgressCallback,
//             handleBinaryVersionMismatchCallback
//           );

//           if (options.checkFrequency === CheckFrequency.ON_APP_RESUME) {
//             AppState.addEventListener('change', (newState) => {
//               if (newState === 'active') {
//                 sync(options, syncStatusCallback, downloadProgressCallback);
//               }
//             });
//           }
//         }
//       }

//       render() {
//         const props = { ...this.props } as P;

//         // We can set ref property on class components only (not stateless)
//         // Check it by render method
//         if (
//           (RootComponent as any).prototype &&
//           (RootComponent as any).prototype.render
//         ) {
//           (props as any).ref = this.rootComponentRef;
//         }

//         return React.createElement(RootComponent, props);
//       }
//     }

//     return hoistStatics(
//       CodePushComponent,
//       RootComponent as React.ComponentClass<P>
//     );
//   }
// }

// // Constants
// const DEFAULT_UPDATE_DIALOG: Required<UpdateDialogOptions> = {
//   appendReleaseDescription: false,
//   descriptionPrefix: ' Description: ',
//   mandatoryContinueButtonLabel: 'Continue',
//   mandatoryUpdateMessage: 'An update is available that must be installed.',
//   optionalIgnoreButtonLabel: 'Ignore',
//   optionalInstallButtonLabel: 'Install',
//   optionalUpdateMessage:
//     'An update is available. Would you like to install it?',
//   title: 'Update available',
// };

// const DEFAULT_ROLLBACK_RETRY_OPTIONS: Required<RollbackRetryOptions> = {
//   delayInHours: 24,
//   maxRetryAttempts: 1,
// };

// // Test utilities - following CodePushNext pattern
// let testConfig: any;
// function setUpTestDependencies(
//   testSdk?: any,
//   providedTestConfig?: any,
//   testNativeBridge?: any
// ) {
//   log('setUpTestDependencies called - for testing purposes');
//   if (testSdk) {
//     AcquisitionSdkRef = testSdk;
//   }
//   if (providedTestConfig) {
//     testConfig = providedTestConfig;
//   }
//   if (testNativeBridge) {
//     // Replace native bridge for testing - you'd implement this
//   }
// }

// // Initialize the getCurrentPackage reference
// getCurrentPackageRef = getCurrentPackage;

// // Main CodePush interface
// interface CodePushStatic {
//   (
//     options?: CodePushOptions
//   ): <P extends {}>(
//     component: React.ComponentType<P>
//   ) => React.ComponentType<P>;
//   <P extends {}>(component: React.ComponentType<P>): React.ComponentType<P>;

//   AcquisitionSdk: typeof Sdk;
//   checkForUpdate: typeof checkForUpdate;
//   getConfiguration: typeof getConfiguration;
//   getCurrentPackage: typeof getCurrentPackage;
//   getUpdateMetadata: typeof getUpdateMetadata;
//   log: typeof log;
//   notifyAppReady: typeof notifyApplicationReady;
//   notifyApplicationReady: typeof notifyApplicationReady;
//   restartApp: typeof restartApp;
//   setUpTestDependencies: typeof setUpTestDependencies;
//   sync: typeof sync;
//   disallowRestart: () => Promise<void>;
//   allowRestart: () => Promise<void>;
//   clearUpdates: () => Promise<void>;

//   InstallMode: typeof InstallMode;
//   SyncStatus: typeof SyncStatus;
//   CheckFrequency: typeof CheckFrequency;
//   UpdateState: typeof UpdateState;

//   DeploymentStatus: {
//     FAILED: string;
//     SUCCEEDED: string;
//   };

//   DEFAULT_UPDATE_DIALOG: Required<UpdateDialogOptions>;
//   DEFAULT_ROLLBACK_RETRY_OPTIONS: Required<RollbackRetryOptions>;
// }

// // Main CodePush object
// let CodePush: CodePushStatic;

// if (NativeCodePush) {
//   const codePushBase = codePushify as any;

//   // Attach all methods and constants to CodePush - following CodePushNext pattern
//   Object.assign(codePushBase, {
//     AcquisitionSdk: AcquisitionSdkRef,
//     checkForUpdate,
//     getConfiguration,
//     getCurrentPackage,
//     getUpdateMetadata,
//     log,
//     notifyAppReady: notifyApplicationReady,
//     notifyApplicationReady,
//     restartApp,
//     setUpTestDependencies,
//     sync,
//     disallowRestart: async () => await NativeCodePush.disallowRestart(),
//     allowRestart: async () => await NativeCodePush.allowRestart(),
//     clearUpdates: async () => await NativeCodePush.clearUpdates(),

//     InstallMode,
//     SyncStatus,
//     CheckFrequency,
//     UpdateState,

//     DeploymentStatus: {
//       FAILED: 'DeploymentFailed',
//       SUCCEEDED: 'DeploymentSucceeded',
//     },

//     DEFAULT_UPDATE_DIALOG,
//     DEFAULT_ROLLBACK_RETRY_OPTIONS,
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

// src/codepush.ts

import React from 'react';
import {
  Alert,
  AppState,
  AppStateStatus,
  NativeEventEmitter,
  Platform,
} from 'react-native';

import NativeCodePush from './NativeReactNativeCodePush';
import { getPromisifiedSdk } from './acquisition-sdk';
import requestFetchAdapter from './request-fetch-adapter';
import PackageMixins from './package-mixins';
import log from './logging';

import {
  type CodePushConfiguration,
  type LocalPackage,
  type RemotePackage,
  type SyncOptions,
  type UpdateDialogOptions,
  type SyncStatusChangeCallback,
  type DownloadProgressCallback,
  type HandleBinaryVersionMismatchCallback,
  type DownloadProgress,
  SyncStatus,
  InstallMode,
  CheckFrequency,
  UpdateState,
} from './types';

// Constants
const DEFAULT_UPDATE_DIALOG: Required<UpdateDialogOptions> = {
  appendReleaseDescription: false,
  descriptionPrefix: 'Description: ',
  mandatoryContinueButtonLabel: 'Continue',
  mandatoryUpdateMessage: 'An update is available that must be installed.',
  optionalIgnoreButtonLabel: 'Ignore',
  optionalInstallButtonLabel: 'Install',
  optionalUpdateMessage:
    'An update is available. Would you like to install it?',
  title: 'Update available',
};

// Global state
let isRunningBinaryVersion = false;
let hasShownUpdateDialogToUser = false;
let syncInProgress = false;

// Event emitter for download progress
const codePushEventEmitter = new NativeEventEmitter(NativeCodePush);

// ============ CORE METHODS ============

async function getConfiguration(): Promise<CodePushConfiguration> {
  log('getConfiguration() called');
  try {
    const config = await NativeCodePush.getConfiguration();
    log(`getConfiguration() result: ${JSON.stringify(config)}`);
    return config;
  } catch (error) {
    log(`getConfiguration() error: ${error}`);
    throw error;
  }
}

async function getCurrentPackage(): Promise<LocalPackage | null> {
  log('getCurrentPackage() called');
  try {
    const currentPackage = await NativeCodePush.getCurrentPackage();
    log(`getCurrentPackage() result: ${JSON.stringify(currentPackage)}`);

    if (currentPackage) {
      // Add package mixins
      return Object.assign(currentPackage, PackageMixins.local);
    }
    return null;
  } catch (error) {
    log(`getCurrentPackage() error: ${error}`);
    throw error;
  }
}

async function getUpdateMetadata(
  updateState: UpdateState = UpdateState.RUNNING
): Promise<LocalPackage | null> {
  log(`getUpdateMetadata() called with updateState: ${updateState}`);
  try {
    const updateMetadata = await NativeCodePush.getUpdateMetadata(updateState);
    log(`getUpdateMetadata() result: ${JSON.stringify(updateMetadata)}`);

    if (updateMetadata) {
      return Object.assign(updateMetadata, PackageMixins.local);
    }
    return null;
  } catch (error) {
    log(`getUpdateMetadata() error: ${error}`);
    throw error;
  }
}

async function checkForUpdate(
  deploymentKey?: string
): Promise<RemotePackage | null> {
  log(
    `checkForUpdate() called with deploymentKey: ${deploymentKey?.substring(0, 10)}...`
  );

  try {
    const config = await getConfiguration();
    const currentPackage = await getCurrentPackage();

    // Use provided deployment key or default from config
    const activeDeploymentKey = deploymentKey || config.deploymentKey;
    if (!activeDeploymentKey) {
      throw new Error(
        'No deployment key provided and none found in configuration'
      );
    }

    // Setup acquisition SDK
    const sdk = getPromisifiedSdk(requestFetchAdapter, {
      ...config,
      deploymentKey: activeDeploymentKey,
    });

    // Prepare query package
    const queryPackage = {
      appVersion: config.appVersion,
      packageHash: currentPackage?.packageHash || null,
      isCompanion: false,
      label: currentPackage?.label || null,
      clientUniqueId: config.clientUniqueId,
    };

    log(`checkForUpdate() querying with: ${JSON.stringify(queryPackage)}`);

    // Query for updates
    const update = await sdk.queryUpdateWithCurrentPackage(queryPackage);
    log(`checkForUpdate() server response: ${JSON.stringify(update)}`);

    if (!update || update.updateAppVersion) {
      // No update available or binary update required
      log('checkForUpdate() no update available');
      return null;
    }

    if (update.packageHash === currentPackage?.packageHash) {
      // Same package hash means no update
      log('checkForUpdate() same package hash, no update');
      return null;
    }

    // Create remote package with mixins
    const remotePackage: RemotePackage = {
      updateAvailable: true,
      appVersion: update.appVersion,
      description: update.description,
      label: update.label,
      packageHash: update.packageHash,
      downloadUrl: update.downloadUrl,
      isMandatory: update.isMandatory,
      packageSize: update.packageSize,
      deploymentKey: activeDeploymentKey,
      isPending: false,
      ...PackageMixins.remote(async (pkg) => {
        // Report download status
        return sdk.reportStatusDownload(pkg);
      }),
    };

    log(
      `checkForUpdate() returning remote package: ${JSON.stringify(remotePackage)}`
    );
    return remotePackage;
  } catch (error) {
    log(`checkForUpdate() error: ${error}`);
    throw error;
  }
}

async function sync(
  options: SyncOptions = {},
  syncStatusChangeCallback?: SyncStatusChangeCallback,
  downloadProgressCallback?: DownloadProgressCallback,
  handleBinaryVersionMismatchCallback?: HandleBinaryVersionMismatchCallback
): Promise<SyncStatus> {
  log(`sync() called with options: ${JSON.stringify(options)}`);

  if (syncInProgress) {
    log('sync() already in progress, returning');
    return SyncStatus.SYNC_IN_PROGRESS;
  }

  syncInProgress = true;

  try {
    // Notify sync started
    syncStatusChangeCallback?.(SyncStatus.CHECKING_FOR_UPDATE);

    // Check for updates
    const remotePackage = await checkForUpdate(options.deploymentKey);

    if (!remotePackage) {
      // No update available
      log('sync() no update available');
      syncStatusChangeCallback?.(SyncStatus.UP_TO_DATE);
      return SyncStatus.UP_TO_DATE;
    }

    log(`sync() update available: ${JSON.stringify(remotePackage)}`);

    // Handle update dialog
    const shouldInstall = await showUpdateDialog(
      remotePackage,
      options.updateDialog
    );
    if (!shouldInstall) {
      log('sync() user ignored update');
      syncStatusChangeCallback?.(SyncStatus.UPDATE_IGNORED);
      return SyncStatus.UPDATE_IGNORED;
    }

    // Download update
    syncStatusChangeCallback?.(SyncStatus.DOWNLOADING_PACKAGE);
    log('sync() downloading update...');

    const localPackage = await remotePackage.download(downloadProgressCallback);
    log(`sync() download completed: ${JSON.stringify(localPackage)}`);

    // Install update
    syncStatusChangeCallback?.(SyncStatus.INSTALLING_UPDATE);
    log('sync() installing update...');

    const installMode = remotePackage.isMandatory
      ? options.mandatoryInstallMode || InstallMode.IMMEDIATE
      : options.installMode || InstallMode.ON_NEXT_RESTART;

    await localPackage.install(
      installMode,
      options.minimumBackgroundDuration || 0,
      () => {
        log('sync() update installed callback');
      }
    );

    log('sync() update installed successfully');
    syncStatusChangeCallback?.(SyncStatus.UPDATE_INSTALLED);
    return SyncStatus.UPDATE_INSTALLED;
  } catch (error) {
    log(`sync() error: ${error}`);
    syncStatusChangeCallback?.(SyncStatus.UNKNOWN_ERROR);
    return SyncStatus.UNKNOWN_ERROR;
  } finally {
    syncInProgress = false;
  }
}

// ============ UPDATE DIALOG ============

async function showUpdateDialog(
  remotePackage: RemotePackage,
  updateDialogOptions?: UpdateDialogOptions | boolean
): Promise<boolean> {
  log(
    `showUpdateDialog() called with options: ${JSON.stringify(updateDialogOptions)}`
  );

  // If explicitly disabled, don't show dialog
  if (updateDialogOptions === false) {
    log('showUpdateDialog() disabled by options');
    return true; // Auto-install
  }

  // If mandatory update, don't show dialog (auto-install)
  if (remotePackage.isMandatory) {
    log('showUpdateDialog() mandatory update, auto-installing');
    return true;
  }

  // If no dialog options provided, use defaults
  if (updateDialogOptions === true || !updateDialogOptions) {
    updateDialogOptions = DEFAULT_UPDATE_DIALOG;
  }

  const dialogOptions = { ...DEFAULT_UPDATE_DIALOG, ...updateDialogOptions };

  // Build dialog message
  let message = remotePackage.isMandatory
    ? dialogOptions.mandatoryUpdateMessage
    : dialogOptions.optionalUpdateMessage;

  if (dialogOptions.appendReleaseDescription && remotePackage.description) {
    message += `\n\n${dialogOptions.descriptionPrefix}${remotePackage.description}`;
  }

  // Show platform-appropriate dialog
  return new Promise((resolve) => {
    if (remotePackage.isMandatory) {
      // Mandatory update - only one button
      Alert.alert(
        dialogOptions.title,
        message,
        [
          {
            text: dialogOptions.mandatoryContinueButtonLabel,
            onPress: () => resolve(true),
          },
        ],
        { cancelable: false }
      );
    } else {
      // Optional update - two buttons
      Alert.alert(
        dialogOptions.title,
        message,
        [
          {
            text: dialogOptions.optionalIgnoreButtonLabel,
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: dialogOptions.optionalInstallButtonLabel,
            onPress: () => resolve(true),
          },
        ],
        { cancelable: false }
      );
    }
  });
}

// ============ RESTART & LIFECYCLE ============

async function restartApp(
  onlyIfUpdateIsPending: boolean = false
): Promise<void> {
  log(
    `restartApp() called with onlyIfUpdateIsPending: ${onlyIfUpdateIsPending}`
  );
  try {
    await NativeCodePush.restartApp(onlyIfUpdateIsPending);
    log('restartApp() completed');
  } catch (error) {
    log(`restartApp() error: ${error}`);
    throw error;
  }
}

async function notifyApplicationReady(): Promise<void> {
  log('notifyApplicationReady() called');
  try {
    await NativeCodePush.notifyApplicationReady();
    log('notifyApplicationReady() completed');
  } catch (error) {
    log(`notifyApplicationReady() error: ${error}`);
    throw error;
  }
}

async function allowRestart(): Promise<void> {
  log('allowRestart() called');
  try {
    await NativeCodePush.allowRestart();
    log('allowRestart() completed');
  } catch (error) {
    log(`allowRestart() error: ${error}`);
    throw error;
  }
}

async function disallowRestart(): Promise<void> {
  log('disallowRestart() called');
  try {
    await NativeCodePush.disallowRestart();
    log('disallowRestart() completed');
  } catch (error) {
    log(`disallowRestart() error: ${error}`);
    throw error;
  }
}

// ============ DECORATOR & COMPONENT ============

interface CodePushOptions {
  checkFrequency?: CheckFrequency;
  installMode?: InstallMode;
  mandatoryInstallMode?: InstallMode;
  minimumBackgroundDuration?: number;
  deploymentKey?: string;
  updateDialog?: UpdateDialogOptions | boolean;
}

function createCodePushComponent<P extends object>(
  options: CodePushOptions,
  WrappedComponent: React.ComponentType<P>
): React.ComponentType<P> {
  return class CodePushComponent extends React.Component<P> {
    private appStateSubscription?: any;

    async componentDidMount() {
      log('CodePushComponent mounted');

      // Notify app ready
      await notifyApplicationReady();

      // Setup automatic sync based on check frequency
      if (options.checkFrequency !== CheckFrequency.MANUAL) {
        if (options.checkFrequency === CheckFrequency.ON_APP_START) {
          this.syncUpdate();
        } else if (options.checkFrequency === CheckFrequency.ON_APP_RESUME) {
          this.appStateSubscription = AppState.addEventListener(
            'change',
            this.handleAppStateChange
          );
        }
      }
    }

    componentWillUnmount() {
      log('CodePushComponent unmounting');
      this.appStateSubscription?.remove();
    }

    handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        this.syncUpdate();
      }
    };

    syncUpdate = () => {
      sync(options).catch((error) => {
        log(`Automatic sync failed: ${error}`);
      });
    };

    render() {
      return React.createElement(WrappedComponent, this.props);
    }
  };
}

// ============ OVERLOADED FUNCTIONS ============

function codePushify<P extends object>(
  RootComponent: React.ComponentType<P>
): React.ComponentType<P>;
function codePushify(
  options?: CodePushOptions
): <P extends object>(
  component: React.ComponentType<P>
) => React.ComponentType<P>;
function codePushify<P extends object>(
  optionsOrComponent?: CodePushOptions | React.ComponentType<P>
): any {
  if (typeof optionsOrComponent === 'function') {
    // Direct component passed - use default options
    const RootComponent = optionsOrComponent;
    return createCodePushComponent({}, RootComponent);
  } else {
    // Options passed - return decorator function
    const options = optionsOrComponent || {};
    return <P extends object>(RootComponent: React.ComponentType<P>) => {
      return createCodePushComponent(options, RootComponent);
    };
  }
}

// ============ TEST SETUP ============

function setUpTestDependencies(
  testHttpRequester: any,
  testNativeModule: any,
  testStorageProvider: any
): void {
  // For testing purposes - not implemented
  log('setUpTestDependencies() called - not implemented');
}

// ============ MAIN EXPORT ============

interface CodePushStatic {
  (
    options?: CodePushOptions
  ): <P extends object>(
    component: React.ComponentType<P>
  ) => React.ComponentType<P>;
  <P extends object>(component: React.ComponentType<P>): React.ComponentType<P>;

  // Core methods
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
  allowRestart: typeof allowRestart;
  disallowRestart: typeof disallowRestart;

  // Constants
  InstallMode: typeof InstallMode;
  SyncStatus: typeof SyncStatus;
  CheckFrequency: typeof CheckFrequency;
  UpdateState: typeof UpdateState;
}

const CodePush = codePushify as CodePushStatic;

// Attach static methods
CodePush.checkForUpdate = checkForUpdate;
CodePush.getConfiguration = getConfiguration;
CodePush.getCurrentPackage = getCurrentPackage;
CodePush.getUpdateMetadata = getUpdateMetadata;
CodePush.log = log;
CodePush.notifyAppReady = notifyApplicationReady;
CodePush.notifyApplicationReady = notifyApplicationReady;
CodePush.restartApp = restartApp;
CodePush.setUpTestDependencies = setUpTestDependencies;
CodePush.sync = sync;
CodePush.allowRestart = allowRestart;
CodePush.disallowRestart = disallowRestart;

// Attach constants
CodePush.InstallMode = InstallMode;
CodePush.SyncStatus = SyncStatus;
CodePush.CheckFrequency = CheckFrequency;
CodePush.UpdateState = UpdateState;

export default CodePush;
export * from './types';
