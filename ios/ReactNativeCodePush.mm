#import "ReactNativeCodePush.h"
#import <React/RCTBridge.h>
#import <React/RCTEventDispatcher.h>
#import <React/RCTUtils.h>
#import <SSZipArchive/SSZipArchive.h>

@interface ReactNativeCodePush()

@property (nonatomic, strong) NSUserDefaults *settings;
@property (nonatomic, strong) NSString *codePushDirectory;
@property (nonatomic, strong) NSString *clientUniqueId;

@end

@implementation ReactNativeCodePush

// Constants
static NSString * const CodePushPreferencesKey = @"CodePush";
static NSString * const CurrentPackageKey = @"currentPackage";
static NSString * const FailedUpdatesKey = @"failedUpdates";
static NSString * const ClientUniqueIdKey = @"clientUniqueId";
static NSString * const DeploymentKeyKey = @"deploymentKey";
static NSString * const ServerUrlKey = @"serverUrl";
static NSString * const PendingUpdateKey = @"pendingUpdate";
static NSString * const PendingUpdateHashKey = @"hash";
static NSString * const PendingUpdateIsLoadingKey = @"isLoading";
static NSString * const PackageHashKey = @"packageHash";
static NSString * const LatestRollbackInfoKey = @"latestRollbackInfo";
static NSString * const LatestRollbackPackageHashKey = @"packageHash";
static NSString * const LatestRollbackTimeKey = @"time";
static NSString * const LatestRollbackCountKey = @"count";
static NSString * const LastDeploymentReportKey = @"CODE_PUSH_LAST_DEPLOYMENT_REPORT";
static NSString * const RetryDeploymentReportKey = @"CODE_PUSH_RETRY_DEPLOYMENT_REPORT";

// Update states
static const NSInteger UpdateStateLatest = 0;
static const NSInteger UpdateStatePending = 1;
static const NSInteger UpdateStateRunning = 2;

RCT_EXPORT_MODULE()

- (instancetype)init {
    if (self = [super init]) {
        self.settings = [[NSUserDefaults alloc] initWithSuiteName:CodePushPreferencesKey];
        
        // Setup CodePush directory
        NSArray *documentPaths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
        NSString *documentsDirectory = [documentPaths objectAtIndex:0];
        self.codePushDirectory = [documentsDirectory stringByAppendingPathComponent:@"CodePush"];
        
        // Create directory if it doesn't exist
        NSFileManager *fileManager = [NSFileManager defaultManager];
        if (![fileManager fileExistsAtPath:self.codePushDirectory]) {
            [fileManager createDirectoryAtPath:self.codePushDirectory withIntermediateDirectories:YES attributes:nil error:nil];
        }
        
        // Setup client unique ID
        self.clientUniqueId = [self.settings objectForKey:ClientUniqueIdKey];
        if (!self.clientUniqueId) {
            self.clientUniqueId = [[NSUUID UUID] UUIDString];
            [self.settings setObject:self.clientUniqueId forKey:ClientUniqueIdKey];
            [self.settings synchronize];
        }
    }
    return self;
}

- (void)logData:(NSString *)message data:(id)data {
    NSString *logMessage;
    if (data) {
        logMessage = [NSString stringWithFormat:@"%@ | Data: %@", message, data];
    } else {
        logMessage = message;
    }
    NSLog(@"[ReactNativeCodePush CodePush] %@", logMessage);
}

+ (BOOL)requiresMainQueueSetup {
    return YES;
}

- (NSDictionary *)constantsToExport {
    return @{
        @"codePushInstallModeImmediate": @(0),
        @"codePushInstallModeOnNextRestart": @(1),
        @"codePushInstallModeOnNextResume": @(2),
        @"codePushInstallModeOnNextSuspend": @(3),
        @"codePushUpdateStateRunning": @(2),
        @"codePushUpdateStatePending": @(1),
        @"codePushUpdateStateLatest": @(0)
    };
}

RCT_EXPORT_METHOD(getValue:(NSString *)key resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
    [self logData:@"getValue() called" data:[NSString stringWithFormat:@"key=%@", key]];
    @try {
        NSString *value = [self.settings objectForKey:key] ?: @"";
        NSString *result = [NSString stringWithFormat:@"Value for %@: %@", key, value];
        [self logData:@"getValue() resolving" data:result];
        resolve(result);
    } @catch (NSException *exception) {
        [self logData:@"getValue() error" data:exception.reason];
        reject(@"ERROR", @"Failed to get value", [self createErrorFromException:exception]);
    }
}

