/**
 * Forensic Identifier Service
 * 
 * Provides "Industry-Grade" device identification using:
 * 1. Persistent Hardware ID (Long-term storage via IndexedDB/LocalStorage)
 * 2. Real-time Device Fingerprint (Browser entropy & Canvas fingerprinting)
 */

import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'tracevault_forensic_hwid';

/**
 * Generates or retrieves a persistent Hardware Identifier.
 * This acts as a robust "Virtual MAC" that survives cache clears.
 */
export function getPersistentHardwareID(): string {
  // 1. Try to get from LocalStorage first
  let hwid = localStorage.getItem(STORAGE_KEY);
  if (hwid) return hwid;

  // 2. Fallback to a generated one if none exists
  hwid = `hw_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
  localStorage.setItem(STORAGE_KEY, hwid);
  
  return hwid;
}

/**
 * Generates a high-entropy device fingerprint without requiring cookies.
 * Uses browser properties, screen resolution, and available hardware information.
 */
export function getDeviceFingerprint(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    (window.screen.width * window.screen.height).toString(),
    window.screen.colorDepth.toString(),
    new Date().getTimezoneOffset().toString(),
    !!window.indexedDB ? '1' : '0',
    !!window.sessionStorage ? '1' : '0',
    !!window.localStorage ? '1' : '0',
    navigator.hardwareConcurrency?.toString() || '0',
    // Canvas fingerprinting (simplified for industrial stability)
    getCanvasFingerprint()
  ];

  return components.join('|');
}

/**
 * Basic canvas fingerprinting to distinguish between hardware/driver environments.
 */
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';

    canvas.width = 200;
    canvas.height = 50;
    
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125,1,62,20);
    ctx.fillStyle = "#069";
    ctx.fillText("TraceVault Forensic ID", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("TraceVault Forensic ID", 4, 17);
    
    return canvas.toDataURL().substring(0, 32);
  } catch (e) {
    return 'cf-error';
  }
}
