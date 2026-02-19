'use strict';
const { encrypt, decrypt } = require('../crypto');

describe('crypto', () => {
  const key = 'a'.repeat(64); // 32 bytes hex

  test('encrypts and decrypts back to original', () => {
    const original = 'AIzaSyBR0vtef8yx7po46XU2GqJIoxkdFdRi3i0';
    const encrypted = encrypt(original, key);
    expect(encrypted).not.toBe(original);
    expect(encrypted).toContain(':'); // iv:authTag:ciphertext
    expect(decrypt(encrypted, key)).toBe(original);
  });

  test('different inputs produce different ciphertexts', () => {
    const a = encrypt('key-a', key);
    const b = encrypt('key-b', key);
    expect(a).not.toBe(b);
  });

  test('returns null for empty input', () => {
    expect(encrypt(null, key)).toBeNull();
    expect(encrypt('', key)).toBeNull();
    expect(decrypt(null, key)).toBeNull();
  });
});