RCT_EXPORT_METHOD(getConfiguration:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
    [self logData:@"getConfiguration() called" data:nil];
    @try {
        NSString *appVersion = [self getAppVersion];
        NSString *clientUniqueId = [self getClientUniqueId];
        NSString *deploymentKey = [self getDeploymentKey];
        NSString *serverUrl = [self getServerUrl];
        NSString *packageHash = [self getCurrentPackageHash];
        
        [self logData:@"getConfiguration() gathered data"
                 data:[NSString stringWithFormat:@"appVersion=%@, clientUniqueId=%@, deploymentKey=%@..., serverUrl=%@, packageHash=%@",
                       appVersion, [clientUniqueId substringToIndex:MIN(8, clientUniqueId.length)],
                       [deploymentKey substringToIndex:MIN(10, deploymentKey.length)], serverUrl, packageHash]];
        
        NSDictionary *config = @{
            @"appVersion": appVersion ?: @"1.0.0",
            @"clientUniqueId": clientUniqueId ?: [[NSUUID UUID] UUIDString],
            @"deploymentKey": deploymentKey ?: @"",
            @"serverUrl": serverUrl ?: @"https://codepush.appcenter.ms/",
            @"packageHash": packageHash ?: [NSNull null]
        };
        
        [self logData:@"getConfiguration() resolving" data:config];
        resolve(config);
    } @catch (NSException *exception) {
        [self logData:@"getConfiguration() error" data:exception.reason];
        reject(@"ERROR", @"Failed to get configuration", [self createErrorFromException:exception]);
    }
}

RCT_EXPORT_METHOD(getCurrentPackage:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
    [self logData:@"getCurrentPackage() called" data:nil];
    @try {
        NSDictionary *currentPackage = [self.settings objectForKey:CurrentPackageKey];
        [self logData:@"getCurrentPackage() retrieved from NSUserDefaults" data:currentPackage];
        
        if (currentPackage) {
            NSDictionary *packageInfo = @{
                @"appVersion": currentPackage[@"appVersion"] ?: @"",
                @"description": currentPackage[@"description"] ?: @"",
                @"failedInstall": currentPackage[@"failedInstall"] ?: @NO,
                @"failedUpdate": currentPackage[@"failedUpdate"] ?: @NO,
                @"isFirstRun": currentPackage[@"isFirstRun"] ?: @YES,
                @"isPending": currentPackage[@"isPending"] ?: @NO,
                @"label": currentPackage[@"label"] ?: @"",
                @"packageHash": currentPackage[@"packageHash"] ?: @"",
                @"packageSize": currentPackage[@"packageSize"] ?: @0
            };
            [self logData:@"getCurrentPackage() resolving with package info" data:packageInfo];
            resolve(packageInfo);
        } else {
            [self logData:@"getCurrentPackage() resolving with null" data:@"No current package found"];
            resolve([NSNull null]);
        }
    } @catch (NSException *exception) {
        [self logData:@"getCurrentPackage() error" data:exception.reason];
        reject(@"ERROR", @"Failed to get current package", [self createErrorFromException:exception]);
    }
}

RCT_EXPORT_METHOD(getUpdateMetadata:(double)updateState resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
    [self logData:@"getUpdateMetadata() called" data:@(updateState)];
    @try {
        NSDictionary *currentPackage = [self.settings objectForKey:CurrentPackageKey];
        
        if (!currentPackage) {
            [self logData:@"getUpdateMetadata() no current package" data:nil];
            resolve([NSNull null]);
            return;
        }

        NSString *currentHash = currentPackage[PackageHashKey];
        BOOL currentUpdateIsPending = [self isPendingUpdate:currentHash];

        int state = (int)updateState;
        switch (state) {
            case UpdateStatePending:
                if (!currentUpdateIsPending) {
                    [self logData:@"getUpdateMetadata() no pending update" data:nil];
                    resolve([NSNull null]);
                    return;
                }
                break;
            case UpdateStateRunning:
                if (currentUpdateIsPending) {
                    // Return previous package if current is pending
                    NSDictionary *previousPackage = [self.settings objectForKey:@"previousPackage"];
                    if (previousPackage) {
                        resolve(previousPackage);
                        return;
                    } else {
                        resolve([NSNull null]);
                        return;
                    }
                }
                break;
            case UpdateStateLatest:
                // Return current package regardless of pending status
                break;
        }

        // Add pending status and debug info
        NSMutableDictionary *mutablePackage = [currentPackage mutableCopy];
        mutablePackage[@"isPending"] = @(currentUpdateIsPending);
        if ([self isRunningBinaryVersion]) {
            mutablePackage[@"_isDebugOnly"] = @YES;
        }

        [self logData:@"getUpdateMetadata() returning package" data:mutablePackage];
        resolve(mutablePackage);

    } @catch (NSException *exception) {
        [self logData:@"getUpdateMetadata() error" data:exception.reason];
        reject(@"ERROR", @"Failed to get update metadata", [self createErrorFromException:exception]);
    }
}

