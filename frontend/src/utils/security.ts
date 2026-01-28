const BASE_KEY = "star-moon-v2-hyper-secret";

export class StarMoonSecurity {
  static encryptData(data: Record<string, any>, fingerprint: string, nonce: number): string {
    const jsonStr = JSON.stringify(data);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = `${timestamp}|${fingerprint}|${nonce}|${jsonStr}`;
    
    // Convert to bytes
    const encoder = new TextEncoder();
    const uint8Bytes = encoder.encode(payload);
    const bytes = Array.from(uint8Bytes);
    
    const dynamicKey = this.deriveDynamicKey(fingerprint, nonce);
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
  
  static deriveDynamicKey(fingerprint: string, nonce: number): string {
    let key = `${BASE_KEY}${fingerprint}${nonce}`;
    for (let i = 0; i < 7; i++) {
        key = btoa(key);
        if (key.length > 32) {
            key = key.substring(0, 32);
        }
    }
    return key;
  }
}
