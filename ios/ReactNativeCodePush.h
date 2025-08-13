// #import <React/RCTBridgeModule.h>
// #import <ReactCommon/RCTTurboModule.h>
// #import <ReactNativeCodePushSpec/ReactNativeCodePushSpec.h>

// @interface ReactNativeCodePush : NSObject <NativeReactNativeCodePushSpec>
// @end



// ReactNativeCodePush.h

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>  // ✅ ADD: Import RCTEventEmitter

#ifdef RCT_NEW_ARCH_ENABLED
#import "ReactNativeCodePushSpec.h"

@interface ReactNativeCodePush : RCTEventEmitter <NativeReactNativeCodePushSpec>  // ✅ FIX: Inherit from RCTEventEmitter
#else
@interface ReactNativeCodePush : RCTEventEmitter <RCTBridgeModule>               // ✅ FIX: Inherit from RCTEventEmitter
#endif

@end