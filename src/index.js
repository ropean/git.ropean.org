/**
 * Cloudflare Worker - Mirror Proxy for ropean.github.io
 *
 * This worker proxies all requests to ropean.github.io and returns
 * the content as-is, making git.ropean.org a mirror of the source site.
 */

const SOURCE_HOST = 'ropean.github.io';
const SOURCE_ORIGIN = `https://${SOURCE_HOST}`;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

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
            locationUrl.host = url.host;
            locationUrl.protocol = url.protocol;
            responseHeaders.set('location', locationUrl.toString());
          }
        }
      }

      // Get the response body
      const body = response.body;

      // Return the proxied response
      return new Response(body, {
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
