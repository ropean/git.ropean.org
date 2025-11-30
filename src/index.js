/**
 * Cloudflare Worker - Mirror Proxy for ropean.github.io
 *
 * This worker proxies all requests to ropean.github.io and returns
 * the content as-is, making git.ropean.org a mirror of the source site.
 */

const SOURCE_HOST = 'ropean.github.io';
const SOURCE_ORIGIN = `https://${SOURCE_HOST}`;

// Cache configuration
const CACHE_TTL = 3600; // Default cache TTL: 1 hour (in seconds)

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cache = caches.default;

    // Only cache GET requests
    if (request.method === 'GET') {
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
    }

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

      // Set cache control header for successful responses
      if (response.status >= 200 && response.status < 300) {
        responseHeaders.set('Cache-Control', `public, max-age=${CACHE_TTL}`);
      }

      // Create the final response
      const finalResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });

      // Cache successful GET responses
      if (request.method === 'GET' && response.status >= 200 && response.status < 300) {
        ctx.waitUntil(cache.put(request, finalResponse.clone()));
      }

      return finalResponse;

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