RCT_EXPORT_METHOD(getNewStatusReport:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
    [self logData:@"getNewStatusReport() called" data:nil];
    @try {
        // Check if we need to report rollback
        BOOL needToReportRollback = [[self.settings objectForKey:@"needToReportRollback"] boolValue];
        
        if (needToReportRollback) {
            [self.settings setObject:@NO forKey:@"needToReportRollback"];
            [self.settings synchronize];
            
            NSArray *failedUpdates = [self getFailedUpdates];
            if (failedUpdates.count > 0) {
                NSDictionary *lastFailedPackage = [failedUpdates lastObject];
                NSDictionary *rollbackReport = [self createRollbackReport:lastFailedPackage];
                [self logData:@"getNewStatusReport() returning rollback report" data:nil];
                resolve(rollbackReport);
                return;
            }
        }
        
        // Check if we did update
        BOOL didUpdate = [[self.settings objectForKey:@"didUpdate"] boolValue];
        if (didUpdate) {
            NSDictionary *currentPackage = [self.settings objectForKey:CurrentPackageKey];
            if (currentPackage) {
                NSDictionary *updateReport = [self createUpdateReport:currentPackage];
                [self logData:@"getNewStatusReport() returning update report" data:nil];
                resolve(updateReport);
                return;
            }
        }
        
        // Check if running binary version
        if ([self isRunningBinaryVersion]) {
            NSString *appVersion = [self getAppVersion];
            NSDictionary *binaryReport = [self createBinaryUpdateReport:appVersion];
            if (binaryReport) {
                [self logData:@"getNewStatusReport() returning binary report" data:nil];
                resolve(binaryReport);
                return;
            }
        }
        
        // Check for retry status report
        NSDictionary *retryReport = [self.settings objectForKey:RetryDeploymentReportKey];
        if (retryReport) {
            [self clearRetryStatusReport];
            [self logData:@"getNewStatusReport() returning retry report" data:nil];
            resolve(retryReport);
            return;
        }
        
        [self logData:@"getNewStatusReport() no status report" data:nil];
        resolve(@"");
    } @catch (NSException *exception) {
        [self logData:@"getNewStatusReport() error" data:exception.reason];
        reject(@"ERROR", @"Failed to get status report", [self createErrorFromException:exception]);
    }
}

