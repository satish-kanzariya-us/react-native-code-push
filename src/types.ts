// src/types.ts
export interface CodePushConfiguration {
  serverUrl: string;
  deploymentKey: string;
  clientUniqueId: string;
  appVersion: string;
  packageHash?: string;
}

export interface LocalPackage {
  appVersion: string;
  description: string;
  failedInstall: boolean;
  failedUpdate: boolean;
  isFirstRun: boolean;
  isPending: boolean;
  label: string;
  packageHash: string;
  packageSize: number;
  install(
    installMode?: InstallMode,
    minimumBackgroundDuration?: number,
    updateInstalledCallback?: () => void
  ): Promise<void>;
  isMandatory?: boolean;
  _isDebugOnly?: boolean;
}

export interface RemotePackage {
  updateAvailable: boolean;
  appVersion: string;
  description?: string;
  label?: string;
  packageHash?: string;
  downloadUrl?: string;
  isMandatory?: boolean;
  packageSize?: number;
  deploymentKey?: string;
  failedInstall?: boolean;
  download(
    downloadProgressCallback?: (progress: DownloadProgress) => void
  ): Promise<LocalPackage>;
  isPending: boolean;
  updateAppVersion?: boolean;
  _isDebugOnly?: boolean;
}

export interface DownloadProgress {
  totalBytes: number;
  receivedBytes: number;
}

export interface UpdateDialogOptions {
  appendReleaseDescription?: boolean;
  descriptionPrefix?: string;
  mandatoryContinueButtonLabel?: string;
  mandatoryUpdateMessage?: string;
  optionalIgnoreButtonLabel?: string;
  optionalInstallButtonLabel?: string;
  optionalUpdateMessage?: string;
  title?: string;
}

export interface SyncOptions {
  deploymentKey?: string;
  ignoreFailedUpdates?: boolean;
  rollbackRetryOptions?: RollbackRetryOptions;
  installMode?: InstallMode;
  mandatoryInstallMode?: InstallMode;
  minimumBackgroundDuration?: number;
  updateDialog?: UpdateDialogOptions | boolean;
}

export interface RollbackRetryOptions {
  delayInHours?: number;
  maxRetryAttempts?: number;
}

export interface StatusReport {
  appVersion?: string;
  package?: LocalPackage;
  status?: string;
  previousLabelOrAppVersion?: string;
  previousDeploymentKey?: string;
}

export interface LatestRollbackInfo {
  packageHash: string;
  time: number;
  count: number;
}

export enum InstallMode {
  IMMEDIATE = 0,
  ON_NEXT_RESTART = 1,
  ON_NEXT_RESUME = 2,
  ON_NEXT_SUSPEND = 3,
}

export enum SyncStatus {
  UP_TO_DATE = 0,
  UPDATE_INSTALLED = 1,
  UPDATE_IGNORED = 2,
  UNKNOWN_ERROR = 3,
  SYNC_IN_PROGRESS = 4,
  CHECKING_FOR_UPDATE = 5,
  AWAITING_USER_ACTION = 6,
  DOWNLOADING_PACKAGE = 7,
  INSTALLING_UPDATE = 8,
}

export enum CheckFrequency {
  ON_APP_START = 0,
  ON_APP_RESUME = 1,
  MANUAL = 2,
}

export enum UpdateState {
  RUNNING = 0,
  PENDING = 1,
  LATEST = 2,
}

export type SyncStatusChangeCallback = (syncStatus: SyncStatus) => void;
export type DownloadProgressCallback = (progress: DownloadProgress) => void;
export type HandleBinaryVersionMismatchCallback = (
  update: RemotePackage
) => void;
