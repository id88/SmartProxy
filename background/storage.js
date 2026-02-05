/**
 * SmartProxy 存储管理模块
 */

import { generateUUID, deepClone, simpleEncrypt, simpleDecrypt } from '../lib/utils.js';

// 默认配置
const DEFAULT_CONFIG = {
    proxies: [],
    rules: [],
    settings: {
        mode: 'direct',           // direct, global, auto, pac
        globalProxyId: null,      // 全局模式使用的代理 ID
        pacScriptUrl: '',         // PAC 脚本 URL
        pacScriptData: '',        // PAC 脚本内容
        defaultAction: 'direct',  // 默认动作：direct 或代理 ID
        enableNotifications: true,
        enableContextMenu: true,
        logLevel: 'info'          // debug, info, warn, error
    }
};

/**
 * 存储管理类
 */
class Storage {
    constructor() {
        this.cache = null;
        this.listeners = new Set();
    }

    /**
     * 初始化存储
     */
    async init() {
        const data = await browser.storage.local.get(null);
        if (!data.proxies) {
            // 首次安装，使用默认配置
            await this.reset();
        } else {
            this.cache = {
                proxies: data.proxies || [],
                rules: data.rules || [],
                settings: { ...DEFAULT_CONFIG.settings, ...data.settings }
            };
        }

        // 监听存储变化
        browser.storage.onChanged.addListener((changes, area) => {
            if (area === 'local') {
                this.handleStorageChange(changes);
            }
        });

        return this.cache;
    }

    /**
     * 处理存储变化
     */
    handleStorageChange(changes) {
        for (const key of Object.keys(changes)) {
            if (this.cache && changes[key].newValue !== undefined) {
                this.cache[key] = changes[key].newValue;
            }
        }
        // 通知监听器
        this.listeners.forEach(listener => listener(changes));
    }

    /**
     * 添加变化监听器
     */
    addListener(callback) {
        this.listeners.add(callback);
    }

    /**
     * 移除变化监听器
     */
    removeListener(callback) {
        this.listeners.delete(callback);
    }

    /**
     * 重置为默认配置
     */
    async reset() {
        this.cache = deepClone(DEFAULT_CONFIG);
        await browser.storage.local.clear();
        await browser.storage.local.set(this.cache);
        return this.cache;
    }

    // ==================== 代理配置管理 ====================

    /**
     * 获取所有代理配置
     */
    getProxies() {
        return this.cache?.proxies || [];
    }

    /**
     * 获取单个代理配置
     */
    getProxy(id) {
        return this.getProxies().find(p => p.id === id);
    }