RCT_EXPORT_METHOD(downloadUpdate:(NSDictionary *)updatePackage
                  notifyProgress:(BOOL)notifyProgress
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    [self logData:@"downloadUpdate() called"
             data:[NSString stringWithFormat:@"updatePackage=%@, notifyProgress=%@", updatePackage, @(notifyProgress)]];
    
    @try {
        NSString *downloadUrl = updatePackage[@"downloadUrl"];
        NSString *packageHash = updatePackage[@"packageHash"];
        NSString *label = updatePackage[@"label"];
        NSNumber *packageSize = updatePackage[@"packageSize"];

        [self logData:@"downloadUpdate() extracted parameters"
                 data:[NSString stringWithFormat:@"downloadUrl=%@, packageHash=%@, label=%@, packageSize=%@",
                       downloadUrl, packageHash, label, packageSize]];

        if (!downloadUrl || !packageHash || !label) {
            [self logData:@"downloadUpdate() parameter validation failed" data:nil];
            reject(@"ERROR", @"Invalid update package parameters", nil);
            return;
        }

        dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
            @try {
                [self logData:@"downloadUpdate() starting download" data:[NSString stringWithFormat:@"URL: %@", downloadUrl]];
                
                // ✅ FIX: Declare the callback variable with proper typing
                void (^progressCallback)(long long, long long) = nil;
                if (notifyProgress) {
                    progressCallback = ^(long long bytesReceived, long long totalBytes) {
                        [self logData:@"downloadUpdate() progress"
                                 data:[NSString stringWithFormat:@"Received: %lld / Total: %lld bytes", bytesReceived, totalBytes]];
                    };
                }
                
                NSData *downloadedData = [self downloadUpdateFromUrl:downloadUrl
                                                      progressCallback:progressCallback];
                
                [self logData:@"downloadUpdate() download completed"
                         data:[NSString stringWithFormat:@"Downloaded %lu bytes", (unsigned long)downloadedData.length]];
                
                // Save downloaded package
                BOOL success = [self saveDownloadedPackage:downloadedData
                                               packageHash:packageHash
                                                     label:label
                                             updatePackage:updatePackage];
                [self logData:@"downloadUpdate() save result" data:@(success)];
                
                dispatch_async(dispatch_get_main_queue(), ^{
                    if (success) {
                        // Return the saved package info
                        NSDictionary *savedPackage = [self getPackageByHash:packageHash];
                        if (savedPackage) {
                            resolve(savedPackage);
                        } else {
                            reject(@"ERROR", @"Failed to retrieve saved package", nil);
                        }
                    } else {
                        reject(@"ERROR", @"Failed to save downloaded package", nil);
                    }
                });
                
            } @catch (NSException *exception) {
                [self logData:@"downloadUpdate() download error" data:exception.reason];
                dispatch_async(dispatch_get_main_queue(), ^{
                    reject(@"DOWNLOAD_ERROR", [NSString stringWithFormat:@"Failed to download update: %@", exception.reason],
                           [self createErrorFromException:exception]);
                });
            }
        });
        
    } @catch (NSException *exception) {
        [self logData:@"downloadUpdate() general error" data:exception.reason];
        reject(@"ERROR", @"Failed to download update", [self createErrorFromException:exception]);
    }
}


RCT_EXPORT_METHOD(installUpdate:(NSDictionary *)updatePackage
                  installMode:(double)installMode
                  minimumBackgroundDuration:(double)minimumBackgroundDuration
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    [self logData:@"installUpdate() called"
             data:[NSString stringWithFormat:@"updatePackage=%@, installMode=%f, minimumBackgroundDuration=%f",
                   updatePackage, installMode, minimumBackgroundDuration]];
    @try {
        NSString *packageHash = updatePackage[@"packageHash"];
        NSString *label = updatePackage[@"label"];
        
        if (!packageHash || !label) {
            reject(@"ERROR", @"Invalid update package parameters", nil);
            return;
        }

        // Save as current package
        [self.settings setObject:updatePackage forKey:CurrentPackageKey];
        [self.settings synchronize];
        
        // Mark as pending
        [self savePendingUpdate:packageHash isLoading:NO];
        
        [self logData:@"installUpdate() package installed successfully" data:nil];
        resolve(@"");
    } @catch (NSException *exception) {
        [self logData:@"installUpdate() error" data:exception.reason];
        reject(@"ERROR", @"Failed to install update", [self createErrorFromException:exception]);
    }
}

RCT_EXPORT_METHOD(notifyApplicationReady:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
    [self logData:@"notifyApplicationReady() called" data:nil];
    @try {
        // Remove pending update status
        [self removePendingUpdate];
        [self logData:@"notifyApplicationReady() removed pending update status" data:nil];
        resolve(@"");
    } @catch (NSException *exception) {
        [self logData:@"notifyApplicationReady() error" data:exception.reason];
        reject(@"ERROR", @"Failed to notify application ready", [self createErrorFromException:exception]);
    }
}

RCT_EXPORT_METHOD(restartApp:(BOOL)onlyIfUpdateIsPending
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    [self logData:@"restartApp() called" data:@(onlyIfUpdateIsPending)];
    @try {
        BOOL isPending = [self isPendingUpdate:nil];
        BOOL shouldRestart = !onlyIfUpdateIsPending || isPending;
        [self logData:@"restartApp() decision"
                 data:[NSString stringWithFormat:@"isPending=%@, shouldRestart=%@", @(isPending), @(shouldRestart)]];
        
        if (shouldRestart) {
            [self logData:@"restartApp() restart requested" data:nil];
            resolve(@"App restart requested");
        } else {
            [self logData:@"restartApp() restart skipped" data:nil];
            resolve(@"No pending update, restart not needed");
        }
    } @catch (NSException *exception) {
        [self logData:@"restartApp() error" data:exception.reason];
        reject(@"ERROR", @"Failed to restart app", [self createErrorFromException:exception]);
    }
}

