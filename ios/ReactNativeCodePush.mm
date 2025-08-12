// #import "ReactNativeCodePush.h"

// @implementation ReactNativeCodePush
// RCT_EXPORT_MODULE()

// - (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
//     (const facebook::react::ObjCTurboModule::InitParams &)params
// {
//     return std::make_shared<facebook::react::NativeReactNativeCodePushSpecJSI>(params);
// }

// - (NSNumber *)multiply:(double)a b:(double)b {
//     NSNumber *result = @(a * b);
//     return result;
// }

// - (void)helloWorld:(nonnull RCTPromiseResolveBlock)resolve reject:(nonnull RCTPromiseRejectBlock)reject { 
//   @try {
//       resolve(@"hello");
//   } @catch (NSException *exception) {
//       reject(@"ERROR", @"Failed to say hello", [NSError errorWithDomain:@"ReactNativeCodePush" code:1 userInfo:@{NSLocalizedDescriptionKey: exception.reason ?: @"Unknown error"}]);
//   }
// }

// - (void)getConfiguration:(nonnull RCTPromiseResolveBlock)resolve reject:(nonnull RCTPromiseRejectBlock)reject {
//   @try {
//           NSDictionary *config = @{
//               @"appVersion": @"1.0.0",
//               @"clientUniqueId": @"test-client-id",
//               @"deploymentKey": @"test-deployment-key",
//               @"serverUrl": @"https://codepush.appcenter.ms/"
//           };
//           resolve(config);
//       } @catch (NSException *exception) {
//           reject(@"ERROR", @"Failed to get configuration",
//                  [NSError errorWithDomain:@"ReactNativeCodePush"
//                                      code:2
//                                  userInfo:@{NSLocalizedDescriptionKey: exception.reason ?: @"Unknown error"}]);
//       }
// }

// - (void)checkForUpdate:(NSString *)deploymentKey
//               resolve:(RCTPromiseResolveBlock)resolve
//                reject:(RCTPromiseRejectBlock)reject
// {
//     @try {
//         NSDictionary *updateInfo = @{
//             @"updateAvailable": @YES,
//             @"appVersion": @"1.0.1",
//             @"description": @"Bug fixes and improvements",
//             @"label": @"v3",
//             @"packageHash": @"xyz123",
//             @"downloadUrl": @"https://server.com/update",
//             @"isMandatory": @NO
//         };
//         resolve(updateInfo);
//     }
//     @catch (NSException *exception) {
//         reject(@"ERROR", @"checkForUpdate failed", [NSError errorWithDomain:@"ReactNativeCodePush" code:3 userInfo:@{NSLocalizedDescriptionKey: exception.reason ?: @"Unknown error"}]);
//     }
// }

// - (void)getCurrentPackage:(RCTPromiseResolveBlock)resolve
//                   reject:(RCTPromiseRejectBlock)reject
// {
//   @try {
//     NSDictionary *packageInfo = @{
//       @"appVersion": @"1.0.1",
//       @"description": @"Stable build with minor fixes",
//       @"failedInstall": @NO,
//       @"failedUpdate": @NO,
//       @"isFirstRun": @YES,
//       @"isPending": @NO,
//       @"label": @"v4",
//       @"packageHash": @"abc123def456",
//       @"packageSize": @(10485760) // 10 MB
//     };
//     resolve(packageInfo);
//   }
//   @catch (NSException *exception) {
//     reject(@"ERROR", @"getCurrentPackage failed", [NSError errorWithDomain:@"ReactNativeCodePush" code:4 userInfo:@{NSLocalizedDescriptionKey: exception.reason ?: @"Unknown error"}]);
//   }
// }


// - (void)getValue:(NSString *)key
//          resolve:(RCTPromiseResolveBlock)resolve
//          reject:(RCTPromiseRejectBlock)reject
// {
//   resolve([NSString stringWithFormat:@"Value for %@", key]);
// }

// @end

#import "ReactNativeCodePush.h"
#import <React/RCTLog.h>
#import <React/RCTUtils.h>

@interface ReactNativeCodePush()
@property (nonatomic, strong) NSDictionary *config;
@property (nonatomic, strong) NSUserDefaults *settings;
@end

@implementation ReactNativeCodePush

RCT_EXPORT_MODULE()

- (instancetype)init {
    if (self = [super init]) {
        self.settings = [[NSUserDefaults alloc] initWithSuiteName:@"CodePush"];
        [self loadConfiguration];
    }
    return self;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeReactNativeCodePushSpecJSI>(params);
}

// Basic methods
- (NSNumber *)multiply:(double)a b:(double)b {
    return @(a * b);
}

