// src/request-fetch-adapter.ts
import log from './logging';

const packageJson = require('../package.json');

interface RequestFetchAdapter {
  request(
    verb: number,
    url: string,
    requestBody?: any,
    callback?: Function
  ): Promise<void>;
}

const requestFetchAdapter: RequestFetchAdapter = {
  async request(
    verb: number,
    url: string,
    requestBody?: any,
    callback?: Function
  ) {
    // Handle overloaded parameters - if requestBody is a function, it's actually the callback
    if (typeof requestBody === 'function') {
      callback = requestBody;
      requestBody = null;
    }

    log(`HTTP Request: ${getHttpMethodName(verb)} ${url}`);

    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-CodePush-Plugin-Name': packageJson.name,
      'X-CodePush-Plugin-Version': packageJson.version,
      'X-CodePush-SDK-Version':
        packageJson.dependencies?.['code-push'] || '4.2.3',
    };

    log(`HTTP Headers: ${JSON.stringify(headers)}`);

    if (requestBody && typeof requestBody === 'object') {
      requestBody = JSON.stringify(requestBody);
      log(`HTTP Body: ${requestBody}`);
    }

    try {
      const startTime = Date.now();
      const response = await fetch(url, {
        method: getHttpMethodName(verb),
        headers: headers,
        body: requestBody,
      });

      const duration = Date.now() - startTime;
      const statusCode = response.status;
      const body = await response.text();

      log(
        `HTTP Response: ${statusCode} ${response.statusText} (${duration}ms)`
      );
      log(`HTTP Response Body: ${body}`);

      callback?.(null, { statusCode, body });
    } catch (err: any) {
      log(`HTTP Error: ${err.message}`);
      callback?.(err);
    }
  },
};

function getHttpMethodName(verb: number): string {
  // Note: This should stay in sync with the enum definition in
  // https://github.com/microsoft/code-push/blob/master/sdk/script/acquisition-sdk.ts#L6
  return (
    [
      'GET',
      'HEAD',
      'POST',
      'PUT',
      'DELETE',
      'TRACE',
      'OPTIONS',
      'CONNECT',
      'PATCH',
    ][verb] || 'GET'
  );
}

export default requestFetchAdapter;
