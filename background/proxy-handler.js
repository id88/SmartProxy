/**
 * SmartProxy 代理处理器
 * 核心代理逻辑，处理 browser.proxy.onRequest
 */

import { storage } from './storage.js';
import { ruleEngine } from './rule-engine.js';

/**
 * 代理模式枚举
 */
export const ProxyMode = {
    DIRECT: 'direct',     // 直连
    GLOBAL: 'global',     // 全局代理
    AUTO: 'auto',         // 按规则自动切换
    PAC: 'pac',           // PAC 脚本
    SYSTEM: 'system'      // 系统代理
};

/**
 * 代理处理器类
 */
class ProxyHandler {
    constructor() {
        this.currentMode = ProxyMode.DIRECT;
        this.globalProxy = null;
        this.initialized = false;
    }

    /**
     * 初始化代理处理器
     */
    async init() {
        if (this.initialized) return;

        // 监听代理请求
        browser.proxy.onRequest.addListener(
            (requestInfo) => this.handleRequest(requestInfo),
            { urls: ['<all_urls>'] }
        );

        // 监听代理错误
        browser.proxy.onError.addListener((error) => {
            console.error('代理错误:', error);
        });

        // 从存储加载配置
        await this.loadFromStorage();

        // 监听存储变化
        storage.addListener((changes) => {
            this.handleStorageChange(changes);
        });

        this.initialized = true;
        console.log('代理处理器已初始化');
    }

    /**
     * 从存储加载配置
     */
    async loadFromStorage() {
        const settings = storage.getSettings();
        this.currentMode = settings.mode || ProxyMode.DIRECT;

        if (settings.globalProxyId) {
            this.globalProxy = storage.getProxy(settings.globalProxyId);
        }

        // 加载规则到规则引擎
        ruleEngine.setRules(storage.getRules());
    }

    /**
     * 处理存储变化
     */
    handleStorageChange(changes) {
        if (changes.settings) {
            const settings = changes.settings.newValue;
            this.currentMode = settings.mode || ProxyMode.DIRECT;

            if (settings.globalProxyId) {
                this.globalProxy = storage.getProxy(settings.globalProxyId);
            } else {
                this.globalProxy = null;
            }
        }

        if (changes.rules) {
            ruleEngine.setRules(changes.rules.newValue || []);
        }

        if (changes.proxies) {
            // 如果代理配置变了，重新加载全局代理
            const settings = storage.getSettings();
            if (settings.globalProxyId) {
                this.globalProxy = storage.getProxy(settings.globalProxyId);
            }
        }
    }

    /**
     * 处理代理请求
     * @param {Object} requestInfo - 请求信息
     * @returns {Object} 代理配置
     */
    handleRequest(requestInfo) {
        const url = requestInfo.url;

        try {
            switch (this.currentMode) {
                case ProxyMode.DIRECT:
                    return { type: 'direct' };

                case ProxyMode.GLOBAL:
                    return this.getProxyConfig(this.globalProxy);

                case ProxyMode.AUTO:
                    return this.handleAutoMode(url);

                case ProxyMode.PAC:
                    return this.handlePacMode();

                case ProxyMode.SYSTEM:
                    return { type: 'system' };

                default:
                    return { type: 'direct' };
            }
        } catch (error) {
            console.error('处理代理请求失败:', error);
            return { type: 'direct' };
        }
    }

    /**
     * 处理自动模式
     * @param {string} url - 请求 URL
     * @returns {Object}
     */
    handleAutoMode(url) {
        const matchResult = ruleEngine.match(url);

        if (matchResult) {
            if (matchResult.proxyId === 'direct') {
                return { type: 'direct' };
            }

            const proxy = storage.getProxy(matchResult.proxyId);
            if (proxy) {
                return this.getProxyConfig(proxy);
            }
        }

        // 无匹配规则，使用默认动作
        const settings = storage.getSettings();
        if (settings.defaultAction && settings.defaultAction !== 'direct') {
            const defaultProxy = storage.getProxy(settings.defaultAction);
            if (defaultProxy) {
                return this.getProxyConfig(defaultProxy);
            }
        }

        return { type: 'direct' };
    }

    /**
     * 处理 PAC 模式
     * @returns {Object}
     */
    handlePacMode() {
        const settings = storage.getSettings();

        if (settings.pacScriptUrl) {
            return {
                type: 'pac',
                url: settings.pacScriptUrl
            };
        }

        if (settings.pacScriptData) {
            return {
                type: 'pac',
                data: settings.pacScriptData
            };
        }

        return { type: 'direct' };
    }

    /**
     * 获取代理配置对象
     * @param {Object} proxy - 代理配置
     * @returns {Object} Firefox 代理配置格式
     */
    getProxyConfig(proxy) {
        if (!proxy || !proxy.enabled) {
            return { type: 'direct' };
        }

        const config = {
            type: this.mapProxyType(proxy.type),
            host: proxy.host,
            port: proxy.port
        };

        // 添加认证信息
        if (proxy.username) {
            config.username = proxy.username;
            config.password = storage.getProxyPassword(proxy.id);
        }

        // SOCKS 代理支持远程 DNS
        if (proxy.type === 'socks5' || proxy.type === 'socks4') {
            config.proxyDNS = true;
        }

        return config;
    }

    /**
     * 映射代理类型
     * @param {string} type - 代理类型
     * @returns {string}
     */
    mapProxyType(type) {
        const typeMap = {
            'http': 'http',
            'https': 'https',
            'socks4': 'socks4',
            'socks5': 'socks'
        };
        return typeMap[type] || 'http';
    }

    /**
     * 设置代理模式
     * @param {string} mode - 代理模式
     * @param {string} proxyId - 代理 ID（全局模式需要）
     */
    async setMode(mode, proxyId = null) {
        await storage.setMode(mode, proxyId);
        this.currentMode = mode;

        if (mode === ProxyMode.GLOBAL && proxyId) {
            this.globalProxy = storage.getProxy(proxyId);
        }
    }

    /**
     * 获取当前状态
     * @returns {Object}
     */
    getStatus() {
        return {
            mode: this.currentMode,
            globalProxy: this.globalProxy ? {
                id: this.globalProxy.id,
                name: this.globalProxy.name,
                color: this.globalProxy.color
            } : null,
            ruleStats: ruleEngine.getStats()
        };
    }

    /**
     * 测试 URL 匹配
     * @param {string} url - URL
     * @returns {Object}
     */
    testUrl(url) {
        const result = ruleEngine.testMatch(url);

        // 添加代理信息
        if (result.matchedRule && result.matchedRule.proxyId !== 'direct') {
            const proxy = storage.getProxy(result.matchedRule.proxyId);
            if (proxy) {
                result.proxy = {
                    id: proxy.id,
                    name: proxy.name,
                    type: proxy.type,
                    host: proxy.host,
                    port: proxy.port
                };
            }
        }

        return result;
    }
}

// 导出单例
export const proxyHandler = new ProxyHandler();
export default proxyHandler;
