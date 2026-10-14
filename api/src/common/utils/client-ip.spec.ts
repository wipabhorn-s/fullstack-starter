import { resolveClientIp } from '@/common/utils/client-ip';

const SECRET = 'internal-secret-for-tests';

const request = (headers: Record<string, string>, ip = '10.0.0.5') => ({
  ip,
  headers,
});

describe('resolveClientIp', () => {
  it('trusts X-Client-IP only with the shared internal secret (our web server)', () => {
    expect(
      resolveClientIp(
        request({ 'x-internal-secret': SECRET, 'x-client-ip': '203.0.113.7' }),
        SECRET,
      ),
    ).toBe('203.0.113.7');
  });

  it('ignores a spoofed X-Client-IP without the secret (someone calling the API directly)', () => {
    expect(
      resolveClientIp(request({ 'x-client-ip': '203.0.113.7' }), SECRET),
    ).toBe('10.0.0.5');
    expect(
      resolveClientIp(
        request({ 'x-internal-secret': 'guess', 'x-client-ip': '203.0.113.7' }),
        SECRET,
      ),
    ).toBe('10.0.0.5');
  });

  it('rejects values that are not IP addresses', () => {
    expect(
      resolveClientIp(
        request({ 'x-internal-secret': SECRET, 'x-client-ip': 'not-an-ip' }),
        SECRET,
      ),
    ).toBe('10.0.0.5');
  });

  it('uses the connecting IP when no secret is configured (local dev)', () => {
    expect(
      resolveClientIp(
        request({ 'x-internal-secret': SECRET, 'x-client-ip': '203.0.113.7' }),
        undefined,
      ),
    ).toBe('10.0.0.5');
  });
});