- (void)helloWorld:(RCTPromiseResolveBlock)resolve 
            reject:(RCTPromiseRejectBlock)reject { 
    @try {
        resolve(@"Hello from CodePush TurboModule!");
    } @catch (NSException *exception) {
        reject(@"ERROR", @"Failed to say hello", [self createErrorFromException:exception]);
    }
}

- (void)getValue:(NSString *)key
         resolve:(RCTPromiseResolveBlock)resolve
          reject:(RCTPromiseRejectBlock)reject {
    @try {
        NSString *value = [self.settings stringForKey:key] ?: @"";
        resolve([NSString stringWithFormat:@"Value for %@: %@", key, value]);
    } @catch (NSException *exception) {
        reject(@"ERROR", @"Failed to get value", [self createErrorFromException:exception]);
    }
}

- (void)getConfiguration:(RCTPromiseResolveBlock)resolve 
                  reject:(RCTPromiseRejectBlock)reject {
    @try {
        NSDictionary *config = @{
            @"appVersion": [self getAppVersion],
            @"clientUniqueId": [self getClientUniqueId],
            @"deploymentKey": [self getDeploymentKey],
            @"serverUrl": [self getServerUrl],
            @"packageHash": [self getCurrentPackageHash] ?: [NSNull null]
        };
        resolve(config);
    } @catch (NSException *exception) {
        reject(@"ERROR", @"Failed to get configuration", [self createErrorFromException:exception]);
    }
}

- (void)getCurrentPackage:(RCTPromiseResolveBlock)resolve
                   reject:(RCTPromiseRejectBlock)reject {
    @try {
        NSDictionary *currentPackage = [self.settings objectForKey:@"currentPackage"];
        if (currentPackage) {
            resolve(currentPackage);
        } else {
            resolve([NSNull null]);
        }
    } @catch (NSException *exception) {
        reject(@"ERROR", @"Failed to get current package", [self createErrorFromException:exception]);
    }
}

// - (void)checkForUpdate:(NSString *)deploymentKey
//                resolve:(RCTPromiseResolveBlock)resolve
//                 reject:(RCTPromiseRejectBlock)reject {
//     @try {
//         NSString *keyToUse = deploymentKey ?: [self getDeploymentKey];
//         if (!keyToUse || keyToUse.length == 0) {
//             reject(@"ERROR", @"Deployment key not found", nil);
//             return;
//         }
        
//         dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
//             @try {
//                 NSString *serverUrl = [self getServerUrl];
//                 NSString *appVersion = [self getAppVersion];
//                 NSString *packageHash = [self getCurrentPackageHash];
//                 NSString *clientUniqueId = [self getClientUniqueId];
                
//                 NSDictionary *response = [self performUpdateCheck:serverUrl
//                                                    deploymentKey:keyToUse
//                                                       appVersion:appVersion
//                                                      packageHash:packageHash
//                                                   clientUniqueId:clientUniqueId];
                
//                 dispatch_async(dispatch_get_main_queue(), ^{
//                     if (response[@"updateInfo"]) {
//                         NSDictionary *updateInfo = response[@"updateInfo"];
//                         NSDictionary *result = @{
//                             @"updateAvailable": @YES,
//                             @"appVersion": updateInfo[@"appVersion"] ?: appVersion,
//                             @"description": updateInfo[@"description"] ?: @"",
//                             @"label": updateInfo[@"label"] ?: @"",
//                             @"packageHash": updateInfo[@"packageHash"] ?: @"",
//                             @"downloadUrl": updateInfo[@"downloadURL"] ?: @"",
//                             @"isMandatory": updateInfo[@"isMandatory"] ?: @NO,
//                             @"packageSize": updateInfo[@"packageSize"] ?: @0
//                         };
//                         resolve(result);
//                     } else {
//                         NSDictionary *result = @{
//                             @"updateAvailable": @NO,
//                             @"appVersion": appVersion
//                         };
//                         resolve(result);
//                     }
//                 });
//             } @catch (NSException *exception) {
//                 dispatch_async(dispatch_get_main_queue(), ^{
//                     reject(@"NETWORK_ERROR", @"Failed to check for update", [self createErrorFromException:exception]);
//                 });
//             }
//         });
//     } @catch (NSException *exception) {
//         reject(@"ERROR", @"Failed to check for update", [self createErrorFromException:exception]);
//     }
// }

