/**
 * SmartProxy 工具函数库
 */

/**
 * 生成 UUID
 * @returns {string} UUID 字符串
 */
export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 解析 URL
 * @param {string} url - URL 字符串
 * @returns {Object} 解析后的 URL 对象
 */
export function parseUrl(url) {
  try {
    const urlObj = new URL(url);
    return {
      protocol: urlObj.protocol.replace(':', ''),
      host: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? '443' : '80'),
      path: urlObj.pathname + urlObj.search,
      full: url
    };
  } catch (e) {
    return null;
  }
}

/**
 * 检查 IP 是否在 CIDR 范围内
 * @param {string} ip - IP 地址
 * @param {string} cidr - CIDR 范围 (如 192.168.1.0/24)
 * @returns {boolean}
 */
export function isIpInCidr(ip, cidr) {
  const [range, bits = 32] = cidr.split('/');
  const mask = ~(2 ** (32 - parseInt(bits)) - 1);
  
  const ipNum = ipToNumber(ip);
  const rangeNum = ipToNumber(range);
  
  if (ipNum === null || rangeNum === null) return false;
  
  return (ipNum & mask) === (rangeNum & mask);
}

/**
 * IP 转数字
 * @param {string} ip - IP 地址
 * @returns {number|null}
 */
export function ipToNumber(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  
  let num = 0;
  for (const part of parts) {
    const n = parseInt(part);
    if (isNaN(n) || n < 0 || n > 255) return null;
    num = (num << 8) + n;
  }
  return num >>> 0; // 转为无符号整数
}

/**
 * 检查字符串是否是有效的 IP 地址
 * @param {string} str - 字符串
 * @returns {boolean}
 */
export function isValidIp(str) {
  const parts = str.split('.');
  if (parts.length !== 4) return false;
  
  for (const part of parts) {
    const n = parseInt(part);
    if (isNaN(n) || n < 0 || n > 255) return false;
  }
  return true;
}

/**
 * 通配符转正则表达式
 * @param {string} pattern - 通配符模式 (支持 * 和 ?)
 * @returns {RegExp}
 */
export function wildcardToRegex(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // 转义特殊字符
    .replace(/\*/g, '.*')                    // * 转为 .*
    .replace(/\?/g, '.');                    // ? 转为 .
  return new RegExp(`^${escaped}$`, 'i');
}

/**
 * 简单加密 (用于密码存储)
 * @param {string} text - 明文
 * @param {string} key - 密钥
 * @returns {string} 加密后的字符串
 */
export function simpleEncrypt(text, key = 'smartproxy') {
  if (!text) return '';
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(
      text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
    );
  }
  return btoa(result);
}

/**
 * 简单解密
 * @param {string} encrypted - 密文
 * @param {string} key - 密钥
 * @returns {string} 解密后的字符串
 */
export function simpleDecrypt(encrypted, key = 'smartproxy') {
  if (!encrypted) return '';
  try {
    const text = atob(encrypted);
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(
        text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    }
    return result;
  } catch {
    return '';
  }
}

/**
 * 防抖函数
 * @param {Function} func - 要执行的函数
 * @param {number} wait - 等待时间 (毫秒)
 * @returns {Function}
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * 深拷贝对象
 * @param {Object} obj - 对象
 * @returns {Object}
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * 获取当前时间戳
 * @returns {number}
 */
export function now() {
  return Date.now();
}

/**
 * 格式化日期
 * @param {Date|number} date - 日期对象或时间戳
 * @param {string} format - 格式化模板
 * @returns {string}
 */
export function formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  
  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}