RCT_EXPORT_METHOD(clearPendingRestart:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
    [self logData:@"clearPendingRestart() called" data:nil];
    @try {
        NSMutableDictionary *currentPackage = [[self.settings objectForKey:CurrentPackageKey] mutableCopy];
        if (currentPackage) {
            currentPackage[@"isPending"] = @NO;
            [self.settings setObject:currentPackage forKey:CurrentPackageKey];
            [self.settings synchronize];
        }
        resolve([NSNull null]);
    } @catch (NSException *exception) {
        [self logData:@"clearPendingRestart() error" data:exception.reason];
        reject(@"ERROR", @"Failed to clear pending restart", [self createErrorFromException:exception]);
    }
}

RCT_EXPORT_METHOD(isFailedUpdate:(NSString *)packageHash
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    [self logData:@"isFailedUpdate() called" data:packageHash];
    @try {
        BOOL isFailed = [self isFailedHash:packageHash];
        [self logData:@"isFailedUpdate() result" data:@(isFailed)];
        resolve(@(isFailed));
    } @catch (NSException *exception) {
        [self logData:@"isFailedUpdate() error" data:exception.reason];
        reject(@"ERROR", @"Failed to check if update failed", [self createErrorFromException:exception]);
    }
}

RCT_EXPORT_METHOD(getLatestRollbackInfo:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
    [self logData:@"getLatestRollbackInfo() called" data:nil];
    @try {
        NSDictionary *rollbackInfo = [self.settings objectForKey:LatestRollbackInfoKey];
        if (rollbackInfo) {
            resolve(rollbackInfo);
        } else {
            resolve([NSNull null]);
        }
    } @catch (NSException *exception) {
        [self logData:@"getLatestRollbackInfo() error" data:exception.reason];
        reject(@"ERROR", @"Failed to get rollback info", [self createErrorFromException:exception]);
    }
}

RCT_EXPORT_METHOD(setLatestRollbackInfo:(NSString *)packageHash
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    [self logData:@"setLatestRollbackInfo() called" data:packageHash];
    @try {
        NSDictionary *existingRollbackInfo = [self.settings objectForKey:LatestRollbackInfoKey];
        NSInteger count = 0;
        
        if (existingRollbackInfo) {
            NSString *existingHash = existingRollbackInfo[LatestRollbackPackageHashKey];
            if ([existingHash isEqualToString:packageHash]) {
                count = [existingRollbackInfo[LatestRollbackCountKey] integerValue];
            }
        }
        
        NSDictionary *rollbackInfo = @{
            LatestRollbackPackageHashKey: packageHash,
            LatestRollbackTimeKey: @([[NSDate date] timeIntervalSince1970] * 1000),
            LatestRollbackCountKey: @(count + 1)
        };
        
        [self.settings setObject:rollbackInfo forKey:LatestRollbackInfoKey];
        [self.settings synchronize];
        
        resolve([NSNull null]);
    } @catch (NSException *exception) {
        [self logData:@"setLatestRollbackInfo() error" data:exception.reason];
        reject(@"ERROR", @"Failed to set rollback info", [self createErrorFromException:exception]);
    }
}

RCT_EXPORT_METHOD(isFirstRun:(NSString *)packageHash
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
    [self logData:@"isFirstRun() called" data:packageHash];
    @try {
        BOOL didUpdate = [[self.settings objectForKey:@"didUpdate"] boolValue];
        NSString *currentHash = [self getCurrentPackageHash];
        BOOL isFirstRun = didUpdate && [packageHash isEqualToString:currentHash];
        
        [self logData:@"isFirstRun() result" data:@(isFirstRun)];
        resolve(@(isFirstRun));
    } @catch (NSException *exception) {
        [self logData:@"isFirstRun() error" data:exception.reason];
        reject(@"ERROR", @"Failed to check if first run", [self createErrorFromException:exception]);
    }
}

RCT_EXPORT_METHOD(allowRestart:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
    [self logData:@"allowRestart() called" data:nil];
    @try {
        [self.settings setObject:@YES forKey:@"restartAllowed"];
        [self.settings synchronize];
        resolve([NSNull null]);
    } @catch (NSException *exception) {
        [self logData:@"allowRestart() error" data:exception.reason];
        reject(@"ERROR", @"Failed to allow restart", [self createErrorFromException:exception]);
    }
}

RCT_EXPORT_METHOD(disallowRestart:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
    [self logData:@"disallowRestart() called" data:nil];
    @try {
        [self.settings setObject:@NO forKey:@"restartAllowed"];
        [self.settings synchronize];
        resolve([NSNull null]);
    } @catch (NSException *exception) {
        [self logData:@"disallowRestart() error" data:exception.reason];
        reject(@"ERROR", @"Failed to disallow restart", [self createErrorFromException:exception]);
    }
}

