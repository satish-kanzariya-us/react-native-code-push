# CodePush Internal Workflow

This document details the internal process of the `react-native-code-push` library when the `codePush.sync()` method is invoked.

## Complete Method Call Flow Tree

Based on your example call:
```javascript
useEffect(() => {
  const options: Partial<SyncOptions> = {
    deploymentKey: Platform.OS === 'ios' ? '2OHjojYOK9zNuY5kG6pSvlH5vIC_EycpnxKc-g' : '5AdYda0SWoAz3XKnxbevogm6j-RZEycpnxKc-g',
    installMode: codePush.InstallMode.IMMEDIATE,
    updateDialog: IS_SILENT ? undefined : {},
  };
  codePush.sync(options, onSyncStatusChange);
}, []);
```

### 📊 Complete Workflow Tree

```
📱 YOUR PROJECT CODE
└── codePush.sync(options, onSyncStatusChange)
    │
    ├── 🔒 CONCURRENCY CONTROL
    │   ├── Check syncInProgress flag
    │   ├── Wrap callbacks in try-catch blocks
    │   └── Set syncInProgress = true
    │
    └── 🎯 syncInternal(options, syncStatusCallbackWithTryCatch, downloadProgressCallbackWithTryCatch, handleBinaryVersionMismatchCallback)
        │
        ├── 📋 INITIALIZATION
        │   ├── Merge options with defaults
        │   ├── Set up default callbacks if not provided
        │   └── Configure sync options (deploymentKey, installMode, etc.)
        │
        ├── 🚀 NOTIFY APPLICATION READY
        │   └── CodePush.notifyApplicationReady()
        │       └── NativeCodePush.notifyApplicationReady() [NATIVE BRIDGE]
        │
        ├── 🔍 CHECK FOR UPDATE
        │   └── checkForUpdate(syncOptions.deploymentKey, handleBinaryVersionMismatchCallback)
        │       │
        │       ├── 📱 GET NATIVE CONFIGURATION
        │       │   └── getConfiguration()
        │       │       └── NativeCodePush.getConfiguration() [NATIVE BRIDGE]
        │       │           └── Returns: { appVersion, clientUniqueId, deploymentKey, serverUrl, packageHash }
        │       │
        │       ├── 🌐 CREATE SDK INSTANCE
        │       │   └── getPromisifiedSdk(requestFetchAdapter, config)
        │       │       └── Creates acquisition SDK with server communication
        │       │
        │       ├── 📦 GET CURRENT PACKAGE
        │       │   └── module.exports.getCurrentPackage()
        │       │       └── NativeCodePush.getUpdateMetadata() [NATIVE BRIDGE]
        │       │
        │       ├── 🔎 QUERY SERVER FOR UPDATE
        │       │   └── sdk.queryUpdateWithCurrentPackage(queryPackage)
        │       │       └── HTTP request to CodePush server
        │       │
        │       ├── ✅ VALIDATE UPDATE RESPONSE
        │       │   ├── Check if update exists
        │       │   ├── Check binary version compatibility
        │       │   ├── Check if hash differs from current
        │       │   └── Handle binary version mismatch callback
        │       │
        │       └── 📋 CREATE REMOTE PACKAGE
        │           ├── Merge update with PackageMixins.remote(sdk.reportStatusDownload)
        │           ├── Check if failed install: NativeCodePush.isFailedUpdate() [NATIVE BRIDGE]
        │           └── Set deploymentKey
        │
        ├── 🚫 CHECK IF UPDATE SHOULD BE IGNORED
        │   └── shouldUpdateBeIgnored(remotePackage, syncOptions)
        │       │
        │       ├── Check if failed package and ignoreFailedUpdates is true
        │       ├── Validate rollback retry options
        │       ├── Get latest rollback info: NativeCodePush.getLatestRollbackInfo() [NATIVE BRIDGE]
        │       ├── Calculate time since last rollback
        │       └── Determine if retry is allowed based on delayInHours and maxRetryAttempts
        │
        ├── 🔄 DECISION POINT
        │   │
        │   ├── ❌ NO UPDATE OR IGNORED
        │   │   ├── Check current package: CodePush.getCurrentPackage()
        │   │   ├── If pending: return UPDATE_INSTALLED
        │   │   └── Else: return UP_TO_DATE
        │   │
        │   ├── 💬 UPDATE DIALOG (if updateDialog option enabled)
        │   │   ├── Configure dialog options (mandatory vs optional)
        │   │   ├── Show native alert dialog
        │   │   ├── Handle user response (Install/Later/Ignore)
        │   │   └── Proceed based on user choice
        │   │
        │   └── ⬇️ DOWNLOAD AND INSTALL
        │       └── doDownloadAndInstall()
        │           │
        │           ├── 📥 DOWNLOAD PHASE
        │           │   └── remotePackage.download(downloadProgressCallback)
        │           │       │   [FROM PackageMixins.remote]
        │           │       │
        │           │       ├── Validate downloadUrl exists
        │           │       ├── Set up progress event listener
        │           │       │   └── NativeEventEmitter(NativeCodePush)
        │           │       │       └── Listen to "CodePushDownloadProgress"
        │           │       ├── Prepare update package copy
        │           │       ├── Download update: NativeCodePush.downloadUpdate() [NATIVE BRIDGE]
        │           │       │   └── Native download, unzip, and validation
        │           │       ├── Report download status (if enabled)
        │           │       │   └── sdk.reportStatusDownload()
        │           │       └── Return localPackage with PackageMixins.local
        │           │
        │           ├── 🎯 DETERMINE INSTALL MODE
        │           │   ├── Check if update is mandatory
        │           │   ├── Use mandatoryInstallMode if mandatory
        │           │   └── Use regular installMode if optional
        │           │
        │           └── 💾 INSTALL PHASE
        │               └── localPackage.install(resolvedInstallMode, minimumBackgroundDuration, callback)
        │                   │   [FROM PackageMixins.local]
        │                   │
        │                   ├── Prepare local package copy
        │                   ├── Install update: NativeCodePush.installUpdate() [NATIVE BRIDGE]
        │                   │   └── Native file operations and metadata updates
        │                   ├── Execute updateInstalledCallback
        │                   ├── Handle install mode:
        │                   │   ├── IMMEDIATE: NativeCodePush.restartApp(false) [NATIVE BRIDGE]
        │                   │   └── ON_NEXT_RESTART/ON_NEXT_RESUME: 
        │                   │       ├── NativeCodePush.clearPendingRestart() [NATIVE BRIDGE]
        │                   │       └── Mark localPackage.isPending = true
        │                   └── Return UPDATE_INSTALLED status
        │
        └── 🏁 CLEANUP
            ├── Set syncInProgress = false
            └── Return final sync status
```