    /**
     * 添加代理配置
     */
    async addProxy(proxy) {
        const newProxy = {
            id: generateUUID(),
            name: proxy.name || '未命名代理',
            type: proxy.type || 'http',      // http, https, socks4, socks5
            host: proxy.host || '',
            port: parseInt(proxy.port) || 1080,
            username: proxy.username || '',
            password: simpleEncrypt(proxy.password || ''),
            color: proxy.color || '#3b82f6',
            enabled: proxy.enabled !== false,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        const proxies = [...this.cache.proxies, newProxy];
        await browser.storage.local.set({ proxies });
        this.cache.proxies = proxies;

        return newProxy;
    }

    /**
     * 更新代理配置
     */
    async updateProxy(id, updates) {
        const proxies = this.cache.proxies.map(p => {
            if (p.id === id) {
                return {
                    ...p,
                    ...updates,
                    password: updates.password !== undefined
                        ? simpleEncrypt(updates.password)
                        : p.password,
                    updatedAt: Date.now()
                };
            }
            return p;
        });

        await browser.storage.local.set({ proxies });
        this.cache.proxies = proxies;

        return this.getProxy(id);
    }

    /**
     * 删除代理配置
     */
    async deleteProxy(id) {
        const proxies = this.cache.proxies.filter(p => p.id !== id);

        // 同时清理使用该代理的规则
        const rules = this.cache.rules.map(r => {
            if (r.proxyId === id) {
                return { ...r, proxyId: 'direct' };
            }
            return r;
        });

        // 如果全局代理是这个，重置为直连
        let settings = this.cache.settings;
        if (settings.globalProxyId === id) {
            settings = { ...settings, globalProxyId: null, mode: 'direct' };
        }

        await browser.storage.local.set({ proxies, rules, settings });
        this.cache.proxies = proxies;
        this.cache.rules = rules;
        this.cache.settings = settings;

        return true;
    }

    /**
     * 获取解密后的代理密码
     */
    getProxyPassword(id) {
        const proxy = this.getProxy(id);
        return proxy ? simpleDecrypt(proxy.password) : '';
    }

    // ==================== 规则管理 ====================

    /**
     * 获取所有规则
     */
    getRules() {
        return this.cache?.rules || [];
    }

    /**
     * 获取单个规则
     */
    getRule(id) {
        return this.getRules().find(r => r.id === id);
    }

    /**
     * 添加规则
     */
    async addRule(rule) {
        const newRule = {
            id: generateUUID(),
            pattern: rule.pattern || '',
            type: rule.type || 'wildcard',  // wildcard, regexp, domain, ip
            proxyId: rule.proxyId || 'direct',
            enabled: rule.enabled !== false,
            note: rule.note || '',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        const rules = [...this.cache.rules, newRule];
        await browser.storage.local.set({ rules });
        this.cache.rules = rules;

        return newRule;
    }

    /**
     * 更新规则
     */
    async updateRule(id, updates) {
        const rules = this.cache.rules.map(r => {
            if (r.id === id) {
                return {
                    ...r,
                    ...updates,
                    updatedAt: Date.now()
                };
            }
            return r;
        });

        await browser.storage.local.set({ rules });
        this.cache.rules = rules;

        return this.getRule(id);
    }

    /**
     * 删除规则
     */
    async deleteRule(id) {
        const rules = this.cache.rules.filter(r => r.id !== id);
        await browser.storage.local.set({ rules });
        this.cache.rules = rules;
        return true;
    }

    /**
     * 批量更新规则顺序
     */
    async reorderRules(ruleIds) {
        const ruleMap = new Map(this.cache.rules.map(r => [r.id, r]));
        const rules = ruleIds
            .filter(id => ruleMap.has(id))
            .map(id => ruleMap.get(id));

        await browser.storage.local.set({ rules });
        this.cache.rules = rules;

        return rules;
    }

    /**
     * 批量启用/禁用规则
     */
    async setRulesEnabled(ruleIds, enabled) {
        const rules = this.cache.rules.map(r => {
            if (ruleIds.includes(r.id)) {
                return { ...r, enabled, updatedAt: Date.now() };
            }
            return r;
        });

        await browser.storage.local.set({ rules });
        this.cache.rules = rules;

        return rules;
    }

    // ==================== 设置管理 ====================

    /**
     * 获取所有设置
     */
    getSettings() {
        return this.cache?.settings || DEFAULT_CONFIG.settings;
    }

    /**
     * 更新设置
     */
    async updateSettings(updates) {
        const settings = { ...this.cache.settings, ...updates };
        await browser.storage.local.set({ settings });
        this.cache.settings = settings;
        return settings;
    }

    /**
     * 设置代理模式
     */
    async setMode(mode, proxyId = null) {
        const updates = { mode };
        if (mode === 'global' && proxyId) {
            updates.globalProxyId = proxyId;
        }
        return this.updateSettings(updates);
    }

    // ==================== 导入/导出 ====================

    /**
     * 导出所有配置
     */
    async exportConfig() {
        const data = {
            version: '1.0.0',
            exportedAt: Date.now(),
            proxies: this.cache.proxies.map(p => ({
                ...p,
                password: '' // 不导出密码
            })),
            rules: this.cache.rules,
            settings: this.cache.settings
        };

        return JSON.stringify(data, null, 2);
    }

    /**
     * 导入配置
     */
    async importConfig(jsonString, options = { merge: false }) {
        try {
            const data = JSON.parse(jsonString);

            if (!data.version) {
                throw new Error('无效的配置文件格式');
            }

            let proxies, rules, settings;

            if (options.merge) {
                // 合并模式
                const existingProxyHosts = new Set(
                    this.cache.proxies.map(p => `${p.host}:${p.port}`)
                );
                const newProxies = (data.proxies || [])
                    .filter(p => !existingProxyHosts.has(`${p.host}:${p.port}`))
                    .map(p => ({ ...p, id: generateUUID() }));

                proxies = [...this.cache.proxies, ...newProxies];
                rules = [...this.cache.rules, ...(data.rules || []).map(r => ({ ...r, id: generateUUID() }))];
                settings = { ...this.cache.settings, ...data.settings };
            } else {
                // 覆盖模式
                proxies = (data.proxies || []).map(p => ({ ...p, id: generateUUID() }));
                rules = (data.rules || []).map(r => ({ ...r, id: generateUUID() }));
                settings = { ...DEFAULT_CONFIG.settings, ...data.settings };
            }

            await browser.storage.local.set({ proxies, rules, settings });
            this.cache = { proxies, rules, settings };

            return { success: true, proxies: proxies.length, rules: rules.length };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

// 导出单例
export const storage = new Storage();
export default storage;
