const FUNCTION_PATH = '/.netlify/functions/api-proxy';
const API_PATH = '/api';
const blockedRequestHeaders = [
    'accept-encoding',
    'connection',
    'content-length',
    'host',
    'origin'
];
const blockedResponseHeaders = [
    'connection',
    'content-encoding',
    'content-length',
    'transfer-encoding'
];

exports.handler = async event => {
    const configuredBackend = process.env.BACKEND_URL;
    if (!configuredBackend) {
        return jsonResponse(503, { message: 'API proxy is not configured' });
    }

    let backend;
    try {
        backend = new URL(configuredBackend);
    } catch {
        return jsonResponse(500, { message: 'API proxy configuration is invalid' });
    }

    if (
        backend.protocol !== 'https:' ||
        backend.username ||
        backend.password ||
        backend.search ||
        backend.hash
    ) {
        return jsonResponse(500, { message: 'API proxy must use a valid HTTPS backend URL' });
    }

    const requestPath = toApiPath(event.path || '');
    if (!requestPath) {
        return jsonResponse(404, { message: 'Not found' });
    }

    const rawQuery = event.rawQueryString ||
        (event.rawUrl ? new URL(event.rawUrl).search.slice(1) : '');
    const targetUrl = new URL(
        `${requestPath}${rawQuery ? `?${rawQuery}` : ''}`,
        backend.origin
    );
    const requestHeaders = new Headers(event.headers || {});
    for (const header of blockedRequestHeaders) {
        requestHeaders.delete(header);
    }

    const method = (event.httpMethod || 'GET').toUpperCase();
    const fetchOptions = {
        method,
        headers: requestHeaders,
        redirect: 'manual'
    };

    if (method !== 'GET' && method !== 'HEAD' && event.body) {
        fetchOptions.body = event.isBase64Encoded
            ? Buffer.from(event.body, 'base64')
            : event.body;
    }

    try {
        const upstream = await fetch(targetUrl, fetchOptions);
        const responseHeaders = {};
        for (const [name, value] of upstream.headers) {
            if (
                name !== 'set-cookie' &&
                !blockedResponseHeaders.includes(name.toLowerCase())
            ) {
                responseHeaders[name] = value;
            }
        }

        const cookies = typeof upstream.headers.getSetCookie === 'function'
            ? upstream.headers.getSetCookie()
            : [upstream.headers.get('set-cookie')].filter(Boolean);

        const body = method === 'HEAD'
            ? ''
            : Buffer.from(await upstream.arrayBuffer()).toString('base64');

        return {
            statusCode: upstream.status,
            headers: responseHeaders,
            ...(cookies.length > 0
                ? { multiValueHeaders: { 'set-cookie': cookies } }
                : {}),
            body,
            isBase64Encoded: method !== 'HEAD'
        };
    } catch (error) {
        console.error('API proxy request failed:', error);
        return jsonResponse(502, { message: 'API server is unavailable' });
    }
};

function toApiPath(path) {
    if (path === API_PATH || path.startsWith(`${API_PATH}/`)) {
        return path;
    }

    if (path === FUNCTION_PATH) {
        return API_PATH;
    }

    if (path.startsWith(`${FUNCTION_PATH}/`)) {
        return `${API_PATH}${path.slice(FUNCTION_PATH.length)}`;
    }

    return null;
}

function jsonResponse(statusCode, body) {
    return {
        statusCode,
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify(body)
    };
}
