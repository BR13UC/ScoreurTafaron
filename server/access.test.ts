import { describe, expect, it } from 'vitest';
import { isLoopbackAddress } from './access.js';

describe('accès réservé à la machine hôte', () => {
  it('accepte les variantes loopback et refuse les adresses du réseau local', () => {
    for (const address of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) expect(isLoopbackAddress(address)).toBe(true);
    for (const address of ['192.168.1.20', '10.0.0.5', '::ffff:192.168.1.20', undefined]) expect(isLoopbackAddress(address)).toBe(false);
  });
});
