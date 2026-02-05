/**
 * SmartProxy Popup 脚本
 */

// 当前状态
let currentState = {
    mode: 'direct',
    proxies: [],
    rules: [],
    settings: {},
    globalProxyId: null
};

/**
 * 初始化
 */
async function init() {
    // 加载主题
    loadTheme();

    // 加载状态
    await loadStatus();

    // 绑定事件
    bindEvents();

    // 更新 UI
    updateUI();

    // 国际化
    localizeUI();
}

/**
 * 加载主题
 */
function loadTheme() {
    const savedTheme = localStorage.getItem('smartproxy-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

/**
 * 加载状态
 */
async function loadStatus() {
    try {
        const response = await browser.runtime.sendMessage({ type: 'getStatus' });
        currentState = {
            mode: response.status.mode,
            proxies: response.proxies || [],
            rules: response.rules || [],
            settings: response.settings || {},
            globalProxyId: response.status.globalProxy?.id || null
        };
    } catch (error) {
        console.error('加载状态失败:', error);
    }
}

/**
 * 绑定事件
 */
function bindEvents() {
    // 模式切换
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => handleModeChange(btn.dataset.mode));
    });

    // 规则测试
    document.getElementById('testBtn').addEventListener('click', handleTestUrl);
    document.getElementById('testUrl').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleTestUrl();
    });

    // 添加规则
    document.getElementById('addRuleBtn').addEventListener('click', handleAddRule);

    // 打开设置
    document.getElementById('openOptionsBtn').addEventListener('click', () => {
        browser.runtime.openOptionsPage();
        window.close();
    });
}

/**
 * 更新 UI
 */
function updateUI() {
    updateModeButtons();
    updateStatusBadge();
    updateProxyList();
}

/**
 * 更新模式按钮
 */
function updateModeButtons() {
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === currentState.mode);
    });
}

/**
 * 更新状态徽章
 */
function updateStatusBadge() {
    const badge = document.getElementById('statusBadge');
    const textEl = badge.querySelector('.status-text');

    // 移除所有状态类
    badge.classList.remove('active', 'auto', 'pac');

    const modeTexts = {
        'direct': '直接连接',
        'global': '全局代理',
        'auto': '按规则代理',
        'pac': 'PAC 脚本'
    };

    textEl.textContent = modeTexts[currentState.mode] || '未知';

    // 添加状态类
    if (currentState.mode === 'global') {
        badge.classList.add('active');
        // 显示当前代理名称
        const proxy = currentState.proxies.find(p => p.id === currentState.globalProxyId);
        if (proxy) {
            textEl.textContent = proxy.name;
        }
    } else if (currentState.mode === 'auto') {
        badge.classList.add('auto');
    } else if (currentState.mode === 'pac') {
        badge.classList.add('pac');
    }
}

/**
 * 更新代理列表
 */
function updateProxyList() {
    const container = document.getElementById('proxyList');
    container.innerHTML = '';

    if (currentState.proxies.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = '暂无代理配置';
        container.appendChild(empty);
        return;
    }

    currentState.proxies.forEach(proxy => {
        const divItem = document.createElement('div');
        divItem.className = 'proxy-item' + (proxy.id === currentState.globalProxyId ? ' selected' : '');
        divItem.dataset.id = proxy.id;

        const divColor = document.createElement('div');
        divColor.className = 'proxy-color';
        divColor.style.backgroundColor = proxy.color;
        divItem.appendChild(divColor);

        const divInfo = document.createElement('div');
        divInfo.className = 'proxy-info';

        const divName = document.createElement('div');
        divName.className = 'proxy-name';
        divName.textContent = proxy.name;
        divInfo.appendChild(divName);

        const divAddress = document.createElement('div');
        divAddress.className = 'proxy-address';
        divAddress.textContent = `${proxy.host}:${proxy.port}`;
        divInfo.appendChild(divAddress);

        divItem.appendChild(divInfo);

        const spanType = document.createElement('span');
        spanType.className = 'proxy-type';
        spanType.textContent = proxy.type;
        divItem.appendChild(spanType);

        container.appendChild(divItem);
    });

    // 绑定点击事件
    container.querySelectorAll('.proxy-item').forEach(item => {
        item.addEventListener('click', () => handleProxySelect(item.dataset.id));
    });
}

/**
 * 处理模式切换
 */
async function handleModeChange(mode) {
    try {
        let proxyId = null;

        if (mode === 'global') {
            // 全局模式需要选择代理
            if (currentState.proxies.length === 0) {
                showMessage('请先添加代理配置', 'warning');
                return;
            }
            proxyId = currentState.globalProxyId || currentState.proxies[0].id;
        }

        await browser.runtime.sendMessage({
            type: 'setMode',
            mode: mode,
            proxyId: proxyId
        });

        currentState.mode = mode;
        if (proxyId) currentState.globalProxyId = proxyId;

        updateUI();
    } catch (error) {
        console.error('切换模式失败:', error);
        showMessage('切换失败', 'error');
    }
}

