/**
 * 星月御安全 (Star-Moon Shield Security) - 7星级魔改增强版
 * 集成动态 PoW、多维设备指纹与环境绑定加密
 */

const BASE_KEY = process.env.NEXT_PUBLIC_SECURITY_KEY || "star-moon-v2-hyper-secret";

/**
 * 核心加密组件
 */
export const StarMoonSecurity = {
  /**
   * 生成 PoW 挑战 (服务端调用)
   */
  generateChallenge(difficulty: number = 4) {
    const salt = Math.random().toString(36).substring(2);
    return { salt, difficulty };
  },

  /**
   * 解决 PoW 挑战 (客户端调用)
   */
  async solveChallenge(salt: string, difficulty: number): Promise<number> {
    let nonce = 0;
    while (true) {
      const str = salt + nonce;
      const hash = await this._sha256(str);
      if (hash.startsWith("0".repeat(difficulty))) {
        return nonce;
      }
      nonce++;
      if (nonce % 1000 === 0) await new Promise(r => setTimeout(r, 0)); // 防止阻塞 UI
    }
  },

  /**
   * 动态密钥生成：结合基础密钥、设备指纹与 PoW Nonce
   */
  _deriveDynamicKey(fingerprint: string, nonce: number): string {
    let key = BASE_KEY + fingerprint + nonce;
    // 进行 7 轮混淆
    for (let i = 0; i < 7; i++) {
      key = btoa(encodeURIComponent(key)).substring(0, 32);
    }
    return key;
  },

  async _sha256(message: string): Promise<string> {
    const msgUint8 = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  },

  /**
   * 增强加密：数据 + 指纹 + Nonce
   */
  async encrypt(data: any, fingerprint: string, nonce: number): Promise<string> {
    const dynamicKey = this._deriveDynamicKey(fingerprint, nonce);
    const jsonStr = JSON.stringify(data);
    const timestamp = Date.now().toString();
    const payload = `${timestamp}|${fingerprint}|${nonce}|${jsonStr}`;
    
    // 7星级魔改：多轮异或 + 动态循环移位 + 矩阵置换混淆
    let bytes = Array.from(new TextEncoder().encode(payload));
    
    // 轮转加密
    for (let round = 0; round < 7; round++) {
      bytes = bytes.map((byte, i) => {
        const keyChar = dynamicKey.charCodeAt(i % dynamicKey.length);
        // 复杂的魔改位移：根据当前轮数和索引动态改变位移量
        const shift = (round + i) % 8;
        let processed = byte ^ keyChar;
        processed = ((processed << shift) | (processed >> (8 - shift))) & 0xFF;
        return processed ^ (round * 13);
      });
      // 每轮结束后进行简单的位置反转
      bytes.reverse();
    }
    
    return btoa(String.fromCharCode(...bytes));
  },

  /**
   * 增强解密 (服务端调用)
   */
  decrypt(encryptedStr: string, fingerprint: string, nonce: number): any {
    try {
      const dynamicKey = this._deriveDynamicKey(fingerprint, nonce);
      let bytes = Array.from(atob(encryptedStr), c => c.charCodeAt(0));
      
      // 逆向 7 轮混淆
      for (let round = 6; round >= 0; round--) {
        bytes.reverse();
        bytes = bytes.map((byte, i) => {
          const keyChar = dynamicKey.charCodeAt(i % dynamicKey.length);
          const shift = (round + i) % 8;
          let processed = byte ^ (round * 13);
          // 逆向位移
          processed = ((processed >> shift) | (processed << (8 - shift))) & 0xFF;
          return processed ^ keyChar;
        });
      }
      
      const result = new TextDecoder().decode(new Uint8Array(bytes));
      const [timestamp, fId, n, jsonStr] = result.split("|");
      
      // 1. 安全校验：时间戳
      if (Math.abs(Date.now() - parseInt(timestamp)) > 600000) return null; // 10分钟有效期
      // 2. 安全校验：指纹一致性
      if (fId !== fingerprint) return null;
      // 3. 安全校验：Nonce 一致性
      if (parseInt(n) !== nonce) return null;
      
      return JSON.parse(jsonStr);
    } catch (e) {
      return null;
    }
  }
};

/**
 * 深度设备指纹采集 (硬件级特征)
 */
export async function getDeviceFingerprint(): Promise<string> {
  if (typeof window === "undefined") return "server-side";

  const data: any = {
    ua: navigator.userAgent,
    lang: navigator.language,
    platform: navigator.platform,
    cores: navigator.hardwareConcurrency,
    mem: (navigator as any).deviceMemory,
    res: `${screen.width}x${screen.height}x${screen.colorDepth}`,
    tz: new Date().getTimezoneOffset(),
    fonts: getFonts(),
    webgl: getWebGLEntropy(),
    canvas: getCanvasEntropy(),
    audio: await getAudioEntropy(),
    plugins: Array.from(navigator.plugins).map(p => p.name),
  };

  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return "SMV2-" + Math.abs(hash).toString(16).toUpperCase();
}

function getFonts() {
  const fontList = ["Arial", "Verdana", "Times New Roman", "Courier New", "Georgia", "Comic Sans MS"];
  return fontList.filter(font => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return false;
    context.font = "72px sans-serif";
    const defaultWidth = context.measureText("mmmmmmmmmmlli").width;
    context.font = "72px '" + font + "', sans-serif";
    const fontWidth = context.measureText("mmmmmmmmmmlli").width;
    return defaultWidth !== fontWidth;
  });
}

function getWebGLEntropy() {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl");
  if (!gl) return "no-webgl";
  const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
  return debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : "unknown-gl";
}

function getCanvasEntropy() {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return "no-canvas";
  canvas.width = 240;
  canvas.height = 60;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#f60";
  ctx.fillRect(100, 1, 62, 20);
  ctx.fillStyle = "#069";
  ctx.font = "11pt no-real-font-123";
  ctx.fillText("StarMoonSecurity, <canvas> 1.0", 2, 15);
  ctx.fillStyle = "rgba(102, 204, 0, 0.2)";
  ctx.font = "18pt Arial";
  ctx.fillText("StarMoonSecurity, <canvas> 1.0", 4, 45);
  return canvas.toDataURL();
}

async function getAudioEntropy() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return "no-audio";
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const analyser = context.createAnalyser();
    const gain = context.createGain();
    gain.gain.value = 0;
    oscillator.type = "triangle";
    oscillator.connect(analyser);
    analyser.connect(gain);
    gain.connect(context.destination);
    oscillator.start(0);
    const data = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(data);
    oscillator.stop();
    await context.close();
    return data.slice(0, 10).join(",");
  } catch (e) {
    return "audio-error";
  }
}