- (NSDictionary *)performUpdateCheck:(NSString *)serverUrl
                       deploymentKey:(NSString *)deploymentKey
                          appVersion:(NSString *)appVersion
                         packageHash:(NSString *)packageHash
                      clientUniqueId:(NSString *)clientUniqueId {
    
    // Build URL
    NSString *urlString = [NSString stringWithFormat:@"%@/updateCheck?deploymentKey=%@",
                          [serverUrl stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"/"]],
                          deploymentKey];
    NSURL *url = [NSURL URLWithString:urlString];
    
    // Build request body
    NSMutableDictionary *requestBody = [NSMutableDictionary dictionary];
    requestBody[@"deploymentKey"] = deploymentKey;
    requestBody[@"appVersion"] = appVersion;
    requestBody[@"clientUniqueId"] = clientUniqueId;
    requestBody[@"isCompanion"] = @NO;
    if (packageHash) {
        requestBody[@"packageHash"] = packageHash;
    }
    
    NSError *jsonError;
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:requestBody
                                                       options:0
                                                         error:&jsonError];
    if (jsonError) {
        @throw [NSException exceptionWithName:@"JSONSerializationException"
                                       reason:jsonError.localizedDescription
                                     userInfo:nil];
    }
    
    // Create request
    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url
                                                           cachePolicy:NSURLRequestReloadIgnoringCacheData
                                                       timeoutInterval:30.0];
    [request setHTTPMethod:@"POST"];
    [request setValue:@"application/json" forHTTPHeaderField:@"Accept"];
    [request setValue:@"application/json; charset=utf-8" forHTTPHeaderField:@"Content-Type"];
    [request setValue:@"CodePush/1.0 (ReactNative)" forHTTPHeaderField:@"User-Agent"];
    [request setValue:@"react-native-code-push" forHTTPHeaderField:@"X-CodePush-Plugin-Name"];
    [request setValue:@"1.0.0" forHTTPHeaderField:@"X-CodePush-Plugin-Version"];
    [request setValue:@"1.0.0" forHTTPHeaderField:@"X-CodePush-SDK-Version"];
    [request setHTTPBody:jsonData];
    
    // Perform synchronous request
    NSURLResponse *response;
    NSError *error;
    NSData *responseData = [NSURLConnection sendSynchronousRequest:request
                                                 returningResponse:&response
                                                             error:&error];
    
    if (error) {
        @throw [NSException exceptionWithName:@"NetworkException"
                                       reason:error.localizedDescription
                                     userInfo:nil];
    }
    
    NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
    if (httpResponse.statusCode < 200 || httpResponse.statusCode >= 300) {
        NSString *reason = [NSString stringWithFormat:@"HTTP %ld: %@",
                           (long)httpResponse.statusCode,
                           [NSHTTPURLResponse localizedStringForStatusCode:httpResponse.statusCode]];
        @throw [NSException exceptionWithName:@"HTTPException" reason:reason userInfo:nil];
    }
    
    if (!responseData) {
        return @{};
    }
    
    NSError *parseError;
    NSDictionary *jsonResponse = [NSJSONSerialization JSONObjectWithData:responseData
                                                                 options:0
                                                                   error:&parseError];
    if (parseError) {
        @throw [NSException exceptionWithName:@"JSONParseException"
                                       reason:parseError.localizedDescription
                                     userInfo:nil];
    }
    
    return jsonResponse ?: @{};
}

- (void)downloadUpdate:(NSDictionary *)updatePackage
        notifyProgress:(BOOL)notifyProgress
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject {
    @try {
        NSString *downloadUrl = updatePackage[@"downloadUrl"];
        NSString *packageHash = updatePackage[@"packageHash"];
        NSString *label = updatePackage[@"label"];
        NSNumber *packageSize = updatePackage[@"packageSize"];
        
        if (!downloadUrl || !packageHash || !label) {
            reject(@"ERROR", @"Invalid update package parameters", nil);
            return;
        }
        
        dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
            @try {
                NSData *downloadedData = [self performDownload:downloadUrl
                                                notifyProgress:notifyProgress];
                
                BOOL success = [self saveDownloadedPackage:downloadedData
                                               packageHash:packageHash
                                                     label:label];
                
                dispatch_async(dispatch_get_main_queue(), ^{
                    if (success) {
                        NSDictionary *result = @{
                            @"appVersion": [self getAppVersion],
                            @"description": @"Downloaded update",
                            @"failedInstall": @NO,
                            @"failedUpdate": @NO,
                            @"isFirstRun": @NO,
                            @"isPending": @YES,
                            @"label": label,
                            @"packageHash": packageHash,
                            @"packageSize": packageSize ?: @0
                        };
                        resolve(result);
                    } else {
                        reject(@"ERROR", @"Failed to save downloaded package", nil);
                    }
                });
            } @catch (NSException *exception) {
                dispatch_async(dispatch_get_main_queue(), ^{
                    reject(@"DOWNLOAD_ERROR", @"Failed to download update", [self createErrorFromException:exception]);
                });
            }
        });
    } @catch (NSException *exception) {
        reject(@"ERROR", @"Failed to download update", [self createErrorFromException:exception]);
    }
}

