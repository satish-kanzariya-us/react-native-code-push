// src/acquisition-sdk.ts
import { AcquisitionManager as Sdk } from 'code-push/script/acquisition-sdk';
import { CodePushConfiguration, RemotePackage } from './types';
import log from './logging';

export interface AcquisitionSDK {
  queryUpdateWithCurrentPackage(
    queryPackage: any
  ): Promise<RemotePackage | null>;
  reportStatusDeploy(
    deployedPackage: any,
    status: string | null,
    previousLabelOrAppVersion?: string,
    previousDeploymentKey?: string
  ): Promise<void>;
  reportStatusDownload(downloadedPackage: RemotePackage): Promise<void>;
}

// Create a promisified version of the SDK following the CodePushNext pattern
export function getPromisifiedSdk(
  requestFetchAdapter: any,
  config: CodePushConfiguration
) {
  log(
    `getPromisifiedSdk: creating SDK with config: ${JSON.stringify({
      serverUrl: config.serverUrl,
      deploymentKey: config.deploymentKey?.substring(0, 10) + '...',
      appVersion: config.appVersion,
      clientUniqueId: config.clientUniqueId?.substring(0, 8) + '...',
    })}`
  );

  // Create SDK instance exactly like CodePushNext does
  const sdk = new Sdk(requestFetchAdapter, config);

  // Promisify the queryUpdateWithCurrentPackage method
  sdk.queryUpdateWithCurrentPackage = (queryPackage: any) => {
    log(
      `SDK queryUpdateWithCurrentPackage called with: ${JSON.stringify(queryPackage)}`
    );

    return new Promise((resolve, reject) => {
      // Call the original prototype method with proper context
      Sdk.prototype.queryUpdateWithCurrentPackage.call(
        sdk,
        queryPackage,
        (err: any, update: any) => {
          if (err) {
            log(
              `SDK queryUpdateWithCurrentPackage error: ${err.message || err}`
            );
            reject(err);
          } else {
            log(
              `SDK queryUpdateWithCurrentPackage success: ${JSON.stringify(update)}`
            );
            resolve(update);
          }
        }
      );
    });
  };

  // Promisify the reportStatusDeploy method
  sdk.reportStatusDeploy = (
    deployedPackage: any,
    status: string | null,
    previousLabelOrAppVersion?: string,
    previousDeploymentKey?: string
  ) => {
    log(`SDK reportStatusDeploy called`);

    return new Promise<void>((resolve, reject) => {
      Sdk.prototype.reportStatusDeploy.call(
        sdk,
        deployedPackage,
        status,
        previousLabelOrAppVersion,
        previousDeploymentKey,
        (err: any) => {
          if (err) {
            log(`SDK reportStatusDeploy error: ${err.message || err}`);
            reject(err);
          } else {
            log(`SDK reportStatusDeploy success`);
            resolve();
          }
        }
      );
    });
  };

  // Promisify the reportStatusDownload method
  sdk.reportStatusDownload = (downloadedPackage: RemotePackage) => {
    log(`SDK reportStatusDownload called`);

    return new Promise<void>((resolve, reject) => {
      Sdk.prototype.reportStatusDownload.call(
        sdk,
        downloadedPackage,
        (err: any) => {
          if (err) {
            log(`SDK reportStatusDownload error: ${err.message || err}`);
            reject(err);
          } else {
            log(`SDK reportStatusDownload success`);
            resolve();
          }
        }
      );
    });
  };

  return sdk;
}

// Export the original SDK class as well
export { Sdk as AcquisitionSdk };
