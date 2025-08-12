package com.logicwind.reactnativecodepush

import android.util.Log
import okhttp3.*
import java.io.IOException
import java.util.concurrent.TimeUnit

class HttpUtils {
    companion object {
        private const val LOG_TAG = "CodePushHttp"
        private const val CONNECT_TIMEOUT = 30L
        private const val READ_TIMEOUT = 60L
        private const val WRITE_TIMEOUT = 60L
        
        private const val USER_AGENT_HEADER = "CodePush/1.0 (ReactNative)"
        
        private val client by lazy {
            logHttp("OkHttpClient initialization", "Creating HTTP client for downloads")
            OkHttpClient.Builder()
                .connectTimeout(CONNECT_TIMEOUT, TimeUnit.SECONDS)
                .readTimeout(READ_TIMEOUT, TimeUnit.SECONDS)
                .writeTimeout(WRITE_TIMEOUT, TimeUnit.SECONDS)
                .build()
        }
        
        private fun logHttp(operation: String, data: Any? = null) {
            val logMessage = if (data != null) {
                "$operation | $data"
            } else {
                operation
            }
            Log.d(LOG_TAG, logMessage)
            println("[CodePushHttp] $logMessage")
        }
        
        fun downloadUpdate(
            downloadUrl: String,
            onProgress: ((bytesReceived: Long, totalBytes: Long) -> Unit)? = null
        ): ByteArray {
            logHttp("downloadUpdate() called", "downloadUrl=$downloadUrl, hasProgressCallback=${onProgress != null}")
            
            try {
                val request = Request.Builder()
                    .url(downloadUrl)
                    .addHeader("Accept", "*/*")
                    .addHeader("User-Agent", USER_AGENT_HEADER)
                    .build()
                
                logHttp("downloadUpdate() request created", "headers=${request.headers}, method=${request.method}")
                logHttp("downloadUpdate() starting download", "Making GET request to download URL")
                
                val startTime = System.currentTimeMillis()
                client.newCall(request).execute().use { response ->
                    val responseTime = System.currentTimeMillis() - startTime
                    
                    logHttp("downloadUpdate() response received", "statusCode=${response.code}, message=${response.message}, responseTime=${responseTime}ms")
                    
                    if (!response.isSuccessful) {
                        val errorMsg = "HTTP ${response.code}: ${response.message}"
                        logHttp("downloadUpdate() HTTP error", errorMsg)
                        throw IOException(errorMsg)
                    }
                    
                    val responseBody = response.body
                        ?: run {
                            logHttp("downloadUpdate() error", "Response body is null")
                            throw IOException("Response body is null")
                        }
                    
                    val totalBytes = responseBody.contentLength()
                    logHttp("downloadUpdate() download info", "totalBytes=$totalBytes")
                    
                    val inputStream = responseBody.byteStream()
                    val buffer = ByteArray(8192)
                    var bytesReceived = 0L
                    var bytesRead: Int
                    val outputStream = java.io.ByteArrayOutputStream()
                    
                    while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                        outputStream.write(buffer, 0, bytesRead)
                        bytesReceived += bytesRead
                        
                        onProgress?.let { callback ->
                            logHttp("downloadUpdate() progress", "bytesReceived=$bytesReceived, totalBytes=$totalBytes")
                            callback(bytesReceived, totalBytes)
                        }
                    }
                    
                    val finalData = outputStream.toByteArray()
                    logHttp("downloadUpdate() completed", "finalSize=${finalData.size} bytes")
                    
                    return finalData
                }
            } catch (e: Exception) {
                logHttp("downloadUpdate() exception", "error=${e.javaClass.simpleName}: ${e.message}")
                throw e
            }
        }
    }
}