RCT_EXPORT_METHOD(recordStatusReported:(NSDictionary *)statusReport) {
    [self logData:@"recordStatusReported() called" data:nil];
    @try {
        // Don't record rollback reports
        NSString *status = statusReport[@"status"];
        if ([status isEqualToString:@"DeploymentFailed"]) {
            return;
        }
        
        NSString *appVersion = statusReport[@"appVersion"];
        NSDictionary *packageDict = statusReport[@"package"];
        
        NSString *identifier = nil;
        if (appVersion) {
            identifier = appVersion;
        } else if (packageDict) {
            identifier = [self getPackageStatusReportIdentifier:packageDict];
        }
        
        if (identifier) {
            [self.settings setObject:identifier forKey:LastDeploymentReportKey];
            [self.settings synchronize];
            [self logData:@"recordStatusReported() saved identifier" data:identifier];
        }
    } @catch (NSException *exception) {
        [self logData:@"recordStatusReported() error" data:exception.reason];
    }
}

RCT_EXPORT_METHOD(saveStatusReportForRetry:(NSDictionary *)statusReport) {
    [self logData:@"saveStatusReportForRetry() called" data:nil];
    @try {
        [self.settings setObject:statusReport forKey:RetryDeploymentReportKey];
        [self.settings synchronize];
        [self logData:@"saveStatusReportForRetry() saved for retry" data:nil];
    } @catch (NSException *exception) {
        [self logData:@"saveStatusReportForRetry() error" data:exception.reason];
    }
}

RCT_EXPORT_METHOD(clearUpdates:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
    [self logData:@"clearUpdates() called" data:nil];
    @try {
        // Clear all CodePush related data
        [self.settings removeObjectForKey:CurrentPackageKey];
        [self.settings removeObjectForKey:PendingUpdateKey];
        [self.settings removeObjectForKey:FailedUpdatesKey];
        [self.settings removeObjectForKey:@"previousPackage"];
        [self.settings removeObjectForKey:@"didUpdate"];
        [self.settings removeObjectForKey:@"needToReportRollback"];
        [self.settings synchronize];
        
        // Clear CodePush directory
        NSFileManager *fileManager = [NSFileManager defaultManager];
        if ([fileManager fileExistsAtPath:self.codePushDirectory]) {
            [fileManager removeItemAtPath:self.codePushDirectory error:nil];
            [fileManager createDirectoryAtPath:self.codePushDirectory withIntermediateDirectories:YES attributes:nil error:nil];
        }
        
        [self logData:@"clearUpdates() completed" data:nil];
        resolve([NSNull null]);
    } @catch (NSException *exception) {
        [self logData:@"clearUpdates() error" data:exception.reason];
        reject(@"ERROR", @"Failed to clear updates", [self createErrorFromException:exception]);
    }
}

RCT_EXPORT_METHOD(addListener:(NSString *)eventName) {
    [self logData:@"addListener() called" data:eventName];
}

RCT_EXPORT_METHOD(removeListeners:(double)count) {
    [self logData:@"removeListeners() called" data:@(count)];
}

// ============ HELPER METHODS ============

- (NSString *)getAppVersion {
  [self logData:@"getAppVersion() called" data:nil];
  NSString *version = [[[NSBundle mainBundle] infoDictionary] objectForKey:@"CFBundleShortVersionString"] ?: @"1.0.0";
  [self logData:@"getAppVersion() result" data:version];
  return version;
}

- (NSString *)getClientUniqueId {
  [self logData:@"getClientUniqueId() called" data:nil];
  [self logData:@"getClientUniqueId() result" data:[NSString stringWithFormat:@"%@...", [self.clientUniqueId substringToIndex:MIN(8, self.clientUniqueId.length)]]];
  return self.clientUniqueId;
}

- (NSString *)getDeploymentKey {
  [self logData:@"getDeploymentKey() called" data:nil];
  
  NSString *key = [self.settings objectForKey:DeploymentKeyKey];
  [self logData:@"getDeploymentKey() from NSUserDefaults" data:[NSString stringWithFormat:@"key=%@...", [key substringToIndex:MIN(10, key.length)] ?: @"null"]];
  
  if (!key || key.length == 0) {
    key = [[[NSBundle mainBundle] infoDictionary] objectForKey:@"CodePushDeploymentKey"];
    [self logData:@"getDeploymentKey() from Info.plist" data:[NSString stringWithFormat:@"key=%@...", [key substringToIndex:MIN(10, key.length)] ?: @"null"]];
  }
  
  NSString *result = key ?: @"";
  [self logData:@"getDeploymentKey() final result" data:[NSString stringWithFormat:@"key=%@...", [result substringToIndex:MIN(10, result.length)]]];
  return result;
}