- (NSData *)performDownload:(NSString *)downloadUrl notifyProgress:(BOOL)notifyProgress {
    NSURL *url = [NSURL URLWithString:downloadUrl];
    
    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url
                                                           cachePolicy:NSURLRequestReloadIgnoringCacheData
                                                       timeoutInterval:60.0];
    [request setValue:@"*/*" forHTTPHeaderField:@"Accept"];
    [request setValue:@"CodePush/1.0 (ReactNative)" forHTTPHeaderField:@"User-Agent"];
    
    NSURLResponse *response;
    NSError *error;
    NSData *data = [NSURLConnection sendSynchronousRequest:request
                                         returningResponse:&response
                                                     error:&error];
    
    if (error) {
        @throw [NSException exceptionWithName:@"DownloadException"
                                       reason:error.localizedDescription
                                     userInfo:nil];
    }
    
    NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
    if (httpResponse.statusCode < 200 || httpResponse.statusCode >= 300) {
        NSString *reason = [NSString stringWithFormat:@"HTTP %ld", (long)httpResponse.statusCode];
        @throw [NSException exceptionWithName:@"HTTPException" reason:reason userInfo:nil];
    }
    
    return data;
}

- (BOOL)saveDownloadedPackage:(NSData *)data packageHash:(NSString *)packageHash label:(NSString *)label {
    // Implement file saving logic for CodePush directory structure
    // This would typically involve:
    // 1. Creating a directory for the package
    // 2. Extracting the zip file
    // 3. Validating the package hash
    // 4. Storing metadata
    return YES; // Placeholder
}


- (void)installUpdate:(NSDictionary *)updatePackage
          installMode:(double)installMode
minimumBackgroundDuration:(double)minimumBackgroundDuration
              resolve:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject {
    @try {
        NSString *packageHash = updatePackage[@"packageHash"];
        NSString *label = updatePackage[@"label"];
        
        if (!packageHash || !label) {
            reject(@"ERROR", @"Invalid update package parameters", nil);
            return;
        }
        
        // Mock install - replace with actual implementation
        NSDictionary *packageInfo = @{
            @"packageHash": packageHash,
            @"label": label,
            @"isPending": @YES,
            @"installMode": @((int)installMode)
        };
        
        [self.settings setObject:packageInfo forKey:@"currentPackage"];
        resolve([NSNull null]);
        
    } @catch (NSException *exception) {
        reject(@"ERROR", @"Failed to install update", [self createErrorFromException:exception]);
    }
}

- (void)notifyApplicationReady:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject {
    @try {
        NSMutableDictionary *currentPackage = [[self.settings objectForKey:@"currentPackage"] mutableCopy];
        if (currentPackage) {
            currentPackage[@"isFirstRun"] = @NO;
            currentPackage[@"isPending"] = @NO;
            [self.settings setObject:currentPackage forKey:@"currentPackage"];
        }
        resolve([NSNull null]);
    } @catch (NSException *exception) {
        reject(@"ERROR", @"Failed to notify application ready", [self createErrorFromException:exception]);
    }
}

- (void)restartApp:(BOOL)onlyIfUpdateIsPending
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject {
    @try {
        if (!onlyIfUpdateIsPending || [self isPendingUpdate]) {
            resolve(@"App restart requested");
        } else {
            resolve(@"No pending update, restart not needed");
        }
    } @catch (NSException *exception) {
        reject(@"ERROR", @"Failed to restart app", [self createErrorFromException:exception]);
    }
}

- (void)clearPendingRestart:(RCTPromiseResolveBlock)resolve
                     reject:(RCTPromiseRejectBlock)reject {
    @try {
        NSMutableDictionary *currentPackage = [[self.settings objectForKey:@"currentPackage"] mutableCopy];
        if (currentPackage) {
            currentPackage[@"isPending"] = @NO;
            [self.settings setObject:currentPackage forKey:@"currentPackage"];
        }
        resolve([NSNull null]);
    } @catch (NSException *exception) {
        reject(@"ERROR", @"Failed to clear pending restart", [self createErrorFromException:exception]);
    }
}