### 🔧 Native Bridge Methods Called

The following native methods are called during the sync process:

#### Android (`CodePushNativeModule.java`)
- `notifyApplicationReady()`
- `getConfiguration()` → Returns app config
- `getUpdateMetadata()` → Gets current package info
- `isFailedUpdate(packageHash)` → Checks if update previously failed
- `getLatestRollbackInfo()` → Gets rollback retry information
- `downloadUpdate(updatePackage, hasProgressCallback)` → Downloads and validates update
- `installUpdate(updatePackage, installMode, minimumBackgroundDuration)` → Installs update
- `restartApp(onlyIfUpdateIsPending)` → Restarts app (IMMEDIATE mode)
- `clearPendingRestart()` → Clears pending restart flag

#### iOS (`CodePush.m`)
- Similar native methods with iOS-specific implementations
- Uses NSUserDefaults for persistence
- Handles iOS-specific bundle loading and app lifecycle

### 📋 Key Supporting Functions

#### Configuration & SDK
- `getConfiguration()` - Cached native config retrieval
- `getPromisifiedSdk()` - Creates acquisition SDK instance
- `PackageMixins.remote()` - Adds download functionality to remote packages
- `PackageMixins.local()` - Adds install functionality to local packages

#### Status & Validation
- `shouldUpdateBeIgnored()` - Rollback retry logic
- `validateRollbackRetryOptions()` - Validates retry configuration
- `validateLatestRollbackInfo()` - Validates rollback metadata

#### Utility Functions
- `log()` - Logging utility
- `tryReportStatus()` - Status reporting to server
- Various native utility methods for file operations

## 1. The `sync()` Method: Your Entry Point

