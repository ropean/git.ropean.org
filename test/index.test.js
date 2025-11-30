import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import the worker
import worker from '../src/index.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Mirror Proxy Worker', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should proxy requests to ropean.github.io', async () => {
    // Mock successful response
    mockFetch.mockResolvedValueOnce(new Response('<html>Test</html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    }));

    const request = new Request('https://git.ropean.org/');
    const response = await worker.fetch(request, {}, {});

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
    await worker.fetch(request, {}, {});

    const fetchCall = mockFetch.mock.calls[0][0];
    expect(fetchCall.url).toBe('https://ropean.github.io/api/data?foo=bar');
  });

  it('should rewrite redirect location headers', async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, {
      status: 301,
      headers: { 'Location': 'https://ropean.github.io/new-path/' },
    }));

    const request = new Request('https://git.ropean.org/old-path');
    const response = await worker.fetch(request, {}, {});

    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('https://git.ropean.org/new-path/');
  });

  it('should handle fetch errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const request = new Request('https://git.ropean.org/');
    const response = await worker.fetch(request, {}, {});

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
    const response = await worker.fetch(request, {}, {});

    expect(response.headers.get('content-security-policy')).toBeNull();
    expect(response.headers.get('x-frame-options')).toBeNull();
    expect(response.headers.get('content-type')).toBe('text/html');
  });

  it('should set correct Host header', async () => {
    mockFetch.mockResolvedValueOnce(new Response('test', { status: 200 }));

    const request = new Request('https://git.ropean.org/');
    await worker.fetch(request, {}, {});

    const fetchCall = mockFetch.mock.calls[0][0];
    expect(fetchCall.headers.get('Host')).toBe('ropean.github.io');
  });
});