- (void)isFailedUpdate:(NSString *)packageHash
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject {
    @try {
        NSArray *failedUpdates = [self.settings arrayForKey:@"failedUpdates"] ?: @[];
        BOOL isFailed = [failedUpdates containsObject:packageHash];
        resolve(@(isFailed));
    } @catch (NSException *exception) {
        reject(@"ERROR", @"Failed to check if update failed", [self createErrorFromException:exception]);
    }
}

- (void)getLatestRollbackInfo:(RCTPromiseResolveBlock)resolve
                       reject:(RCTPromiseRejectBlock)reject {
    @try {
        // Mock implementation
        resolve([NSNull null]);
    } @catch (NSException *exception) {
        reject(@"ERROR", @"Failed to get rollback info", [self createErrorFromException:exception]);
    }
}

- (void)setLatestRollbackInfo:(NSString *)packageHash
                      resolve:(RCTPromiseResolveBlock)resolve
                       reject:(RCTPromiseRejectBlock)reject {
    @try {
        // Mock implementation
        resolve([NSNull null]);
    } @catch (NSException *exception) {
        reject(@"ERROR", @"Failed to set rollback info", [self createErrorFromException:exception]);
    }
}

- (void)isFirstRun:(NSString *)packageHash
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject {
    @try {
        NSDictionary *currentPackage = [self.settings objectForKey:@"currentPackage"];
        BOOL isFirstRun = currentPackage ? [currentPackage[@"isFirstRun"] boolValue] : YES;
        resolve(@(isFirstRun));
    } @catch (NSException *exception) {
        reject(@"ERROR", @"Failed to check if first run", [self createErrorFromException:exception]);
    }
}

- (void)allowRestart:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject {
    @try {
        [self.settings setBool:YES forKey:@"restartAllowed"];
        resolve([NSNull null]);
    } @catch (NSException *exception) {
        reject(@"ERROR", @"Failed to allow restart", [self createErrorFromException:exception]);
    }
}

- (void)disallowRestart:(RCTPromiseResolveBlock)resolve
                 reject:(RCTPromiseRejectBlock)reject {
    @try {
        [self.settings setBool:NO forKey:@"restartAllowed"];
        resolve([NSNull null]);
    } @catch (NSException *exception) {
        reject(@"ERROR", @"Failed to disallow restart", [self createErrorFromException:exception]);
    }
}

- (void)getUpdateMetadata:(double)updateState
                  resolve:(RCTPromiseResolveBlock)resolve
                   reject:(RCTPromiseRejectBlock)reject {
    @try {
        // Mock implementation
        resolve([NSNull null]);
    } @catch (NSException *exception) {
        reject(@"ERROR", @"Failed to get update metadata", [self createErrorFromException:exception]);
    }
}

- (void)addListener:(NSString *)eventName {
    // Event listener implementation
}

- (void)removeListeners:(double)count {
    // Remove listeners implementation
}

// Helper methods
- (void)loadConfiguration {
    NSBundle *mainBundle = [NSBundle mainBundle];
    self.config = @{
        @"deploymentKey": [mainBundle objectForInfoDictionaryKey:@"CodePushDeploymentKey"] ?: @"",
        @"serverUrl": [mainBundle objectForInfoDictionaryKey:@"CodePushServerURL"] ?: @"https://codepush.appcenter.ms/"
    };
}

- (NSString *)getAppVersion {
    return [[[NSBundle mainBundle] infoDictionary] objectForKey:@"CFBundleShortVersionString"] ?: @"1.0.0";
}

- (NSString *)getClientUniqueId {
    NSString *uuid = [self.settings stringForKey:@"clientUniqueId"];
    if (!uuid) {
        uuid = [[NSUUID UUID] UUIDString];
        [self.settings setObject:uuid forKey:@"clientUniqueId"];
    }
    return uuid;
}

- (NSString *)getDeploymentKey {
    return self.config[@"deploymentKey"];
}

- (NSString *)getServerUrl {
    return self.config[@"serverUrl"];
}

- (NSString *)getCurrentPackageHash {
    NSDictionary *currentPackage = [self.settings objectForKey:@"currentPackage"];
    return currentPackage[@"packageHash"];
}

- (BOOL)isPendingUpdate {
    NSDictionary *currentPackage = [self.settings objectForKey:@"currentPackage"];
    return currentPackage ? [currentPackage[@"isPending"] boolValue] : NO;
}

- (NSError *)createErrorFromException:(NSException *)exception {
    return [NSError errorWithDomain:@"ReactNativeCodePush" 
                               code:1 
                           userInfo:@{NSLocalizedDescriptionKey: exception.reason ?: @"Unknown error"}];
}

@end
