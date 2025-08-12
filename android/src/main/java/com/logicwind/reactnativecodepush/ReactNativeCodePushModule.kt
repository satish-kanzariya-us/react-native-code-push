package com.logicwind.reactnativecodepush

import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.turbomodule.core.interfaces.TurboModule
import android.content.Context
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.util.Log
import org.json.JSONObject
import org.json.JSONException
import java.util.UUID

@ReactModule(name = ReactNativeCodePushModule.NAME)
class ReactNativeCodePushModule(reactContext: ReactApplicationContext) :
    NativeReactNativeCodePushSpec(reactContext) {

    companion object {
        const val NAME = "ReactNativeCodePush"
        private const val LOG_TAG = "CodePush"
        
        // Install modes
        const val IMMEDIATE = 0
        const val ON_NEXT_RESTART = 1
        const val ON_NEXT_RESUME = 2
        const val ON_NEXT_SUSPEND = 3
        
        // Update states
        const val LATEST = 0
        const val PENDING = 1
        const val RUNNING = 2
        
        // Preferences
        const val CODE_PUSH_PREFERENCES = "CodePush"
        const val CURRENT_PACKAGE_KEY = "currentPackage"
        const val FAILED_UPDATES_KEY = "failedUpdates"
        const val CLIENT_UNIQUE_ID_KEY = "clientUniqueId"
        const val DEPLOYMENT_KEY_KEY = "deploymentKey"
        const val SERVER_URL_KEY = "serverUrl"
    }

    private val sharedPreferences: SharedPreferences = 
        reactContext.getSharedPreferences(CODE_PUSH_PREFERENCES, Context.MODE_PRIVATE)

    // Common logging function
    private fun logData(message: String, data: Any? = null) {
        val logMessage = if (data != null) {
            "$message | Data: $data"
        } else {
            message
        }
        Log.d(LOG_TAG, logMessage)
        println("[ReactNativeCodePushModule CodePush] $logMessage") // Also print to console for debugging
    }

    override fun getName(): String {
        logData("getName() called", NAME)
        return NAME
    }

    // Basic methods
    override fun multiply(a: Double, b: Double): Double {
        logData("multiply() called", "a=$a, b=$b")
        val result = a * b
        logData("multiply() result", result)
        return result
    }

    override fun helloWorld(promise: Promise) {
        logData("helloWorld() called")
        try {
            val message = "Hello from CodePush TurboModule!"
            logData("helloWorld() resolving", message)
            promise.resolve(message)
        } catch (e: Exception) {
            logData("helloWorld() error", e.message)
            promise.reject("ERROR", "Failed to say hello", e)
        }
    }

    override fun getValue(key: String, promise: Promise) {
        logData("getValue() called", "key=$key")
        try {
            val value = sharedPreferences.getString(key, "")
            logData("getValue() retrieved from SharedPreferences", "key=$key, value=$value")
            val result = "Value for $key: $value"
            logData("getValue() resolving", result)
            promise.resolve(result)
        } catch (e: Exception) {
            logData("getValue() error", "key=$key, error=${e.message}")
            promise.reject("ERROR", "Failed to get value", e)
        }
    }

    override fun getConfiguration(promise: Promise) {
        logData("getConfiguration() called")
        try {
            val appVersion = getAppVersion()
            val clientUniqueId = getClientUniqueId()
            val deploymentKey = getDeploymentKey()
            val serverUrl = getServerUrl()
            val packageHash = getCurrentPackageHash()
            
            logData("getConfiguration() gathered data", "appVersion=$appVersion, clientUniqueId=$clientUniqueId, deploymentKey=${deploymentKey.take(10)}..., serverUrl=$serverUrl, packageHash=$packageHash")
            
            val config = WritableNativeMap().apply {
                putString("appVersion", appVersion)
                putString("clientUniqueId", clientUniqueId)
                putString("deploymentKey", deploymentKey)
                putString("serverUrl", serverUrl)
                packageHash?.let { putString("packageHash", it) }
            }
            logData("getConfiguration() resolving", config.toString())
            promise.resolve(config)
        } catch (e: Exception) {
            logData("getConfiguration() error", e.message)
            promise.reject("ERROR", "Failed to get configuration", e)
        }
    }

    override fun getCurrentPackage(promise: Promise) {
        logData("getCurrentPackage() called")
        try {
            val currentPackageJson = sharedPreferences.getString(CURRENT_PACKAGE_KEY, null)
            logData("getCurrentPackage() retrieved from SharedPreferences", "packageJson=$currentPackageJson")
            
            if (currentPackageJson != null) {
                val currentPackage = JSONObject(currentPackageJson)
                logData("getCurrentPackage() parsed JSON", currentPackage.toString())
                
                val packageInfo = WritableNativeMap().apply {
                    putString("appVersion", currentPackage.optString("appVersion", ""))
                    putString("description", currentPackage.optString("description", ""))
                    putBoolean("failedInstall", currentPackage.optBoolean("failedInstall", false))
                    putBoolean("failedUpdate", currentPackage.optBoolean("failedUpdate", false))
                    putBoolean("isFirstRun", currentPackage.optBoolean("isFirstRun", true))
                    putBoolean("isPending", currentPackage.optBoolean("isPending", false))
                    putString("label", currentPackage.optString("label", ""))
                    putString("packageHash", currentPackage.optString("packageHash", ""))
                    putInt("packageSize", currentPackage.optInt("packageSize", 0))
                }
                logData("getCurrentPackage() resolving with package info", packageInfo.toString())
                promise.resolve(packageInfo)
            } else {
                logData("getCurrentPackage() resolving with null", "No current package found")
                promise.resolve(null)
            }
        } catch (e: Exception) {
            logData("getCurrentPackage() error", e.message)
            promise.reject("ERROR", "Failed to get current package", e)
        }
    }
    
    override fun downloadUpdate(
        updatePackage: ReadableMap,
        notifyProgress: Boolean,
        promise: Promise
    ) {
        logData("downloadUpdate() called", "updatePackage=$updatePackage, notifyProgress=$notifyProgress")
        try {
            val downloadUrl = updatePackage.getString("downloadUrl")
            val packageHash = updatePackage.getString("packageHash")
            val label = updatePackage.getString("label")
            val packageSize = updatePackage.getInt("packageSize")

            logData("downloadUpdate() extracted parameters", "downloadUrl=$downloadUrl, packageHash=$packageHash, label=$label, packageSize=$packageSize")

            if (downloadUrl == null || packageHash == null || label == null) {
                logData("downloadUpdate() parameter validation failed", "Missing required parameters")
                promise.reject("ERROR", "Invalid update package parameters")
                return
            }

            Thread {
                try {
                    logData("downloadUpdate() starting download", "URL: $downloadUrl")
                    val downloadedBytes = HttpUtils.downloadUpdate(downloadUrl) { bytesReceived, totalBytes ->
                        if (notifyProgress) {
                            logData("downloadUpdate() progress", "Received: $bytesReceived / Total: $totalBytes bytes")
                            // Send progress event to JS (implement event emitter if needed)
                        }
                    }
                    
                    logData("downloadUpdate() download completed", "Downloaded ${downloadedBytes.size} bytes")
                    
                    // Save downloaded package (implement file saving logic)
                    val success = saveDownloadedPackage(downloadedBytes, packageHash, label)
                    logData("downloadUpdate() save result", "Success: $success")
                    
                    if (success) {
                        val result = WritableNativeMap().apply {
                            putString("appVersion", getAppVersion())
                            putString("description", "Downloaded update")
                            putBoolean("failedInstall", false)
                            putBoolean("failedUpdate", false)
                            putBoolean("isFirstRun", false)
                            putBoolean("isPending", true)
                            putString("label", label)
                            putString("packageHash", packageHash)
                            putInt("packageSize", packageSize)
                        }
                        logData("downloadUpdate() resolving success", result.toString())
                        promise.resolve(result)
                    } else {
                        logData("downloadUpdate() save failed", "Failed to save downloaded package")
                        promise.reject("ERROR", "Failed to save downloaded package")
                    }
                } catch (e: Exception) {
                    logData("downloadUpdate() download error", "Error: ${e.message}")
                    promise.reject("DOWNLOAD_ERROR", "Failed to download update: ${e.message}", e)
                }
            }.start()
        } catch (e: Exception) {
            logData("downloadUpdate() general error", e.message)
            promise.reject("ERROR", "Failed to download update", e)
        }
    }
    
    private fun saveDownloadedPackage(data: ByteArray, packageHash: String, label: String): Boolean {
        logData("saveDownloadedPackage() called", "dataSize=${data.size} bytes, packageHash=$packageHash, label=$label")
        return try {
            // Implement file saving logic for your CodePush directory structure
            // This would typically involve:
            // 1. Creating a directory for the package
            // 2. Extracting the zip file
            // 3. Validating the package hash
            // 4. Storing metadata
            logData("saveDownloadedPackage() placeholder", "File saving logic not yet implemented")
            true // Placeholder
        } catch (e: Exception) {
            logData("saveDownloadedPackage() error", e.message)
            false
        }
    }

    override fun installUpdate(
        updatePackage: ReadableMap,
        installMode: Double,
        minimumBackgroundDuration: Double,
        promise: Promise
    ) {
        logData("installUpdate() called", "updatePackage=$updatePackage, installMode=$installMode, minimumBackgroundDuration=$minimumBackgroundDuration")
        try {
            val packageHash = updatePackage.getString("packageHash")
            val label = updatePackage.getString("label")
            
            logData("installUpdate() extracted parameters", "packageHash=$packageHash, label=$label")
            
            if (packageHash == null || label == null) {
                logData("installUpdate() parameter validation failed", "Missing required parameters")
                promise.reject("ERROR", "Invalid update package parameters")
                return
            }

            // Mock install - replace with actual install logic
            val success = true // Mock success
            logData("installUpdate() mock install result", "success=$success")
            
            if (success) {
                // Save package info
                val packageInfo = JSONObject().apply {
                    put("packageHash", packageHash)
                    put("label", label)
                    put("isPending", true)
                    put("installMode", installMode.toInt())
                }
                
                logData("installUpdate() saving package info", packageInfo.toString())
                
                sharedPreferences.edit()
                    .putString(CURRENT_PACKAGE_KEY, packageInfo.toString())
                    .apply()
                
                logData("installUpdate() package info saved successfully")
                promise.resolve(null)
            } else {
                logData("installUpdate() install failed")
                promise.reject("ERROR", "Failed to install update")
            }
        } catch (e: Exception) {
            logData("installUpdate() error", e.message)
            promise.reject("ERROR", "Failed to install update", e)
        }
    }

    override fun notifyApplicationReady(promise: Promise) {
        logData("notifyApplicationReady() called")
        try {
            val currentPackageJson = sharedPreferences.getString(CURRENT_PACKAGE_KEY, null)
            logData("notifyApplicationReady() current package", currentPackageJson ?: "null")
            
            if (currentPackageJson != null) {
                val currentPackage = JSONObject(currentPackageJson)
                currentPackage.put("isFirstRun", false)
                currentPackage.put("isPending", false)
                
                logData("notifyApplicationReady() updating package status", currentPackage.toString())
                
                sharedPreferences.edit()
                    .putString(CURRENT_PACKAGE_KEY, currentPackage.toString())
                    .apply()
                
                logData("notifyApplicationReady() package status updated")
            }
            logData("notifyApplicationReady() resolving")
            promise.resolve(null)
        } catch (e: Exception) {
            logData("notifyApplicationReady() error", e.message)
            promise.reject("ERROR", "Failed to notify application ready", e)
        }
    }

    override fun restartApp(onlyIfUpdateIsPending: Boolean?, promise: Promise) {
        logData("restartApp() called", "onlyIfUpdateIsPending=$onlyIfUpdateIsPending")
        try {
            val isPending = isPendingUpdate()
            val shouldRestart = onlyIfUpdateIsPending != true || isPending
            logData("restartApp() decision", "isPending=$isPending, shouldRestart=$shouldRestart")
            
            if (shouldRestart) {
                logData("restartApp() restart requested")
                // Mock restart - in real implementation, this would restart React Native
                promise.resolve("App restart requested")
            } else {
                logData("restartApp() restart skipped", "No pending update")
                promise.resolve("No pending update, restart not needed")
            }
        } catch (e: Exception) {
            logData("restartApp() error", e.message)
            promise.reject("ERROR", "Failed to restart app", e)
        }
    }

    override fun clearPendingRestart(promise: Promise) {
        logData("clearPendingRestart() called")
        try {
            val currentPackageJson = sharedPreferences.getString(CURRENT_PACKAGE_KEY, null)
            logData("clearPendingRestart() current package", currentPackageJson ?: "null")
            
            if (currentPackageJson != null) {
                val currentPackage = JSONObject(currentPackageJson)
                currentPackage.put("isPending", false)
                
                logData("clearPendingRestart() clearing pending status", currentPackage.toString())
                
                sharedPreferences.edit()
                    .putString(CURRENT_PACKAGE_KEY, currentPackage.toString())
                    .apply()
                
                logData("clearPendingRestart() pending status cleared")
            }
            promise.resolve(null)
        } catch (e: Exception) {
            logData("clearPendingRestart() error", e.message)
            promise.reject("ERROR", "Failed to clear pending restart", e)
        }
    }

    override fun isFailedUpdate(packageHash: String, promise: Promise) {
        logData("isFailedUpdate() called", "packageHash=$packageHash")
        try {
            val failedUpdates = sharedPreferences.getStringSet(FAILED_UPDATES_KEY, emptySet())
            val isFailed = failedUpdates?.contains(packageHash) ?: false
            logData("isFailedUpdate() result", "isFailed=$isFailed, failedUpdates=$failedUpdates")
            promise.resolve(isFailed)
        } catch (e: Exception) {
            logData("isFailedUpdate() error", e.message)
            promise.reject("ERROR", "Failed to check if update failed", e)
        }
    }

    override fun getLatestRollbackInfo(promise: Promise) {
        logData("getLatestRollbackInfo() called")
        try {
            // Mock implementation - replace with actual rollback logic
            logData("getLatestRollbackInfo() mock implementation", "Returning null")
            promise.resolve(null)
        } catch (e: Exception) {
            logData("getLatestRollbackInfo() error", e.message)
            promise.reject("ERROR", "Failed to get rollback info", e)
        }
    }

    override fun setLatestRollbackInfo(packageHash: String, promise: Promise) {
        logData("setLatestRollbackInfo() called", "packageHash=$packageHash")
        try {
            // Mock implementation - replace with actual rollback logic
            logData("setLatestRollbackInfo() mock implementation", "Not implemented yet")
            promise.resolve(null)
        } catch (e: Exception) {
            logData("setLatestRollbackInfo() error", e.message)
            promise.reject("ERROR", "Failed to set rollback info", e)
        }
    }

    override fun isFirstRun(packageHash: String, promise: Promise) {
        logData("isFirstRun() called", "packageHash=$packageHash")
        try {
            val currentPackageJson = sharedPreferences.getString(CURRENT_PACKAGE_KEY, null)
            logData("isFirstRun() current package", currentPackageJson ?: "null")
            
            if (currentPackageJson != null) {
                val currentPackage = JSONObject(currentPackageJson)
                val isFirstRun = currentPackage.optBoolean("isFirstRun", true)
                logData("isFirstRun() result from package", "isFirstRun=$isFirstRun")
                promise.resolve(isFirstRun)
            } else {
                logData("isFirstRun() result default", "isFirstRun=true (no package found)")
                promise.resolve(true)
            }
        } catch (e: Exception) {
            logData("isFirstRun() error", e.message)
            promise.reject("ERROR", "Failed to check if first run", e)
        }
    }

    override fun allowRestart(promise: Promise) {
        logData("allowRestart() called")
        try {
            sharedPreferences.edit().putBoolean("restartAllowed", true).apply()
            logData("allowRestart() restart allowed")
            promise.resolve(null)
        } catch (e: Exception) {
            logData("allowRestart() error", e.message)
            promise.reject("ERROR", "Failed to allow restart", e)
        }
    }

    override fun disallowRestart(promise: Promise) {
        logData("disallowRestart() called")
        try {
            sharedPreferences.edit().putBoolean("restartAllowed", false).apply()
            logData("disallowRestart() restart disallowed")
            promise.resolve(null)
        } catch (e: Exception) {
            logData("disallowRestart() error", e.message)
            promise.reject("ERROR", "Failed to disallow restart", e)
        }
    }

    override fun getUpdateMetadata(updateState: Double, promise: Promise) {
        logData("getUpdateMetadata() called", "updateState=$updateState")
        try {
            // Mock implementation - replace with actual metadata logic
            logData("getUpdateMetadata() mock implementation", "Returning null")
            promise.resolve(null)
        } catch (e: Exception) {
            logData("getUpdateMetadata() error", e.message)
            promise.reject("ERROR", "Failed to get update metadata", e)
        }
    }

    override fun addListener(eventName: String) {
        logData("addListener() called", "eventName=$eventName")
        // Event listener implementation
    }

    override fun removeListeners(count: Double) {
        logData("removeListeners() called", "count=$count")
        // Remove listeners implementation
    }

    // Helper methods
    private fun getAppVersion(): String {
        logData("getAppVersion() called")
        return try {
            val packageInfo = reactApplicationContext.packageManager
                .getPackageInfo(reactApplicationContext.packageName, 0)
            val version = packageInfo.versionName ?: "1.0.0"
            logData("getAppVersion() result", "version=$version")
            version
        } catch (e: PackageManager.NameNotFoundException) {
            logData("getAppVersion() error", "PackageManager error, using default version")
            "1.0.0"
        }
    }
    
    private fun getClientUniqueId(): String {
        logData("getClientUniqueId() called")
        var uuid = sharedPreferences.getString(CLIENT_UNIQUE_ID_KEY, null)
        if (uuid == null) {
            uuid = UUID.randomUUID().toString()
            sharedPreferences.edit().putString(CLIENT_UNIQUE_ID_KEY, uuid).apply()
            logData("getClientUniqueId() generated new UUID", "uuid=${uuid.take(8)}...")
        } else {
            logData("getClientUniqueId() retrieved existing UUID", "uuid=${uuid.take(8)}...")
        }
        return uuid
    }
    
    private fun getDeploymentKey(): String {
        logData("getDeploymentKey() called")
        // Try to get from SharedPreferences first
        var key = sharedPreferences.getString(DEPLOYMENT_KEY_KEY, null)
        logData("getDeploymentKey() from SharedPreferences", "key=${key?.take(10)}...")
        
        if (key.isNullOrEmpty()) {
            // Try to get from app resources (strings.xml)
            try {
                val resourceId = reactApplicationContext.resources.getIdentifier(
                    "CodePushDeploymentKey", "string", reactApplicationContext.packageName
                )
                if (resourceId != 0) {
                    key = reactApplicationContext.getString(resourceId)
                    logData("getDeploymentKey() from resources", "key=${key?.take(10)}...")
                }
            } catch (e: Exception) {
                logData("getDeploymentKey() resource error", e.message)
            }
        }
        
        val result = key ?: ""
        logData("getDeploymentKey() final result", "key=${result.take(10)}...")
        return result
    }
    
    private fun getServerUrl(): String {
        logData("getServerUrl() called")
        var url = sharedPreferences.getString(SERVER_URL_KEY, null)
        logData("getServerUrl() from SharedPreferences", "url=$url")
        
        if (url.isNullOrEmpty()) {
            try {
                val resourceId = reactApplicationContext.resources.getIdentifier(
                    "CodePushServerUrl", "string", reactApplicationContext.packageName
                )
                if (resourceId != 0) {
                    url = reactApplicationContext.getString(resourceId)
                    logData("getServerUrl() from resources", "url=$url")
                }
            } catch (e: Exception) {
                logData("getServerUrl() resource error", e.message)
            }
        }
        
        val result = url ?: "https://codepush.appcenter.ms/"
        logData("getServerUrl() final result", "url=$result")
        return result
    }

    private fun getCurrentPackageHash(): String? {
        logData("getCurrentPackageHash() called")
        val currentPackageJson = sharedPreferences.getString(CURRENT_PACKAGE_KEY, null)
        return if (currentPackageJson != null) {
            try {
                val hash = JSONObject(currentPackageJson).optString("packageHash", null)
                logData("getCurrentPackageHash() result", "hash=$hash")
                hash
            } catch (e: JSONException) {
                logData("getCurrentPackageHash() JSON error", e.message)
                null
            }
        } else {
            logData("getCurrentPackageHash() result", "hash=null (no package found)")
            null
        }
    }
    
    private fun isPendingUpdate(): Boolean {
        logData("isPendingUpdate() called")
        val currentPackageJson = sharedPreferences.getString(CURRENT_PACKAGE_KEY, null)
        return if (currentPackageJson != null) {
            try {
                val isPending = JSONObject(currentPackageJson).optBoolean("isPending", false)
                logData("isPendingUpdate() result", "isPending=$isPending")
                isPending
            } catch (e: JSONException) {
                logData("isPendingUpdate() JSON error", e.message)
                false
            }
        } else {
            logData("isPendingUpdate() result", "isPending=false (no package found)")
            false
        }
    }
}