The journey begins with a call to `codePush.sync(options, onSyncStatusChange)`. This function serves as a wrapper around the core synchronization logic, ensuring that only one sync operation can run at any given time.

- **Concurrency Control**: A `syncInProgress` flag prevents parallel executions. If a sync is already running, it immediately returns with a `SYNC_IN_PROGRESS` status.
- **Callback Safety**: It wraps your `onSyncStatusChange` and `onDownloadProgress` callbacks in `try...catch` blocks to prevent app crashes from errors within your callback code.
- **Initiating the Process**: The `sync` function calls the internal `syncInternal` function to begin the actual update process.

## 2. `syncInternal()`: The Core Logic

This asynchronous function orchestrates the entire update workflow. Here’s a step-by-step breakdown:

### Step 2.1: Initialization

- **Options Merging**: It merges the `options` you provided with a set of default values for settings like `installMode`, `deploymentKey`, and `updateDialog`.
- **Notifying Native Code**: It calls `CodePush.notifyApplicationReady()` to signal to the native side (iOS/Android) that the JavaScript bundle has loaded and the app is ready. This is crucial for the native code to know when it's safe to apply a pending update.

### Step 2.2: Checking for an Update

- **`checkForUpdate()`**: The function calls `checkForUpdate(deploymentKey)`, which makes a network request to the CodePush server.
- **Server Response**: The server checks the deployment key and the current app version to see if a newer bundle is available. If so, it returns metadata about the remote package (e.g., `label`, `packageHash`, `isMandatory`).

### Step 2.3: Deciding What to Do

- **`shouldUpdateBeIgnored()`**: Before proceeding, it checks if the returned update should be ignored. This happens if the update has previously been installed and resulted in a rollback.
- **No Update or Ignored**: If there's no update or it's ignored, the process finishes with an `UP_TO_DATE` status.
- **Update Available**: If a new update is available, the flow continues.

### Step 2.4: The Update Dialog (Optional)

- If the `updateDialog` option is enabled, a native alert is displayed to the user.
- **Mandatory Update**: The dialog will have a single button to continue.
- **Optional Update**: The dialog will offer options to either install or ignore the update.

### Step 2.5: Downloading the Update

- **`remotePackage.download()`**: If the user agrees to install (or if the sync is silent), this function is called.
- **Progress Callback**: As the bundle is downloaded, the `onDownloadProgress` callback is fired with the download progress.
- **Returns `localPackage`**: Once complete, it returns a `localPackage` object, which represents the downloaded and unzipped update files stored on the device.

### Step 2.6: Installing the Update

- **`localPackage.install()`**: This is the final step.
- **Install Mode**: The `installMode` (e.g., `IMMEDIATE`, `ON_NEXT_RESTART`) determines when the update is applied.
- **Writing Files**: The `install` method writes the new bundle and assets to a specific location on the device's storage.
- **Informing Native Code**: It then notifies the native CodePush plugin that a new version is ready and waiting to be loaded.
- **`UPDATE_INSTALLED`**: The `onSyncStatusChange` callback is called with the `UPDATE_INSTALLED` status.

## 3. Applying the Update

The installation itself doesn't immediately run the new code. The new JavaScript bundle is loaded based on the `installMode`:

- **`IMMEDIATE`**: The native plugin is instructed to reload the app's JavaScript bundle right away. This causes the app to restart from the user's perspective.
- **`ON_NEXT_RESTART`**: The update will be applied the next time the app is fully restarted by the user or the OS.
- **`ON_NEXT_RESUME`**: The update is applied the next time the app is brought from the background to the foreground.

## 4. Troubleshooting

Here are some common issues and how to debug them:

- **Update Not Appearing**: 
  - Double-check your `deploymentKey`.
  - Ensure the app version you're targeting in your release matches the `binary version` of the running app.
  - Use `code-push deployment history <appName> <deploymentName>` to verify the release is available.

- **App Crashing After Update**:
  - This is often due to a mismatch between the native code and the JS bundle. Ensure any native module changes are compatible with the JS code.
  - Use the `code-push rollback <appName> <deploymentName>` command to revert to a previous, stable release.