- (NSString *)getServerUrl {
  [self logData:@"getServerUrl() called" data:nil];
  
  NSString *url = [self.settings objectForKey:ServerUrlKey];
  [self logData:@"getServerUrl() from NSUserDefaults" data:url ?: @"null"];
  
  if (!url || url.length == 0) {
    url = [[[NSBundle mainBundle] infoDictionary] objectForKey:@"CodePushServerURL"];
    [self logData:@"getServerUrl() from Info.plist" data:url ?: @"null"];
  }
  
  NSString *result = url ?: @"https://codepush.appcenter.ms/";
  [self logData:@"getServerUrl() final result" data:result];
  return result;
}

- (NSString *)getCurrentPackageHash {
  [self logData:@"getCurrentPackageHash() called" data:nil];
  NSDictionary *currentPackage = [self.settings objectForKey:CurrentPackageKey];
  NSString *hash = currentPackage[PackageHashKey];
  [self logData:@"getCurrentPackageHash() result" data:hash ?: @"null (no package found)"];
  return hash;
}

- (BOOL)isPendingUpdate:(NSString *)packageHash {
  NSDictionary *pendingUpdate = [self.settings objectForKey:PendingUpdateKey];
  if (pendingUpdate) {
    BOOL isLoading = [pendingUpdate[PendingUpdateIsLoadingKey] boolValue];
    NSString *pendingHash = pendingUpdate[PendingUpdateHashKey];
    
    return !isLoading && (packageHash == nil || [pendingHash isEqualToString:packageHash]);
  }
  return NO;
}

- (BOOL)isRunningBinaryVersion {
  // This would check if we're running the original binary version vs a CodePush update
  return [self getCurrentPackageHash] == nil;
}

- (NSData *)downloadUpdateFromUrl:(NSString *)downloadUrl progressCallback:(void (^)(long long, long long))progressCallback {
  NSURL *url = [NSURL URLWithString:downloadUrl];
  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  [request setValue:@"CodePush/1.0 (iOS)" forHTTPHeaderField:@"User-Agent"];
  
  NSURLSessionConfiguration *configuration = [NSURLSessionConfiguration defaultSessionConfiguration];
  NSURLSession *session = [NSURLSession sessionWithConfiguration:configuration];
  
  __block NSData *downloadedData = nil;
  __block NSError *downloadError = nil;
  
  dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);
  
  NSURLSessionDataTask *task = [session dataTaskWithRequest:request completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
    if (error) {
      downloadError = error;
    } else {
      downloadedData = data;
    }
    dispatch_semaphore_signal(semaphore);
  }];
  
  [task resume];
  dispatch_semaphore_wait(semaphore, DISPATCH_TIME_FOREVER);
  
  if (downloadError) {
    @throw [NSException exceptionWithName:@"DownloadError" reason:downloadError.localizedDescription userInfo:nil];
  }
  
  return downloadedData;
}

- (BOOL)saveDownloadedPackage:(NSData *)data packageHash:(NSString *)packageHash label:(NSString *)label updatePackage:(NSDictionary *)updatePackage {
  [self logData:@"saveDownloadedPackage() called"
           data:[NSString stringWithFormat:@"dataSize=%lu bytes, packageHash=%@, label=%@", (unsigned long)data.length, packageHash, label]];
  @try {
    // Create package directory
    NSString *packageDir = [self.codePushDirectory stringByAppendingPathComponent:packageHash];
    NSFileManager *fileManager = [NSFileManager defaultManager];
    
    if (![fileManager fileExistsAtPath:packageDir]) {
      [fileManager createDirectoryAtPath:packageDir withIntermediateDirectories:YES attributes:nil error:nil];
    }
    
    // Save the zip file
    NSString *zipPath = [packageDir stringByAppendingPathComponent:@"update.zip"];
    [data writeToFile:zipPath atomically:YES];
    
    // Save package metadata
    NSMutableDictionary *packageMetadata = [updatePackage mutableCopy];
    packageMetadata[@"packageHash"] = packageHash;
    packageMetadata[@"label"] = label;
    packageMetadata[@"packageSize"] = @(data.length);
    packageMetadata[@"downloadTime"] = @([[NSDate date] timeIntervalSince1970] * 1000);
    
    NSString *metadataPath = [packageDir stringByAppendingPathComponent:@"metadata.json"];
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:packageMetadata options:NSJSONWritingPrettyPrinted error:nil];
    [jsonData writeToFile:metadataPath atomically:YES];
    
    [self logData:@"saveDownloadedPackage() success" data:[NSString stringWithFormat:@"Package saved to %@", packageDir]];
    return YES;
  } @catch (NSException *exception) {
    [self logData:@"saveDownloadedPackage() error" data:exception.reason];
    return NO;
  }
}

