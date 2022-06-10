import { getIsConnectionIssue } from '@proton/shared/lib/api/helpers/apiErrorHelper';
import { serializeFormData } from '@proton/shared/lib/fetch/helpers';
import { RESPONSE_CODE } from '@proton/shared/lib/drive/constants';
import { HTTP_STATUS_CODE } from '@proton/shared/lib/constants';

import { MAX_UPLOAD_JOBS, MAX_RETRIES_BEFORE_FAIL } from '../constants';
import { UploadingBlockControl } from './interface';
import { Pauser } from './pauser';

/**
 * startUploadJobs starts MAX_UPLOAD_JOBS jobs to read uploading blocks
 * and upload the date to the backend.
 */
export default async function startUploadJobs(
    pauser: Pauser,
    generator: AsyncGenerator<UploadingBlockControl>,
    progressCallback: (progress: number) => void,
    networkErrorCallback: (error: string) => void,
    uploadBlockDataCallback = uploadBlockData
) {
    const promises: Promise<void>[] = [];
    for (let idx = 0; idx < MAX_UPLOAD_JOBS; idx++) {
        promises.push(
            startUploadJob(pauser, generator, progressCallback, networkErrorCallback, uploadBlockDataCallback)
        );
    }
    return Promise.all(promises);
}

async function startUploadJob(
    pauser: Pauser,
    generator: AsyncGenerator<UploadingBlockControl>,
    progressCallback: (progress: number) => void,
    networkErrorCallback: (error: string) => void,
    uploadBlockDataCallback = uploadBlockData
) {
    for await (const block of generator) {
        await pauser.waitIfPaused();
        await uploadBlock(block, pauser, progressCallback, networkErrorCallback, uploadBlockDataCallback);
    }
}

async function uploadBlock(
    block: UploadingBlockControl,
    pauser: Pauser,
    progressCallback: (progress: number) => void,
    networkErrorCallback: (error: string) => void,
    uploadBlockDataCallback = uploadBlockData,
    numRetries = 0
): Promise<void> {
    // It could take some time from block token creation and block upload
    // itself: for example, the process could be paused (either this block
    // or any other) for too long. If we know it is old token, we can
    // optimise and ask for new one right away without even uploading data.
    if (block.isTokenExpired()) {
        block.onTokenExpiration();
        return;
    }

    let progress = 0;
    const onProgress = (relativeIncrement: number) => {
        const increment = block.originalSize * relativeIncrement;
        if (increment !== 0) {
            progress += increment;
            progressCallback(increment);
        }
    };
    const resetProgress = () => {
        if (progress !== 0) {
            progressCallback(-progress);
        }
        progress = 0;
    };

    try {
        await uploadBlockDataCallback(
            block.uploadLink,
            block.uploadToken,
            block.encryptedData,
            onProgress,
            pauser.abortController.signal
        );
        block.finish();
    } catch (err: any | XHRError) {
        resetProgress();

        if (pauser.isPaused) {
            await pauser.waitIfPaused();
            return uploadBlock(block, pauser, progressCallback, networkErrorCallback, uploadBlockDataCallback, 0);
        }

        // Upload can be cancelled at the moment when the block is already
        // committed on the backend side, but from the client point of view
        // the request was cancelled. When we attempt to upload again, we
        // get this error which we can ignore and consider it uploaded.
        if (err.errorCode === RESPONSE_CODE.ALREADY_EXISTS) {
            return;
        }

        // We detect token expiration on client side before calling API so
        // this should not happen except few edge cases, such as different
        // time configuration on server and client, or there might be tiny
        // window because of different start of expiration measurmement.
        // Anyway, we can simply ask for new tokens here as well.
        if (err.errorCode === RESPONSE_CODE.NOT_FOUND || err.status === HTTP_STATUS_CODE.NOT_FOUND) {
            console.warn(`Expired block token #${block.index}. Asking for new upload token.`);
            block.onTokenExpiration();
            return;
        }

        // If we experience some slight issue on server side, lets try
        // one more time before notyfing user in transfer manager.
        // Be careful about too many attempts as that could be harmful
        // for our servers - if we have traffic issue, retrying too
        // many times could lead to longer downtime.
        if (numRetries === 0 && getIsConnectionIssue(err)) {
            console.warn(`Connection issue for block #${block.index} upload. Retrying one more time.`);
            return uploadBlock(
                block,
                pauser,
                progressCallback,
                networkErrorCallback,
                uploadBlockDataCallback,
                numRetries + 1
            );
        }

        if (networkErrorCallback && getIsConnectionIssue(err)) {
            pauser.pause();
            networkErrorCallback(err.message || err.status);
            await pauser.waitIfPaused();
            return uploadBlock(block, pauser, progressCallback, networkErrorCallback, uploadBlockDataCallback, 0);
        }

        if (numRetries < MAX_RETRIES_BEFORE_FAIL) {
            console.warn(`Failed block #${block.index} upload. Retry num: ${numRetries}`);
            return uploadBlock(
                block,
                pauser,
                progressCallback,
                networkErrorCallback,
                uploadBlockDataCallback,
                numRetries + 1
            );
        }

        throw err;
    }
}

async function uploadBlockData(
    url: string,
    token: string,
    content: Uint8Array,
    onProgress: (relativeIncrement: number) => void,
    signal: AbortSignal
) {
    let listener: () => void;

    return new Promise<void>((resolve, reject) => {
        if (signal.aborted) {
            reject(new Error('Upload aborted'));
            return;
        }

        const xhr = new XMLHttpRequest();

        let lastLoaded = 0;
        let total = 0;
        xhr.upload.onprogress = (e) => {
            total = e.total;
            onProgress((e.loaded - lastLoaded) / total);
            lastLoaded = e.loaded;
        };

        listener = () => {
            // When whole block is uploaded, we mustn't cancel even if we don't get a response
            if (!total || lastLoaded !== total) {
                xhr.abort();
                reject(new Error('Upload aborted'));
            }
        };
        signal.addEventListener('abort', listener);

        xhr.onload = async () => {
            if (xhr.status >= HTTP_STATUS_CODE.OK && xhr.status < HTTP_STATUS_CODE.BAD_REQUEST) {
                resolve();
            } else {
                reject(new XHRError(xhr.response?.Error || xhr.statusText, xhr.response?.Code, xhr.status));
            }
        };

        xhr.responseType = 'json';
        xhr.upload.onerror = () => {
            // onerror provides ProgressEvent, not any error.
            // It can happen when internet is down, for example.
            reject(new Error('network error'));
        };
        xhr.onerror = () => {
            // onerror provides ProgressEvent, not any error.
            // It can happen when browser blocks the request, for example.
            reject(new Error('Upload failed'));
        };
        xhr.ontimeout = () => {
            // ontimeout can happen during switching proxy, for example.
            reject(new Error('Upload timed out'));
        };
        xhr.open('POST', url);
        xhr.setRequestHeader('pm-storage-token', token);
        xhr.send(
            serializeFormData({
                Block: new Blob([content]),
            })
        );
    }).finally(() => {
        if (listener) {
            signal.removeEventListener('abort', listener);
        }
    });
}

class XHRError extends Error {
    errorCode: number; // API error code.

    statusCode: number; // XHR status code.

    constructor(message: string, code: number, status: number) {
        super(message);
        this.errorCode = code;
        this.statusCode = status;
    }
}
