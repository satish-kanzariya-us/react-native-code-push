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
import org.json.JSONArray
import java.util.UUID
import java.io.File
import java.io.IOException
import java.util.Date

@ReactModule(name = ReactNativeCodePushModule.NAME)
class ReactNativeCodePushModule(reactContext: ReactApplicationContext) :
    NativeReactNativeCodePushSpec(reactContext) {

    companion object {
        const val NAME = "ReactNativeCodePush"
        
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
        const val PENDING_UPDATE_KEY = "pendingUpdate"
        const val PENDING_UPDATE_HASH_KEY = "hash"
        const val PENDING_UPDATE_IS_LOADING_KEY = "isLoading"
        const val PACKAGE_HASH_KEY = "packageHash"
        const val LATEST_ROLLBACK_INFO_KEY = "latestRollbackInfo"
        const val LATEST_ROLLBACK_PACKAGE_HASH_KEY = "packageHash"
        const val LATEST_ROLLBACK_TIME_KEY = "time"
        const val LATEST_ROLLBACK_COUNT_KEY = "count"
        const val LAST_DEPLOYMENT_REPORT_KEY = "CODE_PUSH_LAST_DEPLOYMENT_REPORT"
        const val RETRY_DEPLOYMENT_REPORT_KEY = "CODE_PUSH_RETRY_DEPLOYMENT_REPORT"
    }

    private val sharedPreferences: SharedPreferences = 
        reactContext.getSharedPreferences(CODE_PUSH_PREFERENCES, Context.MODE_PRIVATE)
    
    private val codePushDirectory: File = File(reactContext.filesDir, "CodePush")

    init {
        // Ensure CodePush directory exists
        if (!codePushDirectory.exists()) {
            codePushDirectory.mkdirs()
        }
    }

    // Common logging function
    private fun logData(message: String, data: Any? = null) {
        val logMessage = if (data != null) {
            "$message | Data: $data"
        } else {
            message
        }
        Log.d("CodePush", logMessage)
        println("[ReactNativeCodePushModule CodePush] $logMessage")
    }

    override fun getName(): String {
        logData("getName() called", NAME)
        return NAME
    }

    override fun getValue(key: String, promise: Promise) {
        logData("getValue() called", "key=$key")
        try {
            val value = sharedPreferences.getString(key, "")
            promise.resolve("Value for $key: $value")
        } catch (e: Exception) {
            logData("getValue() error", e.message)
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

    // ✅ FIXED: Proper getUpdateMetadata implementation
    override fun getUpdateMetadata(updateState: Double, promise: Promise) {
        logData("getUpdateMetadata() called", "updateState=$updateState")
        try {
            val currentPackageJson = sharedPreferences.getString(CURRENT_PACKAGE_KEY, null)
            
            if (currentPackageJson == null) {
                logData("getUpdateMetadata() no current package")
                promise.resolve(null)
                return
            }

            val currentPackage = JSONObject(currentPackageJson)
            val currentHash = currentPackage.optString(PACKAGE_HASH_KEY, null)
            val currentUpdateIsPending = isPendingUpdate(currentHash)

            when (updateState.toInt()) {
                PENDING -> {
                    if (!currentUpdateIsPending) {
                        logData("getUpdateMetadata() no pending update")
                        promise.resolve(null)
                        return
                    }
                }
                RUNNING -> {
                    if (currentUpdateIsPending) {
                        // Return previous package if current is pending
                        val previousPackageJson = sharedPreferences.getString("previousPackage", null)
                        if (previousPackageJson != null) {
                            val previousPackage = JSONObject(previousPackageJson)
                            promise.resolve(convertJsonToWritableMap(previousPackage))
                            return
                        } else {
                            promise.resolve(null)
                            return
                        }
                    }
                }
                LATEST -> {
                    // Return current package regardless of pending status
                }
            }

            // Add pending status and debug info
            currentPackage.put("isPending", currentUpdateIsPending)
            if (isRunningBinaryVersion()) {
                currentPackage.put("_isDebugOnly", true)
            }

            logData("getUpdateMetadata() returning package", currentPackage.toString())
            promise.resolve(convertJsonToWritableMap(currentPackage))

        } catch (e: Exception) {
            logData("getUpdateMetadata() error", e.message)
            promise.reject("ERROR", "Failed to get update metadata", e)
        }
    }

    // ✅ NEW: Status reporting system
    override fun getNewStatusReport(promise: Promise) {
        logData("getNewStatusReport() called")
        try {
            // Check if we need to report rollback
            val needToReportRollback = sharedPreferences.getBoolean("needToReportRollback", false)
            
            if (needToReportRollback) {
                sharedPreferences.edit().putBoolean("needToReportRollback", false).apply()
                val failedUpdates = getFailedUpdates()
                
                if (failedUpdates.length() > 0) {
                    val lastFailedPackage = failedUpdates.getJSONObject(failedUpdates.length() - 1)
                    val rollbackReport = createRollbackReport(lastFailedPackage)
                    logData("getNewStatusReport() returning rollback report")
                    promise.resolve(convertJsonToWritableMap(rollbackReport))
                    return
                }
            }
            
            // Check if we did update
            val didUpdate = sharedPreferences.getBoolean("didUpdate", false)
            if (didUpdate) {
                val currentPackageJson = sharedPreferences.getString(CURRENT_PACKAGE_KEY, null)
                if (currentPackageJson != null) {
                    val currentPackage = JSONObject(currentPackageJson)
                    val updateReport = createUpdateReport(currentPackage)
                    logData("getNewStatusReport() returning update report")
                    promise.resolve(convertJsonToWritableMap(updateReport))
                    return
                }
            }
            
            // Check if running binary version
            if (isRunningBinaryVersion()) {
                val appVersion = getAppVersion()
                val binaryReport = createBinaryUpdateReport(appVersion)
                if (binaryReport != null) {
                    logData("getNewStatusReport() returning binary report")
                    promise.resolve(convertJsonToWritableMap(binaryReport))
                    return
                }
            }
            
            // Check for retry status report
            val retryReportString = sharedPreferences.getString(RETRY_DEPLOYMENT_REPORT_KEY, null)
            if (retryReportString != null) {
                clearRetryStatusReport()
                val retryReport = JSONObject(retryReportString)
                logData("getNewStatusReport() returning retry report")
                promise.resolve(convertJsonToWritableMap(retryReport))
                return
            }
            
            logData("getNewStatusReport() no status report")
            promise.resolve("")
        } catch (e: Exception) {
            logData("getNewStatusReport() error", e.message)
            promise.reject("ERROR", "Failed to get status report", e)
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
                logData("downloadUpdate() parameter validation failed")
                promise.reject("ERROR", "Invalid update package parameters")
                return
            }

            Thread {
                try {
                    logData("downloadUpdate() starting download", "URL: $downloadUrl")
                    val downloadedBytes = HttpUtils.downloadUpdate(downloadUrl) { bytesReceived, totalBytes ->
                        if (notifyProgress) {
                            logData("downloadUpdate() progress", "Received: $bytesReceived / Total: $totalBytes bytes")
                        }
                    }
                    
                    logData("downloadUpdate() download completed", "Downloaded ${downloadedBytes.size} bytes")
                    
                    // Save downloaded package
                    val success = saveDownloadedPackage(downloadedBytes, packageHash, label, updatePackage)
                    logData("downloadUpdate() save result", "Success: $success")
                    
                    if (success) {
                        // Return the saved package info
                        val savedPackage = getPackageByHash(packageHash)
                        if (savedPackage != null) {
                            promise.resolve(convertJsonToWritableMap(savedPackage))
                        } else {
                            promise.reject("ERROR", "Failed to retrieve saved package")
                        }
                    } else {
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
            
            if (packageHash == null || label == null) {
                promise.reject("ERROR", "Invalid update package parameters")
                return
            }

            // Save as current package
            val packageJson = convertReadableMapToJson(updatePackage)
            sharedPreferences.edit()
                .putString(CURRENT_PACKAGE_KEY, packageJson.toString())
                .apply()
            
            // Mark as pending
            savePendingUpdate(packageHash, false)
            
            logData("installUpdate() package installed successfully")
            promise.resolve("")
        } catch (e: Exception) {
            logData("installUpdate() error", e.message)
            promise.reject("ERROR", "Failed to install update", e)
        }
    }

    override fun notifyApplicationReady(promise: Promise) {
        logData("notifyApplicationReady() called")
        try {
            // Remove pending update status
            removePendingUpdate()
            logData("notifyApplicationReady() removed pending update status")
            promise.resolve("")
        } catch (e: Exception) {
            logData("notifyApplicationReady() error", e.message)
            promise.reject("ERROR", "Failed to notify application ready", e)
        }
    }

    override fun restartApp(onlyIfUpdateIsPending: Boolean?, promise: Promise) {
        logData("restartApp() called", "onlyIfUpdateIsPending=$onlyIfUpdateIsPending")
        try {
            val isPending = isPendingUpdate(null)
            val shouldRestart = onlyIfUpdateIsPending != true || isPending
            logData("restartApp() decision", "isPending=$isPending, shouldRestart=$shouldRestart")
            
            if (shouldRestart) {
                logData("restartApp() restart requested")
                promise.resolve("App restart requested")
            } else {
                logData("restartApp() restart skipped")
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
            if (currentPackageJson != null) {
                val currentPackage = JSONObject(currentPackageJson)
                currentPackage.put("isPending", false)
                
                sharedPreferences.edit()
                    .putString(CURRENT_PACKAGE_KEY, currentPackage.toString())
                    .apply()
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
            val isFailed = isFailedHash(packageHash)
            logData("isFailedUpdate() result", "isFailed=$isFailed")
            promise.resolve(isFailed)
        } catch (e: Exception) {
            logData("isFailedUpdate() error", e.message)
            promise.reject("ERROR", "Failed to check if update failed", e)
        }
    }

    override fun getLatestRollbackInfo(promise: Promise) {
        logData("getLatestRollbackInfo() called")
        try {
            val rollbackInfoString = sharedPreferences.getString(LATEST_ROLLBACK_INFO_KEY, null)
            if (rollbackInfoString != null) {
                val rollbackInfo = JSONObject(rollbackInfoString)
                promise.resolve(convertJsonToWritableMap(rollbackInfo))
            } else {
                promise.resolve(null)
            }
        } catch (e: Exception) {
            logData("getLatestRollbackInfo() error", e.message)
            promise.reject("ERROR", "Failed to get rollback info", e)
        }
    }

    override fun setLatestRollbackInfo(packageHash: String, promise: Promise) {
        logData("setLatestRollbackInfo() called", "packageHash=$packageHash")
        try {
            val existingRollbackInfo = sharedPreferences.getString(LATEST_ROLLBACK_INFO_KEY, null)
            var count = 0
            
            if (existingRollbackInfo != null) {
                val existing = JSONObject(existingRollbackInfo)
                val existingHash = existing.optString(LATEST_ROLLBACK_PACKAGE_HASH_KEY, "")
                if (existingHash == packageHash) {
                    count = existing.optInt(LATEST_ROLLBACK_COUNT_KEY, 0)
                }
            }
            
            val rollbackInfo = JSONObject().apply {
                put(LATEST_ROLLBACK_PACKAGE_HASH_KEY, packageHash)
                put(LATEST_ROLLBACK_TIME_KEY, System.currentTimeMillis())
                put(LATEST_ROLLBACK_COUNT_KEY, count + 1)
            }
            
            sharedPreferences.edit()
                .putString(LATEST_ROLLBACK_INFO_KEY, rollbackInfo.toString())
                .apply()
            
            promise.resolve(null)
        } catch (e: Exception) {
            logData("setLatestRollbackInfo() error", e.message)
            promise.reject("ERROR", "Failed to set rollback info", e)
        }
    }

    override fun isFirstRun(packageHash: String, promise: Promise) {
        logData("isFirstRun() called", "packageHash=$packageHash")
        try {
            val didUpdate = sharedPreferences.getBoolean("didUpdate", false)
            val currentHash = getCurrentPackageHash()
            val isFirstRun = didUpdate && packageHash == currentHash
            
            logData("isFirstRun() result", "isFirstRun=$isFirstRun")
            promise.resolve(isFirstRun)
        } catch (e: Exception) {
            logData("isFirstRun() error", e.message)
            promise.reject("ERROR", "Failed to check if first run", e)
        }
    }

    override fun allowRestart(promise: Promise) {
        logData("allowRestart() called")
        try {
            sharedPreferences.edit().putBoolean("restartAllowed", true).apply()
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
            promise.resolve(null)
        } catch (e: Exception) {
            logData("disallowRestart() error", e.message)
            promise.reject("ERROR", "Failed to disallow restart", e)
        }
    }

    // ✅ NEW: Status reporting methods
    override fun recordStatusReported(statusReport: ReadableMap) {
        logData("recordStatusReported() called")
        try {
            // Don't record rollback reports
            val status = statusReport.getString("status")
            if (status == "DeploymentFailed") {
                return
            }
            
            val appVersion = statusReport.getString("appVersion")
            val packageMap = statusReport.getMap("package")
            
            val identifier = if (appVersion != null) {
                appVersion
            } else if (packageMap != null) {
                getPackageStatusReportIdentifier(packageMap)
            } else {
                null
            }
            
            if (identifier != null) {
                sharedPreferences.edit()
                    .putString(LAST_DEPLOYMENT_REPORT_KEY, identifier)
                    .apply()
                logData("recordStatusReported() saved identifier", identifier)
            }
        } catch (e: Exception) {
            logData("recordStatusReported() error", e.message)
        }
    }

    override fun saveStatusReportForRetry(statusReport: ReadableMap) {
        logData("saveStatusReportForRetry() called")
        try {
            val statusReportJson = convertReadableMapToJson(statusReport)
            sharedPreferences.edit()
                .putString(RETRY_DEPLOYMENT_REPORT_KEY, statusReportJson.toString())
                .apply()
            logData("saveStatusReportForRetry() saved for retry")
        } catch (e: Exception) {
            logData("saveStatusReportForRetry() error", e.message)
        }
    }

    // ✅ NEW: Clear updates functionality
    override fun clearUpdates(promise: Promise) {
        logData("clearUpdates() called")
        try {
            // Clear all CodePush related data
            sharedPreferences.edit()
                .remove(CURRENT_PACKAGE_KEY)
                .remove(PENDING_UPDATE_KEY)
                .remove(FAILED_UPDATES_KEY)
                .remove("previousPackage")
                .remove("didUpdate")
                .remove("needToReportRollback")
                .apply()
            
            // Clear CodePush directory
            if (codePushDirectory.exists()) {
                codePushDirectory.deleteRecursively()
                codePushDirectory.mkdirs()
            }
            
            logData("clearUpdates() completed")
            promise.resolve(null)
        } catch (e: Exception) {
            logData("clearUpdates() error", e.message)
            promise.reject("ERROR", "Failed to clear updates", e)
        }
    }

    override fun addListener(eventName: String) {
        logData("addListener() called", "eventName=$eventName")
    }

    override fun removeListeners(count: Double) {
        logData("removeListeners() called", "count=$count")
    }

    // ============ HELPER METHODS ============

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
        var key = sharedPreferences.getString(DEPLOYMENT_KEY_KEY, null)
        logData("getDeploymentKey() from SharedPreferences", "key=${key?.take(10)}...")
        
        if (key.isNullOrEmpty()) {
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
                val hash = JSONObject(currentPackageJson).optString(PACKAGE_HASH_KEY, null)
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
    
    private fun isPendingUpdate(packageHash: String?): Boolean {
        val pendingUpdateString = sharedPreferences.getString(PENDING_UPDATE_KEY, null)
        return if (pendingUpdateString != null) {
            try {
                val pendingUpdate = JSONObject(pendingUpdateString)
                val isLoading = pendingUpdate.optBoolean(PENDING_UPDATE_IS_LOADING_KEY, true)
                val pendingHash = pendingUpdate.optString(PENDING_UPDATE_HASH_KEY, null)
                
                !isLoading && (packageHash == null || pendingHash == packageHash)
            } catch (e: JSONException) {
                false
            }
        } else {
            false
        }
    }

    private fun isRunningBinaryVersion(): Boolean {
        // This would check if we're running the original binary version vs a CodePush update
        // For now, return false - implement based on your bundle management
        return getCurrentPackageHash() == null
    }

    private fun saveDownloadedPackage(data: ByteArray, packageHash: String, label: String, updatePackage: ReadableMap): Boolean {
        logData("saveDownloadedPackage() called", "dataSize=${data.size} bytes, packageHash=$packageHash, label=$label")
        return try {
            // Create package directory
            val packageDir = File(codePushDirectory, packageHash)
            if (!packageDir.exists()) {
                packageDir.mkdirs()
            }
            
            // Save the zip file
            val zipFile = File(packageDir, "update.zip")
            zipFile.writeBytes(data)
            
            // Save package metadata
            val packageJson = convertReadableMapToJson(updatePackage).apply {
                put("packageHash", packageHash)
                put("label", label)
                put("packageSize", data.size)
                put("downloadTime", System.currentTimeMillis())
            }
            
            val metadataFile = File(packageDir, "metadata.json")
            metadataFile.writeText(packageJson.toString())
            
            logData("saveDownloadedPackage() success", "Package saved to ${packageDir.absolutePath}")
            true
        } catch (e: Exception) {
            logData("saveDownloadedPackage() error", e.message)
            false
        }
    }

    private fun getPackageByHash(packageHash: String): JSONObject? {
        return try {
            val packageDir = File(codePushDirectory, packageHash)
            val metadataFile = File(packageDir, "metadata.json")
            
            if (metadataFile.exists()) {
                val metadata = metadataFile.readText()
                JSONObject(metadata)
            } else {
                null
            }
        } catch (e: Exception) {
            null
        }
    }

    private fun savePendingUpdate(packageHash: String, isLoading: Boolean) {
        val pendingUpdate = JSONObject().apply {
            put(PENDING_UPDATE_HASH_KEY, packageHash)
            put(PENDING_UPDATE_IS_LOADING_KEY, isLoading)
        }
        
        sharedPreferences.edit()
            .putString(PENDING_UPDATE_KEY, pendingUpdate.toString())
            .apply()
    }

    private fun removePendingUpdate() {
        sharedPreferences.edit()
            .remove(PENDING_UPDATE_KEY)
            .apply()
    }

    private fun getFailedUpdates(): JSONArray {
        val failedUpdatesString = sharedPreferences.getString(FAILED_UPDATES_KEY, null)
        return if (failedUpdatesString != null) {
            try {
                JSONArray(failedUpdatesString)
            } catch (e: JSONException) {
                JSONArray()
            }
        } else {
            JSONArray()
        }
    }

    private fun isFailedHash(packageHash: String): Boolean {
        val failedUpdates = getFailedUpdates()
        for (i in 0 until failedUpdates.length()) {
            try {
                val failedPackage = failedUpdates.getJSONObject(i)
                val failedHash = failedPackage.getString(PACKAGE_HASH_KEY)
                if (packageHash == failedHash) {
                    return true
                }
            } catch (e: JSONException) {
                continue
            }
        }
        return false
    }

    private fun clearRetryStatusReport() {
        sharedPreferences.edit()
            .remove(RETRY_DEPLOYMENT_REPORT_KEY)
            .apply()
    }

    // Status report creators
    private fun createRollbackReport(failedPackage: JSONObject): JSONObject {
        return JSONObject().apply {
            put("package", failedPackage)
            put("status", "DeploymentFailed")
        }
    }

    private fun createUpdateReport(currentPackage: JSONObject): JSONObject {
        return JSONObject().apply {
            put("package", currentPackage)
            put("status", "DeploymentSucceeded")
        }
    }

    private fun createBinaryUpdateReport(appVersion: String): JSONObject? {
        val previousStatusReportIdentifier = sharedPreferences.getString(LAST_DEPLOYMENT_REPORT_KEY, null)
        
        return if (previousStatusReportIdentifier == null) {
            clearRetryStatusReport()
            JSONObject().apply {
                put("appVersion", appVersion)
            }
        } else if (previousStatusReportIdentifier != appVersion) {
            clearRetryStatusReport()
            JSONObject().apply {
                put("appVersion", appVersion)
                put("previousLabelOrAppVersion", previousStatusReportIdentifier)
            }
        } else {
            null
        }
    }

    private fun getPackageStatusReportIdentifier(packageMap: ReadableMap): String? {
        val deploymentKey = packageMap.getString("deploymentKey")
        val label = packageMap.getString("label")
        
        return if (deploymentKey != null && label != null) {
            "$deploymentKey:$label"
        } else {
            null
        }
    }

    // Utility methods for JSON conversion
    private fun convertJsonToWritableMap(json: JSONObject): WritableMap {
        val map = WritableNativeMap()
        val iterator = json.keys()
        
        while (iterator.hasNext()) {
            val key = iterator.next()
            val value = json.get(key)
            
            when (value) {
                is String -> map.putString(key, value)
                is Int -> map.putInt(key, value)
                is Long -> map.putDouble(key, value.toDouble())
                is Double -> map.putDouble(key, value)
                is Boolean -> map.putBoolean(key, value)
                is JSONObject -> map.putMap(key, convertJsonToWritableMap(value))
                is JSONArray -> {
                    // Handle arrays if needed
                    map.putString(key, value.toString())
                }
                else -> map.putString(key, value.toString())
            }
        }
        
        return map
    }

    private fun convertReadableMapToJson(readableMap: ReadableMap): JSONObject {
        val json = JSONObject()
        val iterator = readableMap.keySetIterator()
        
        while (iterator.hasNextKey()) {
            val key = iterator.nextKey()
            val type = readableMap.getType(key)
            
            when (type) {
                ReadableType.String -> json.put(key, readableMap.getString(key))
                ReadableType.Number -> json.put(key, readableMap.getDouble(key))
                ReadableType.Boolean -> json.put(key, readableMap.getBoolean(key))
                ReadableType.Map -> {
                    val nestedMap = readableMap.getMap(key)
                    if (nestedMap != null) {
                        json.put(key, convertReadableMapToJson(nestedMap))
                    }
                }
                ReadableType.Array -> {
                    // Handle arrays if needed
                    json.put(key, readableMap.getArray(key).toString())
                }
                else -> json.put(key, null)
            }
        }
        
        return json
    }
}