- (NSDictionary *)getPackageByHash:(NSString *)packageHash {
  @try {
    NSString *packageDir = [self.codePushDirectory stringByAppendingPathComponent:packageHash];
    NSString *metadataPath = [packageDir stringByAppendingPathComponent:@"metadata.json"];
    
    NSFileManager *fileManager = [NSFileManager defaultManager];
    if ([fileManager fileExistsAtPath:metadataPath]) {
      NSData *jsonData = [NSData dataWithContentsOfFile:metadataPath];
      NSDictionary *metadata = [NSJSONSerialization JSONObjectWithData:jsonData options:0 error:nil];
      return metadata;
    }
  } @catch (NSException *exception) {
    // Ignore
  }
  return nil;
}

- (void)savePendingUpdate:(NSString *)packageHash isLoading:(BOOL)isLoading {
  NSDictionary *pendingUpdate = @{
    PendingUpdateHashKey: packageHash,
    PendingUpdateIsLoadingKey: @(isLoading)
  };
  
  [self.settings setObject:pendingUpdate forKey:PendingUpdateKey];
  [self.settings synchronize];
}

- (void)removePendingUpdate {
  [self.settings removeObjectForKey:PendingUpdateKey];
  [self.settings synchronize];
}

- (NSArray *)getFailedUpdates {
  NSArray *failedUpdates = [self.settings objectForKey:FailedUpdatesKey];
  return failedUpdates ?: @[];
}

- (BOOL)isFailedHash:(NSString *)packageHash {
  NSArray *failedUpdates = [self getFailedUpdates];
  for (NSDictionary *failedPackage in failedUpdates) {
    NSString *failedHash = failedPackage[PackageHashKey];
    if ([packageHash isEqualToString:failedHash]) {
      return YES;
    }
  }
  return NO;
}

- (void)clearRetryStatusReport {
  [self.settings removeObjectForKey:RetryDeploymentReportKey];
  [self.settings synchronize];
}

// Status report creators
- (NSDictionary *)createRollbackReport:(NSDictionary *)failedPackage {
  return @{
    @"package": failedPackage,
    @"status": @"DeploymentFailed"
  };
}

- (NSDictionary *)createUpdateReport:(NSDictionary *)currentPackage {
  return @{
    @"package": currentPackage,
    @"status": @"DeploymentSucceeded"
  };
}

- (NSDictionary *)createBinaryUpdateReport:(NSString *)appVersion {
  NSString *previousStatusReportIdentifier = [self.settings objectForKey:LastDeploymentReportKey];
  
  if (!previousStatusReportIdentifier) {
    [self clearRetryStatusReport];
    return @{
      @"appVersion": appVersion
    };
  } else if (![previousStatusReportIdentifier isEqualToString:appVersion]) {
    [self clearRetryStatusReport];
    return @{
      @"appVersion": appVersion,
      @"previousLabelOrAppVersion": previousStatusReportIdentifier
    };
  }
  
  return nil;
}

- (NSString *)getPackageStatusReportIdentifier:(NSDictionary *)packageDict {
  NSString *deploymentKey = packageDict[@"deploymentKey"];
  NSString *label = packageDict[@"label"];
  
  if (deploymentKey && label) {
    return [NSString stringWithFormat:@"%@:%@", deploymentKey, label];
  }
  
  return nil;
}

- (NSError *)createErrorFromException:(NSException *)exception {
  return [NSError errorWithDomain:@"CodePushError" code:0 userInfo:@{NSLocalizedDescriptionKey: exception.reason ?: @"Unknown error"}];
}


 - (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
     (const facebook::react::ObjCTurboModule::InitParams &)params
 {
     return std::make_shared<facebook::react::NativeReactNativeCodePushSpecJSI>(params);
 }

@end

