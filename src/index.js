/**
 * Cloudflare Worker - Mirror Proxy for ropean.github.io
 *
 * This worker proxies all requests to ropean.github.io and returns
 * the content with domain replacement, making git.ropean.org a full mirror.
 */

const SOURCE_HOST = 'ropean.github.io';
const SOURCE_ORIGIN = `https://${SOURCE_HOST}`;
const MIRROR_HOST = 'git.ropean.org';

// Content types that should have domain replacement
const TEXT_CONTENT_TYPES = [
  'text/html',
  'text/css',
  'text/javascript',
  'application/javascript',
  'application/json',
  'text/xml',
  'application/xml',
  'text/plain',
];

/**
 * Check if content type is text-based and needs domain replacement
 */
function isTextContent(contentType) {
  if (!contentType) return false;
  return TEXT_CONTENT_TYPES.some(type => contentType.includes(type));
}

/**
 * Replace source domain with mirror domain in text content
 */
function replaceDomain(text, mirrorHost) {
  // Replace all occurrences of source host with mirror host
  return text
    .replaceAll(SOURCE_HOST, mirrorHost)
    .replaceAll(encodeURIComponent(SOURCE_HOST), encodeURIComponent(mirrorHost));
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const mirrorHost = url.host; // Use actual request host for flexibility

    // Build the target URL
    const targetUrl = new URL(url.pathname + url.search, SOURCE_ORIGIN);

    // Create new headers, forwarding most original headers
    const headers = new Headers(request.headers);
    headers.set('Host', SOURCE_HOST);
    headers.delete('cf-connecting-ip');
    headers.delete('cf-ipcountry');
    headers.delete('cf-ray');
    headers.delete('cf-visitor');

    // Create the proxy request
    const proxyRequest = new Request(targetUrl.toString(), {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: 'manual', // Handle redirects manually to rewrite them
    });

    try {
      // Fetch from source
      const response = await fetch(proxyRequest);

      // Create new response headers
      const responseHeaders = new Headers(response.headers);

      // Remove headers that might cause issues
      responseHeaders.delete('content-security-policy');
      responseHeaders.delete('x-frame-options');

      // Handle redirects - rewrite location header to use our domain
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (location) {
          const locationUrl = new URL(location, SOURCE_ORIGIN);
          if (locationUrl.host === SOURCE_HOST) {
            locationUrl.host = mirrorHost;
            locationUrl.protocol = url.protocol;
            responseHeaders.set('location', locationUrl.toString());
          }
        }
      }

      // Check if we need to replace domain in response body
      const contentType = response.headers.get('content-type');

      if (isTextContent(contentType)) {
        // Read response as text and replace domain
        let text = await response.text();
        text = replaceDomain(text, mirrorHost);

        // Update content-length header
        responseHeaders.delete('content-length');

        return new Response(text, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });
      }

      // For non-text content, return as-is
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });

    } catch (error) {
      // Return error response
      return new Response(`Mirror Error: ${error.message}`, {
        status: 502,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    }
  },
};
