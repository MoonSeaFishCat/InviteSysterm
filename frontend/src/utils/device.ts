/**
 * 强化版设备指纹获取系统
 * 参考业界大厂（如京东、淘宝、FingerprintJS）的熵采集逻辑
 */

export function getDeviceId(): string {
  const STORAGE_KEY = 'invite_device_id';
  let deviceId = localStorage.getItem(STORAGE_KEY);
  
  if (!deviceId) {
    deviceId = generateAdvancedFingerprint();
    localStorage.setItem(STORAGE_KEY, deviceId);
  }
  
  return deviceId;
}

function generateAdvancedFingerprint(): string {
  const entropy: Record<string, any> = {
    // 1. 基础系统信息
    ua: navigator.userAgent,
    lang: navigator.language,
    platform: navigator.platform,
    cores: navigator.hardwareConcurrency || 0,
    memory: (navigator as any).deviceMemory || 0,
    
    // 2. 屏幕与显示
    screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
    availScreen: `${screen.availWidth}x${screen.availHeight}`,
    pixelRatio: window.devicePixelRatio || 1,
    
    // 3. 时间与区域
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),
    
    // 4. 浏览器特性与存储能力
    storage: {
      local: !!window.localStorage,
      session: !!window.sessionStorage,
      indexedDb: !!window.indexedDB,
      cookie: navigator.cookieEnabled
    },
    
    // 5. 硬件交互能力
    touch: {
      maxTouchPoints: navigator.maxTouchPoints || 0,
      touchEvent: 'ontouchstart' in window,
      touchPoints: navigator.maxTouchPoints > 0
    },

    // 6. 复杂熵源：Canvas (绘图特征)
    canvas: getCanvasFingerprint(),
    
    // 7. 复杂熵源：WebGL (显卡特征)
    webgl: getWebGLFingerprint(),
    
    // 8. 复杂熵源：Audio (音频处理特征)
    audio: getAudioFingerprint(),
    
    // 9. 字体指纹 (检测系统安装的字体)
    fonts: getFontFingerprint(),

    // 10. 浏览器插件数量 (仅部分浏览器支持遍历)
    plugins: navigator.plugins?.length || 0
  };

  // 将所有熵源序列化并进行 MurmurHash3 哈希
  const fingerprintStr = JSON.stringify(entropy);
  const hash = x64MurmurHash3(fingerprintStr);
  
  // 返回格式：hash-timestamp (保留一定时间戳增加唯一性)
  return `${hash}-${Date.now().toString(16)}`;
}

/**
 * Canvas 绘图指纹：不同显卡和驱动渲染出的像素存在微小差异
 */
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';
    
    canvas.width = 200;
    canvas.height = 50;
    
    // 混合文本、图形、渐变和阴影
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("StarMoon, <canvas> 1.0", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("StarMoon, <canvas> 1.0", 4, 17);
    
    // 加入复杂图形
    ctx.beginPath();
    ctx.arc(50, 50, 50, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill();
    
    return canvas.toDataURL().slice(-100); // 取末尾部分即可代表特征
  } catch (e) {
    return 'canvas-error';
  }
}

/**
 * WebGL 指纹：获取显卡型号、驱动厂商等信息
 */
function getWebGLFingerprint(): any {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext;
    if (!gl) return 'no-webgl';
    
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return 'no-webgl-debug';
    
    return {
      vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
      renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL),
      version: gl.getParameter(gl.VERSION),
      shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION)
    };
  } catch (e) {
    return 'webgl-error';
  }
}

/**
 * 音频指纹：利用 AudioContext 产生一段音频流并计算特征
 */
function getAudioFingerprint(): string {
  try {
    // 此处使用同步方式获取简单的音频配置特征，避免异步阻塞
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const result = {
      sampleRate: audioCtx.sampleRate,
      state: audioCtx.state,
      maxChannelCount: audioCtx.destination.maxChannelCount
    };
    audioCtx.close();
    return JSON.stringify(result);
  } catch (e) {
    return 'audio-error';
  }
}

/**
 * 字体指纹：通过测量不同字体在相同容器下的宽度差异来推断系统安装了哪些字体
 */
function getFontFingerprint(): string {
  const baseFonts = ['monospace', 'sans-serif', 'serif'];
  const fontList = [
    'Arial', 'Arial Black', 'Comic Sans MS', 'Courier New', 'Georgia', 
    'Impact', 'Lucida Console', 'Microsoft YaHei', 'SimSun', 'Tahoma', 
    'Times New Roman', 'Verdana'
  ];
  
  const testString = "mmmmmmmmmmlli";
  const testSize = "72px";
  const h = document.getElementsByTagName("body")[0];
  const s = document.createElement("span");
  s.style.fontSize = testSize;
  s.innerHTML = testString;
  
  const defaultWidths: Record<string, number> = {};
  const results: string[] = [];
  
  try {
    for (const base of baseFonts) {
      s.style.fontFamily = base;
      h.appendChild(s);
      defaultWidths[base] = s.offsetWidth;
      h.removeChild(s);
    }
    
    for (const font of fontList) {
      let detected = false;
      for (const base of baseFonts) {
        s.style.fontFamily = `'${font}',${base}`;
        h.appendChild(s);
        const matched = s.offsetWidth !== defaultWidths[base];
        h.removeChild(s);
        if (matched) {
          detected = true;
          break;
        }
      }
      if (detected) results.push(font);
    }
  } catch (e) {
    // 忽略错误
  }
  
  return results.join(',');
}

/**
 * MurmurHash3 哈希算法实现 (32-bit)
 * 具有极佳的离散性和性能，常用于指纹计算
 */
function x64MurmurHash3(key: string, seed = 0): string {
  let h1 = seed;
  const c1 = 0xcc9e2d51;
  const c2 = 0x1b873593;
  
  const bytes = new TextEncoder().encode(key);
  const nblocks = Math.floor(bytes.length / 4);
  
  for (let i = 0; i < nblocks; i++) {
    let k1 = (bytes[i * 4]) | (bytes[i * 4 + 1] << 8) | (bytes[i * 4 + 2] << 16) | (bytes[i * 4 + 3] << 24);
    
    k1 = Math.imul(k1, c1);
    k1 = (k1 << 15) | (k1 >>> 17);
    k1 = Math.imul(k1, c2);
    
    h1 ^= k1;
    h1 = (h1 << 13) | (h1 >>> 19);
    h1 = Math.imul(h1, 5) + 0xe6546b64;
  }
  
  let k2 = 0;
  const rem = bytes.length % 4;
  if (rem >= 3) k2 ^= bytes[nblocks * 4 + 2] << 16;
  if (rem >= 2) k2 ^= bytes[nblocks * 4 + 1] << 8;
  if (rem >= 1) {
    k2 ^= bytes[nblocks * 4];
    k2 = Math.imul(k2, c1);
    k2 = (k2 << 15) | (k2 >>> 17);
    k2 = Math.imul(k2, c2);
    h1 ^= k2;
  }
  
  h1 ^= bytes.length;
  h1 ^= h1 >>> 16;
  h1 = Math.imul(h1, 0x85ebca6b);
  h1 ^= h1 >>> 13;
  h1 = Math.imul(h1, 0xc2b2ae35);
  h1 ^= h1 >>> 16;
  
  return (h1 >>> 0).toString(16);
}
