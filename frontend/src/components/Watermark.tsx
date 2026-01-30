import { useEffect, useState } from 'react';

interface WatermarkProps {
  text?: string;
  username?: string;
  email?: string;
  role?: string;
}

export default function Watermark({ text, username, email, role }: WatermarkProps) {
  const [watermarkText, setWatermarkText] = useState('');

  useEffect(() => {
    // 生成水印文本
    const parts = [];
    if (username) parts.push(username);
    if (email) parts.push(email);
    if (role) parts.push(role === 'super' ? '超级管理员' : role === 'reviewer' ? '审核员' : '用户');
    if (text) parts.push(text);
    
    // 添加时间戳
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    parts.push(timeStr);

    setWatermarkText(parts.join(' | '));
  }, [text, username, email, role]);

  useEffect(() => {
    if (!watermarkText) return;

    // 创建水印容器
    const watermarkDiv = document.createElement('div');
    watermarkDiv.id = 'global-watermark';
    watermarkDiv.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 9999;
      overflow: hidden;
    `;

    // 创建 canvas 生成水印图案
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置 canvas 尺寸
    canvas.width = 400;
    canvas.height = 200;

    // 设置文字样式
    ctx.font = '14px Arial';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // 旋转并绘制文字
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-20 * Math.PI / 180);
    ctx.fillText(watermarkText, 0, 0);

    // 将 canvas 转为 base64
    const base64Url = canvas.toDataURL();

    // 设置水印背景
    watermarkDiv.style.backgroundImage = `url(${base64Url})`;
    watermarkDiv.style.backgroundRepeat = 'repeat';

    // 添加到 body
    document.body.appendChild(watermarkDiv);

    // 防止水印被删除或修改
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          const watermark = document.getElementById('global-watermark');
          if (!watermark) {
            document.body.appendChild(watermarkDiv);
          }
        } else if (mutation.type === 'attributes') {
          const watermark = document.getElementById('global-watermark');
          if (watermark && watermark.style.cssText !== watermarkDiv.style.cssText) {
            watermark.style.cssText = watermarkDiv.style.cssText;
          }
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      attributes: true,
      subtree: true,
    });

    // 清理函数
    return () => {
      observer.disconnect();
      const existingWatermark = document.getElementById('global-watermark');
      if (existingWatermark) {
        existingWatermark.remove();
      }
    };
  }, [watermarkText]);

  return null;
}

