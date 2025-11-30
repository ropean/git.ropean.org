import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import the worker
import worker from '../src/index.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock caches API (Cloudflare Workers Cache API)
const mockCache = {
  match: vi.fn(),
  put: vi.fn(),
};
global.caches = {
  default: mockCache,
};

// Mock ctx object with waitUntil
const mockCtx = {
  waitUntil: vi.fn(),
};

describe('Mirror Proxy Worker', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockCache.match.mockReset();
    mockCache.put.mockReset();
    mockCtx.waitUntil.mockReset();
    // Default: no cache hit
    mockCache.match.mockResolvedValue(null);
  });

  it('should proxy requests to ropean.github.io', async () => {
    // Mock successful response
    mockFetch.mockResolvedValueOnce(new Response('<html>Test</html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    }));

    const request = new Request('https://git.ropean.org/');
    const response = await worker.fetch(request, {}, mockCtx);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('<html>Test</html>');

    // Verify fetch was called with correct URL
    const fetchCall = mockFetch.mock.calls[0][0];
    expect(fetchCall.url).toBe('https://ropean.github.io/');
  });

  it('should preserve path and query string', async () => {
    mockFetch.mockResolvedValueOnce(new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const request = new Request('https://git.ropean.org/api/data?foo=bar');
    await worker.fetch(request, {}, mockCtx);

    const fetchCall = mockFetch.mock.calls[0][0];
    expect(fetchCall.url).toBe('https://ropean.github.io/api/data?foo=bar');
  });

  it('should rewrite redirect location headers', async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, {
      status: 301,
      headers: { 'Location': 'https://ropean.github.io/new-path/' },
    }));

    const request = new Request('https://git.ropean.org/old-path');
    const response = await worker.fetch(request, {}, mockCtx);

    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('https://git.ropean.org/new-path/');
  });

  it('should handle fetch errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const request = new Request('https://git.ropean.org/');
    const response = await worker.fetch(request, {}, mockCtx);

    expect(response.status).toBe(502);
    const text = await response.text();
    expect(text).toContain('Mirror Error');
    expect(text).toContain('Network error');
  });

  it('should remove CSP and X-Frame-Options headers', async () => {
    mockFetch.mockResolvedValueOnce(new Response('test', {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Content-Security-Policy': "default-src 'self'",
        'X-Frame-Options': 'DENY',
      },
    }));

    const request = new Request('https://git.ropean.org/');
    const response = await worker.fetch(request, {}, mockCtx);

    expect(response.headers.get('content-security-policy')).toBeNull();
    expect(response.headers.get('x-frame-options')).toBeNull();
    expect(response.headers.get('content-type')).toBe('text/html');
  });

  it('should set correct Host header', async () => {
    mockFetch.mockResolvedValueOnce(new Response('test', { status: 200 }));

    const request = new Request('https://git.ropean.org/');
    await worker.fetch(request, {}, mockCtx);

    const fetchCall = mockFetch.mock.calls[0][0];
    expect(fetchCall.headers.get('Host')).toBe('ropean.github.io');
  });

  it('should return cached response for GET requests', async () => {
    const cachedResponse = new Response('cached content', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
    mockCache.match.mockResolvedValueOnce(cachedResponse);

    const request = new Request('https://git.ropean.org/');
    const response = await worker.fetch(request, {}, mockCtx);

    expect(response).toBe(cachedResponse);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should cache successful GET responses', async () => {
    mockFetch.mockResolvedValueOnce(new Response('fresh content', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    }));

    const request = new Request('https://git.ropean.org/');
    await worker.fetch(request, {}, mockCtx);

    expect(mockCtx.waitUntil).toHaveBeenCalled();
    expect(mockCache.put).toHaveBeenCalled();
  });

  it('should set Cache-Control header for successful responses', async () => {
    mockFetch.mockResolvedValueOnce(new Response('content', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    }));

    const request = new Request('https://git.ropean.org/');
    const response = await worker.fetch(request, {}, mockCtx);

    expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
  });

  it('should not cache non-GET requests', async () => {
    mockFetch.mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const request = new Request('https://git.ropean.org/', { method: 'POST' });
    await worker.fetch(request, {}, mockCtx);

    expect(mockCache.match).not.toHaveBeenCalled();
    expect(mockCtx.waitUntil).not.toHaveBeenCalled();
  });

  it('should not cache error responses', async () => {
    mockFetch.mockResolvedValueOnce(new Response('Not Found', { status: 404 }));

    const request = new Request('https://git.ropean.org/missing');
    await worker.fetch(request, {}, mockCtx);

    expect(mockCtx.waitUntil).not.toHaveBeenCalled();
  });
});
