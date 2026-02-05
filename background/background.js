/**
 * SmartProxy 后台主入口脚本
 */

import { storage } from './storage.js';
import { proxyHandler, ProxyMode } from './proxy-handler.js';

/**
 * 初始化扩展
 */
async function init() {
    console.log('SmartProxy 正在初始化...');

    try {
        // 初始化存储
        await storage.init();

        // 初始化代理处理器
        await proxyHandler.init();

        // 设置代理认证
        setupProxyAuth();

        // 设置右键菜单
        setupContextMenus();

        // 监听消息
        setupMessageListener();

        // 监听标签页更新
        setupTabListener();

        // 更新图标状态
        updateIcon();

        // 监听存储变化更新图标
        storage.addListener(() => updateIcon());

        console.log('SmartProxy 初始化完成');
    } catch (error) {
        console.error('SmartProxy 初始化失败:', error);
    }
}

/**
 * 设置代理认证
 * 使用 webRequest.onAuthRequired 处理代理服务器的用户名密码认证
 */
function setupProxyAuth() {
    browser.webRequest.onAuthRequired.addListener(
        handleProxyAuth,
        { urls: ['<all_urls>'] },
        ['blocking']
    );
    console.log('代理认证监听器已设置');
}

/**
 * 处理代理认证请求
 * @param {Object} details - 认证请求详情
 * @returns {Object} 包含认证凭证的响应
 */
function handleProxyAuth(details) {
    // 只处理代理认证，不处理服务器认证
    if (!details.isProxy) {
        return {};
    }

    console.log('收到代理认证请求:', details.challenger?.host);

    // 获取当前使用的代理
    const status = proxyHandler.getStatus();
    const proxies = storage.getProxies();

    // 查找匹配的代理（通过主机名和端口）
    const matchingProxy = proxies.find(p =>
        p.host === details.challenger?.host &&
        p.port === details.challenger?.port &&
        p.username // 只匹配有用户名的代理
    );

    if (matchingProxy) {
        const password = storage.getProxyPassword(matchingProxy.id);
        console.log('提供代理认证凭证:', matchingProxy.name);
        return {
            authCredentials: {
                username: matchingProxy.username,
                password: password
            }
        };
    }

    // 如果全局代理有认证信息
    if (status.mode === 'global' && status.globalProxy) {
        const globalProxyFull = storage.getProxy(status.globalProxy.id);
        if (globalProxyFull && globalProxyFull.username) {
            const password = storage.getProxyPassword(globalProxyFull.id);
            console.log('使用全局代理认证凭证');
            return {
                authCredentials: {
                    username: globalProxyFull.username,
                    password: password
                }
            };
        }
    }

    console.log('未找到匹配的代理认证信息');
    return {};
}

/**
 * 设置右键菜单
 */
function setupContextMenus() {
    // 清除旧菜单
    browser.contextMenus.removeAll();

    const settings = storage.getSettings();
    if (!settings.enableContextMenu) return;

    // 添加网站规则菜单
    browser.contextMenus.create({
        id: 'add-rule-for-site',
        title: browser.i18n.getMessage('contextMenuAddRule') || '为此网站添加代理规则',
        contexts: ['page']
    });

    // 临时禁用代理
    browser.contextMenus.create({
        id: 'temp-disable-proxy',
        title: browser.i18n.getMessage('contextMenuTempDisable') || '临时禁用此页面代理',
        contexts: ['page']
    });

    // 分隔线
    browser.contextMenus.create({
        id: 'separator',
        type: 'separator',
        contexts: ['page']
    });

    // 代理模式子菜单
    browser.contextMenus.create({
        id: 'proxy-mode',
        title: browser.i18n.getMessage('contextMenuProxyMode') || '代理模式',
        contexts: ['page']
    });

    browser.contextMenus.create({
        id: 'mode-direct',
        parentId: 'proxy-mode',
        title: browser.i18n.getMessage('modeDirect') || '直接连接',
        type: 'radio',
        checked: settings.mode === 'direct',
        contexts: ['page']
    });

    browser.contextMenus.create({
        id: 'mode-global',
        parentId: 'proxy-mode',
        title: browser.i18n.getMessage('modeGlobal') || '全局代理',
        type: 'radio',
        checked: settings.mode === 'global',
        contexts: ['page']
    });

    browser.contextMenus.create({
        id: 'mode-auto',
        parentId: 'proxy-mode',
        title: browser.i18n.getMessage('modeAuto') || '按规则代理',
        type: 'radio',
        checked: settings.mode === 'auto',
        contexts: ['page']
    });

    // 监听菜单点击
    browser.contextMenus.onClicked.addListener(handleContextMenuClick);
}

/**
 * 处理右键菜单点击
 */
