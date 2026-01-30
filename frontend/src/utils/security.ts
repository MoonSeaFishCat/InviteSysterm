import api from '../api/client';

// 密钥缓存
let cachedKey: string | null = null;
let keyFetchTime: number = 0;
const KEY_CACHE_DURATION = 23 * 60 * 60 * 1000; // 23小时（比服务器轮换周期短1小时）

export class StarMoonSecurity {
  // 从服务器获取当前密钥
  static async fetchKey(): Promise<string> {
    const now = Date.now();

    // 如果缓存有效，直接返回
    if (cachedKey && (now - keyFetchTime) < KEY_CACHE_DURATION) {
      return cachedKey;
    }

    try {
      const response = await api.get('/security/key');
      const data = response.data;

      if (data.success && data.key) {
        cachedKey = data.key;
        keyFetchTime = now;
        return data.key;
      }
    } catch (error) {
      console.error('获取加密密钥失败:', error);
    }

    // 如果获取失败但有缓存，使用缓存
    if (cachedKey) {
      return cachedKey;
    }

    throw new Error('无法获取加密密钥');
  }

  static async encryptData(data: Record<string, any>, fingerprint: string, nonce: number): Promise<string> {
    // 获取当前密钥
    const baseKey = await this.fetchKey();

    const jsonStr = JSON.stringify(data);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = `${timestamp}|${fingerprint}|${nonce}|${jsonStr}`;

    // Convert to bytes
    const encoder = new TextEncoder();
    const uint8Bytes = encoder.encode(payload);
    const bytes = Array.from(uint8Bytes);

    const dynamicKey = this.deriveDynamicKey(baseKey, fingerprint, nonce);
    // dynamicKey is ASCII string
    const keyBytes = new Uint8Array(dynamicKey.length);
    for(let k=0; k<dynamicKey.length; k++) keyBytes[k] = dynamicKey.charCodeAt(k);

    // 7 Rounds (0 to 6)
    for (let round = 0; round <= 6; round++) {
      // Inverse Transform
      for (let i = 0; i < bytes.length; i++) {
         const keyChar = keyBytes[i % keyBytes.length];
         const shift = (round + i) % 8;

         // Logic: bytes[i] (old) = RotateLeft(bytes[i] (new) ^ C2) ^ C1
         // C2 = keyChar
         // C1 = (round * 13)

         const xor1 = bytes[i] ^ keyChar;
         // Rotate Left 8-bit
         const rotated = ((xor1 << shift) | (xor1 >>> (8 - shift))) & 0xFF;

         const result = rotated ^ (round * 13);
         bytes[i] = result;
      }

      // Inverse Reverse (Reverse)
      bytes.reverse();
    }

    // To Base64
    let binary = '';
    const len = bytes.length;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  static deriveDynamicKey(baseKey: string, fingerprint: string, nonce: number): string {
    let key = `${baseKey}${fingerprint}${nonce}`;
    for (let i = 0; i < 7; i++) {
        key = btoa(key);
        if (key.length > 32) {
            key = key.substring(0, 32);
        }
    }
    return key;
  }
}