/**
 * 处理代理选择
 */
async function handleProxySelect(proxyId) {
    try {
        // 切换到全局模式并使用选中的代理
        await browser.runtime.sendMessage({
            type: 'setMode',
            mode: 'global',
            proxyId: proxyId
        });

        currentState.mode = 'global';
        currentState.globalProxyId = proxyId;

        updateUI();
    } catch (error) {
        console.error('选择代理失败:', error);
    }
}

/**
 * 处理 URL 测试
 */
async function handleTestUrl() {
    const input = document.getElementById('testUrl');
    const resultEl = document.getElementById('testResult');
    const url = input.value.trim();

    if (!url) {
        showMessage('请输入 URL', 'warning');
        return;
    }

    // 添加协议前缀
    let testUrl = url;
    if (!url.match(/^https?:\/\//)) {
        testUrl = 'https://' + url;
    }

    try {
        const result = await browser.runtime.sendMessage({
            type: 'testUrl',
            url: testUrl
        });

        resultEl.classList.add('show');
        resultEl.innerHTML = ''; // Clear previous

        if (result.matched) {
            resultEl.classList.remove('no-match');
            resultEl.classList.add('matched');

            const divMatch = document.createElement('div');
            const bMatch = document.createElement('strong');
            bMatch.textContent = '✓ 匹配规则: ';
            divMatch.appendChild(bMatch);
            divMatch.appendChild(document.createTextNode(result.matchedRule.pattern));
            resultEl.appendChild(divMatch);

            const divType = document.createElement('div');
            const bType = document.createElement('strong');
            bType.textContent = '规则类型: ';
            divType.appendChild(bType);
            divType.appendChild(document.createTextNode(result.matchedRule.type));
            resultEl.appendChild(divType);

            const divProxy = document.createElement('div');
            const bProxy = document.createElement('strong');
            bProxy.textContent = '代理: ';
            divProxy.appendChild(bProxy);
            divProxy.appendChild(document.createTextNode(result.proxy ? result.proxy.name : '直接连接'));
            resultEl.appendChild(divProxy);

        } else {
            resultEl.classList.remove('matched');
            resultEl.classList.add('no-match');
            const div = document.createElement('div');
            div.textContent = '✗ 未匹配任何规则，将使用默认设置';
            resultEl.appendChild(div);
        }
    } catch (error) {
        console.error('测试失败:', error);
        resultEl.classList.add('show', 'no-match');
        resultEl.innerHTML = '';
        const div = document.createElement('div');
        div.textContent = '测试失败: ' + error.message;
        resultEl.appendChild(div);
    }
}

/**
 * 处理添加规则
 */
async function handleAddRule() {
    console.log('[popup] handleAddRule 开始执行');
    try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        console.log('[popup] 当前标签页:', tab);

        if (!tab || !tab.url) {
            console.log('[popup] 无法获取标签页 URL');
            showMessage('无法获取当前页面', 'error');
            return;
        }

        const url = new URL(tab.url);
        console.log('[popup] 解析的 URL:', url.hostname);

        const ruleData = {
            pattern: `*://${url.hostname}/*`,
            type: 'wildcard',
            proxyId: 'direct',
            note: `从弹出窗口添加`
        };
        console.log('[popup] 要添加的规则:', ruleData);

        const result = await browser.runtime.sendMessage({
            type: 'addRule',
            rule: ruleData
        });
        console.log('[popup] addRule 响应:', result);

        showMessage(`已为 ${url.hostname} 添加规则`, 'success');

        // 刷新状态
        await loadStatus();
        updateUI();
    } catch (error) {
        console.error('[popup] 添加规则失败:', error);
        showMessage('添加失败: ' + error.message, 'error');
    }
}

/**
 * 显示消息提示
 */
function showMessage(message, type = 'info') {
    const resultEl = document.getElementById('testResult');
    resultEl.classList.add('show');
    resultEl.classList.remove('matched', 'no-match');

    if (type === 'success') {
        resultEl.classList.add('matched');
    } else if (type === 'error' || type === 'warning') {
        resultEl.classList.add('no-match');
    }

    resultEl.innerHTML = '';
    const div = document.createElement('div');
    div.textContent = message;
    resultEl.appendChild(div);

    // 3秒后隐藏
    setTimeout(() => {
        resultEl.classList.remove('show');
    }, 3000);
}

/**
 * HTML 转义
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * 国际化 UI
 */
function localizeUI() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        const message = browser.i18n.getMessage(key);
        if (message) {
            el.textContent = message;
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.dataset.i18nPlaceholder;
        const message = browser.i18n.getMessage(key);
        if (message) {
            el.placeholder = message;
        }
    });
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);
