// #import <React/RCTBridgeModule.h>
// #import <ReactCommon/RCTTurboModule.h>
// #import <ReactNativeCodePushSpec/ReactNativeCodePushSpec.h>

// @interface ReactNativeCodePush : NSObject <NativeReactNativeCodePushSpec>
// @end



#import <React/RCTBridgeModule.h>
#import <ReactCommon/RCTTurboModule.h>

#ifdef RCT_NEW_ARCH_ENABLED
#import "ReactNativeCodePushSpec.h"

@interface ReactNativeCodePush : NSObject <NativeReactNativeCodePushSpec>
#else
@interface ReactNativeCodePush : NSObject <RCTBridgeModule>
#endif

@end