- **Stuck in `SYNC_IN_PROGRESS`**:
  - This can happen if a previous sync operation failed without resetting the `syncInProgress` flag. Restarting the app should resolve this.

## 5. Visual Workflow Diagram

```mermaid
graph TD
    A[Start: codePush.sync()] --> B{syncInProgress?};
    B -- Yes --> C[Return SYNC_IN_PROGRESS];
    B -- No --> D[Set syncInProgress = true];
    D --> E[Call syncInternal()];
    E --> F[notifyApplicationReady()];
    F --> G[checkForUpdate()];
    G --> H{Update available?};
    H -- No --> I[Return UP_TO_DATE];
    H -- Yes --> J{Update dialog?};
    J -- Yes --> K[Show dialog];
    K --> L{User accepts?};
    L -- No --> M[Return UPDATE_IGNORED];
    J -- No --> L;
    L -- Yes --> N[remotePackage.download()];
    N --> O[localPackage.install()];
    O --> P{Install mode?};
    P -- IMMEDIATE --> Q[Restart app];
    P -- ON_NEXT_RESTART --> R[Wait for restart];
    P -- ON_NEXT_RESUME --> S[Wait for resume];
    S --> T[End];
    R --> T;
    Q --> T;
    M --> T;
    I --> T;
    C --> T;
```

## 7. Android Native Implementation Details

On Android, the native logic is primarily handled by a few key Java classes:

- **`CodePushNativeModule.java`**: This is the bridge between the JavaScript and native worlds. It exposes methods to JS using the `@ReactMethod` annotation and receives all the calls we've discussed. It's responsible for orchestrating the native workflow and delegating tasks to other classes.

- **`CodePush.java`**: This class manages the overall CodePush configuration and state. It holds information about the deployment key, server URL, and the currently running version of the app.

- **`CodePushUpdateManager.java`**: This class is the workhorse for handling the update process. It manages downloading the update package, unzipping it, and storing it on the device.

- **`SettingsManager.java`**: This class handles the persistence of CodePush-related data, such as pending updates, failed updates, and rollback information, using `SharedPreferences`.

### Applying the Update on Android

The most complex part of the Android implementation is the `loadBundle()` method within `CodePushNativeModule.java`. Here's how it works:

1.  **Resolve Instance Manager**: It first gets a reference to the `ReactInstanceManager`, which is the core of the React Native application.
2.  **Set JS Bundle**: Using Java reflection, it finds the `mBundleLoader` field within the `ReactInstanceManager` and sets its value to a new `JSBundleLoader` that points to the downloaded CodePush bundle file. This is a delicate operation that essentially tells React Native where to load the JavaScript from next time.
3.  **Recreate Context**: It then calls `instanceManager.recreateReactContextInBackground()` on the main UI thread. This triggers a reload of the JavaScript bundle, and since the bundle location was just changed, React Native loads the new update.

## 8. iOS Native Implementation Details

On iOS, the native logic is handled by a set of Objective-C classes:

- **`CodePush.m`**: This is the main native module, acting as the bridge between JavaScript and native code. It uses the `RCT_EXPORT_METHOD` macro to expose methods to JavaScript. It manages the application lifecycle events to handle different install modes and orchestrates the update process.

- **`CodePushPackage.m`**: This class is responsible for all file-related operations, including downloading the update from the server, unzipping the package, and managing the different versions of the update on disk.

- **`CodePushConfig.m`**: Manages the configuration of the CodePush instance, such as the deployment key and server URL.

- **`CodePushUpdateUtils.m`**: Provides utility functions for tasks like checking the modification date of files and handling assets.

### Applying the Update on iOS

The update process on iOS is handled by the `loadBundle` method in `CodePush.m`:

1.  **Get Bridge**: It gets a reference to the `RCTBridge` instance, which is the core of the React Native application.
2.  **Set Bundle URL**: It modifies the `bundleURL` property of the bridge instance to point to the location of the downloaded CodePush update. This is done via `[super.bridge setValue:[CodePush bundleURL] forKey:@"bundleURL"];`.
3.  **Trigger Reload**: It then sends a notification to the `RCTBridge` to reload the JavaScript bundle by calling `RCTTriggerReloadCommandListeners(...)`. The React Native core listens for this notification and re-initializes the JavaScript environment with the new bundle.