async function handleContextMenuClick(info, tab) {
    switch (info.menuItemId) {
        case 'add-rule-for-site':
            // 获取当前网站域名并添加规则
            if (tab && tab.url) {
                try {
                    const url = new URL(tab.url);
                    await storage.addRule({
                        pattern: `*://${url.hostname}/*`,
                        type: 'wildcard',
                        proxyId: 'direct', // 默认直连，用户可以在设置中修改
                        note: `从 ${url.hostname} 添加`
                    });

                    showNotification(
                        browser.i18n.getMessage('ruleAdded') || '规则已添加',
                        `已为 ${url.hostname} 添加规则`
                    );
                } catch (e) {
                    console.error('添加规则失败:', e);
                }
            }
            break;

        case 'temp-disable-proxy':
            // 临时切换到直连模式
            await proxyHandler.setMode(ProxyMode.DIRECT);
            updateIcon();
            showNotification(
                browser.i18n.getMessage('proxyDisabled') || '代理已禁用',
                '当前使用直接连接'
            );
            break;

        case 'mode-direct':
            await proxyHandler.setMode(ProxyMode.DIRECT);
            updateIcon();
            break;

        case 'mode-global':
            const proxies = storage.getProxies();
            if (proxies.length > 0) {
                await proxyHandler.setMode(ProxyMode.GLOBAL, proxies[0].id);
            }
            updateIcon();
            break;

        case 'mode-auto':
            await proxyHandler.setMode(ProxyMode.AUTO);
            updateIcon();
            break;
    }
}

/**
 * 设置消息监听
 */
function setupMessageListener() {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        return handleMessage(message, sender);
    });
}

/**
 * 处理消息
 */
async function handleMessage(message, sender) {
    console.log('收到消息:', message.type);

    switch (message.type) {
        // 获取状态
        case 'getStatus':
            return {
                status: proxyHandler.getStatus(),
                proxies: storage.getProxies(),
                rules: storage.getRules(),
                settings: storage.getSettings()
            };

        // 设置代理模式
        case 'setMode':
            await proxyHandler.setMode(message.mode, message.proxyId);
            updateIcon();
            return { success: true };

        // 代理配置 CRUD
        case 'getProxies':
            return storage.getProxies();

        case 'addProxy':
            return await storage.addProxy(message.proxy);

        case 'updateProxy':
            return await storage.updateProxy(message.id, message.updates);

        case 'deleteProxy':
            return await storage.deleteProxy(message.id);

        // 规则 CRUD
        case 'getRules':
            return storage.getRules();

        case 'addRule':
            console.log('[background] 收到 addRule 请求:', message.rule);
            const newRule = await storage.addRule(message.rule);
            console.log('[background] addRule 完成, 新规则:', newRule);
            return newRule;

        case 'updateRule':
            return await storage.updateRule(message.id, message.updates);

        case 'deleteRule':
            return await storage.deleteRule(message.id);

        case 'reorderRules':
            return await storage.reorderRules(message.ruleIds);

        // 设置
        case 'getSettings':
            return storage.getSettings();

        case 'updateSettings':
            const settings = await storage.updateSettings(message.settings);
            setupContextMenus(); // 重新设置菜单
            return settings;

        // 测试 URL
        case 'testUrl':
            return proxyHandler.testUrl(message.url);

        // 导入导出
        case 'exportConfig':
            return await storage.exportConfig();

        case 'importConfig':
            return await storage.importConfig(message.config, message.options);

        // 重置
        case 'reset':
            await storage.reset();
            await proxyHandler.loadFromStorage();
            updateIcon();
            return { success: true };

        default:
            console.warn('未知消息类型:', message.type);
            return { error: '未知消息类型' };
    }
}

/**
 * 设置标签页监听
 */
function setupTabListener() {
    browser.tabs.onActivated.addListener(async (activeInfo) => {
        try {
            const tab = await browser.tabs.get(activeInfo.tabId);
            updateIconForTab(tab);
        } catch (e) {
            // 忽略错误
        }
    });

    browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === 'complete') {
            updateIconForTab(tab);
        }
    });
}

/**
 * 更新工具栏图标
 */
function updateIcon() {
    const status = proxyHandler.getStatus();
    let iconSuffix = '';
    let badgeText = '';
    let badgeColor = '#666666';

    switch (status.mode) {
        case ProxyMode.DIRECT:
            iconSuffix = 'gray';
            badgeText = 'OFF';
            badgeColor = '#666666';
            break;

        case ProxyMode.GLOBAL:
            iconSuffix = 'green';
            badgeText = status.globalProxy?.name?.charAt(0)?.toUpperCase() || 'G';
            badgeColor = status.globalProxy?.color || '#10b981';
            break;

        case ProxyMode.AUTO:
            iconSuffix = 'blue';
            badgeText = 'A';
            badgeColor = '#3b82f6';
            break;

        case ProxyMode.PAC:
            iconSuffix = 'purple';
            badgeText = 'P';
            badgeColor = '#8b5cf6';
            break;
    }

    // 设置 badge
    browser.action.setBadgeText({ text: badgeText });
    browser.action.setBadgeBackgroundColor({ color: badgeColor });

    // TODO: 根据模式切换图标（需要不同颜色的图标文件）
    // browser.action.setIcon({ path: `icons/icon-${iconSuffix}.png` });
}

/**
 * 更新特定标签页的图标状态
 */
function updateIconForTab(tab) {
    if (!tab || !tab.url) return;

    // 可以在这里添加针对特定标签页的图标更新逻辑
    // 例如显示当前页面匹配的代理
}

/**
 * 显示通知
 */
function showNotification(title, message) {
    const settings = storage.getSettings();
    if (!settings.enableNotifications) return;

    browser.notifications.create({
        type: 'basic',
        title: title,
        message: message,
        iconUrl: browser.runtime.getURL('icons/icon-48.png')
    });
}

// 启动初始化
init();
