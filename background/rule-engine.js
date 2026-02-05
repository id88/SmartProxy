/**
 * SmartProxy 规则匹配引擎
 */

import { wildcardToRegex, isIpInCidr, isValidIp, parseUrl } from '../lib/utils.js';

/**
 * 规则匹配引擎类
 */
class RuleEngine {
    constructor() {
        this.rules = [];
        this.compiledRules = new Map(); // 缓存编译后的规则
    }

    /**
     * 设置规则列表
     * @param {Array} rules - 规则数组
     */
    setRules(rules) {
        this.rules = rules.filter(r => r.enabled);
        this.compileRules();
    }

    /**
     * 编译规则（预处理正则表达式等）
     */
    compileRules() {
        this.compiledRules.clear();

        for (const rule of this.rules) {
            try {
                let compiled = null;

                switch (rule.type) {
                    case 'wildcard':
                        compiled = {
                            type: 'regex',
                            regex: wildcardToRegex(rule.pattern)
                        };
                        break;

                    case 'regexp':
                        compiled = {
                            type: 'regex',
                            regex: new RegExp(rule.pattern, 'i')
                        };
                        break;

                    case 'domain':
                        // 域名匹配：支持精确匹配和子域名匹配
                        compiled = {
                            type: 'domain',
                            domain: rule.pattern.toLowerCase(),
                            isWildcard: rule.pattern.startsWith('*.')
                        };
                        break;

                    case 'ip':
                        // IP/CIDR 匹配
                        compiled = {
                            type: 'ip',
                            cidr: rule.pattern,
                            isCidr: rule.pattern.includes('/')
                        };
                        break;

                    default:
                        // 默认作为通配符处理
                        compiled = {
                            type: 'regex',
                            regex: wildcardToRegex(rule.pattern)
                        };
                }

                this.compiledRules.set(rule.id, compiled);
            } catch (error) {
                console.error(`规则编译失败: ${rule.pattern}`, error);
            }
        }
    }

    /**
     * 匹配 URL
     * @param {string} url - 要匹配的 URL
     * @returns {Object|null} 匹配的规则，包含 proxyId
     */
    match(url) {
        const urlInfo = parseUrl(url);
        if (!urlInfo) return null;

        for (const rule of this.rules) {
            const compiled = this.compiledRules.get(rule.id);
            if (!compiled) continue;

            let matched = false;

            switch (compiled.type) {
                case 'regex':
                    matched = compiled.regex.test(url);
                    break;

                case 'domain':
                    matched = this.matchDomain(urlInfo.host, compiled);
                    break;

                case 'ip':
                    matched = this.matchIp(urlInfo.host, compiled);
                    break;
            }

            if (matched) {
                return {
                    rule: rule,
                    proxyId: rule.proxyId
                };
            }
        }

        return null;
    }

    /**
     * 域名匹配
     * @param {string} host - 主机名
     * @param {Object} compiled - 编译后的规则
     * @returns {boolean}
     */
    matchDomain(host, compiled) {
        const hostLower = host.toLowerCase();

        if (compiled.isWildcard) {
            // *.example.com 匹配 sub.example.com 和 example.com
            const baseDomain = compiled.domain.slice(2); // 去掉 *.
            return hostLower === baseDomain || hostLower.endsWith('.' + baseDomain);
        } else {
            // 精确匹配
            return hostLower === compiled.domain;
        }
    }

    /**
     * IP 匹配
     * @param {string} host - 主机名（可能是 IP）
     * @param {Object} compiled - 编译后的规则
     * @returns {boolean}
     */
    matchIp(host, compiled) {
        if (!isValidIp(host)) {
            return false;
        }

        if (compiled.isCidr) {
            return isIpInCidr(host, compiled.cidr);
        } else {
            return host === compiled.cidr;
        }
    }

    /**
     * 测试 URL 匹配（用于调试）
     * @param {string} url - URL
     * @returns {Object} 匹配结果详情
     */
    testMatch(url) {
        const result = {
            url: url,
            matched: false,
            matchedRule: null,
            testedRules: []
        };

        const urlInfo = parseUrl(url);
        if (!urlInfo) {
            result.error = '无效的 URL';
            return result;
        }

        for (const rule of this.rules) {
            const compiled = this.compiledRules.get(rule.id);
            const ruleResult = {
                pattern: rule.pattern,
                type: rule.type,
                matched: false
            };

            if (compiled) {
                switch (compiled.type) {
                    case 'regex':
                        ruleResult.matched = compiled.regex.test(url);
                        break;
                    case 'domain':
                        ruleResult.matched = this.matchDomain(urlInfo.host, compiled);
                        break;
                    case 'ip':
                        ruleResult.matched = this.matchIp(urlInfo.host, compiled);
                        break;
                }
            }

            result.testedRules.push(ruleResult);

            if (ruleResult.matched && !result.matched) {
                result.matched = true;
                result.matchedRule = rule;
            }
        }

        return result;
    }

    /**
     * 获取规则统计
     * @returns {Object}
     */
    getStats() {
        return {
            total: this.rules.length,
            byType: {
                wildcard: this.rules.filter(r => r.type === 'wildcard').length,
                regexp: this.rules.filter(r => r.type === 'regexp').length,
                domain: this.rules.filter(r => r.type === 'domain').length,
                ip: this.rules.filter(r => r.type === 'ip').length
            }
        };
    }
}

// 导出单例
export const ruleEngine = new RuleEngine();
export default ruleEngine;
