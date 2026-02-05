/**
 * SmartProxy Options 页面脚本
 */

// 当前状态
let state = {
    proxies: [],
    rules: [],
    settings: {}
};

/**
 * 初始化
 */
async function init() {
    // 先加载主题（避免闪烁）
    loadTheme();
    await loadData();
    bindEvents();
    renderAll();
    localizeUI();
}

/**
 * 加载主题
 */
function loadTheme() {
    const savedTheme = localStorage.getItem('smartproxy-theme') || 'dark';
    setTheme(savedTheme);
}

/**
 * 设置主题
 */
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('smartproxy-theme', theme);
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
        themeSelect.value = theme;
    }
}

/**
 * 加载数据
 */
async function loadData() {
    try {
        const response = await browser.runtime.sendMessage({ type: 'getStatus' });
        state.proxies = response.proxies || [];
        state.rules = response.rules || [];
        state.settings = response.settings || {};
    } catch (error) {
        console.error('加载数据失败:', error);
        showToast('加载数据失败', 'error');
    }
}

/**
 * 绑定事件
 */
function bindEvents() {
    // 标签切换
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab(item.dataset.tab);
        });
    });

    // 代理相关
    document.getElementById('addProxyBtn').addEventListener('click', () => openProxyModal());
    document.getElementById('addProxyEmptyBtn').addEventListener('click', () => openProxyModal());
    document.getElementById('closeProxyModal').addEventListener('click', closeProxyModal);
    document.getElementById('cancelProxyBtn').addEventListener('click', closeProxyModal);
    document.getElementById('saveProxyBtn').addEventListener('click', saveProxy);

    // 规则相关
    document.getElementById('addRuleBtn').addEventListener('click', () => openRuleModal());
    document.getElementById('addRuleEmptyBtn').addEventListener('click', () => openRuleModal());
    document.getElementById('closeRuleModal').addEventListener('click', closeRuleModal);
    document.getElementById('cancelRuleBtn').addEventListener('click', closeRuleModal);
    document.getElementById('saveRuleBtn').addEventListener('click', saveRule);
    document.getElementById('enableAllRulesBtn').addEventListener('click', () => toggleAllRules(true));
    document.getElementById('disableAllRulesBtn').addEventListener('click', () => toggleAllRules(false));

    // 设置相关
    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
    document.getElementById('themeSelect').addEventListener('change', (e) => setTheme(e.target.value));

    // 导入导出
    document.getElementById('exportBtn').addEventListener('click', exportConfig);
    document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
    document.getElementById('importFile').addEventListener('change', handleImport);
    document.getElementById('resetBtn').addEventListener('click', resetConfig);

    // 点击弹窗外部关闭
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    });
}

/**
 * 切换标签页
 */
function switchTab(tabId) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === tabId);
    });
}

/**
 * 渲染所有内容
 */
function renderAll() {
    renderProxyTable();
    renderRuleTable();
    renderSettings();
}

// ==================== 代理管理 ====================

/**
 * 渲染代理表格
 */
function renderProxyTable() {
    const container = document.querySelector('.proxy-table-container');
    const tbody = document.getElementById('proxyTableBody');

    if (state.proxies.length === 0) {
        container.classList.add('empty');
        return;
    }

    container.classList.remove('empty');
    tbody.innerHTML = state.proxies.map(proxy => `
    <tr data-id="${proxy.id}">
      <td><div class="proxy-color-cell" style="background-color: ${proxy.color}"></div></td>
      <td>${escapeHtml(proxy.name)}</td>
      <td><span class="proxy-type-badge">${proxy.type.toUpperCase()}</span></td>
      <td>${escapeHtml(proxy.host)}</td>
      <td>${proxy.port}</td>
      <td>
        <label class="status-toggle">
          <input type="checkbox" ${proxy.enabled ? 'checked' : ''} data-action="toggle-proxy" data-id="${proxy.id}">
          <span class="slider"></span>
        </label>
      </td>
      <td>
        <div class="action-buttons">
          <button class="btn btn-icon" data-action="edit-proxy" data-id="${proxy.id}" title="编辑">✏️</button>
          <button class="btn btn-icon" data-action="delete-proxy" data-id="${proxy.id}" title="删除">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');

    // 绑定代理表格事件
    bindProxyTableEvents();
}

/**
 * 绑定代理表格事件
 */
function bindProxyTableEvents() {
    const tbody = document.getElementById('proxyTableBody');

    tbody.querySelectorAll('[data-action="toggle-proxy"]').forEach(el => {
        el.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            toggleProxyEnabled(id, e.target.checked);
        });
    });

    tbody.querySelectorAll('[data-action="edit-proxy"]').forEach(el => {
        el.addEventListener('click', (e) => {
            const id = e.target.closest('[data-id]').dataset.id;
            editProxy(id);
        });
    });

    tbody.querySelectorAll('[data-action="delete-proxy"]').forEach(el => {
        el.addEventListener('click', (e) => {
            const id = e.target.closest('[data-id]').dataset.id;
            deleteProxy(id);
        });
    });
}

/**
 * 打开代理编辑弹窗
 */
function openProxyModal(proxyId = null) {
    const modal = document.getElementById('proxyModal');
    const title = document.getElementById('proxyModalTitle');
    const form = document.getElementById('proxyForm');

    form.reset();
    document.getElementById('proxyId').value = '';
    document.getElementById('proxyColor').value = '#3b82f6';

    if (proxyId) {
        const proxy = state.proxies.find(p => p.id === proxyId);
        if (proxy) {
            title.textContent = '编辑代理';
            document.getElementById('proxyId').value = proxy.id;
            document.getElementById('proxyName').value = proxy.name;
            document.getElementById('proxyType').value = proxy.type;
            document.getElementById('proxyHost').value = proxy.host;
            document.getElementById('proxyPort').value = proxy.port;
            document.getElementById('proxyColor').value = proxy.color;
            document.getElementById('proxyUsername').value = proxy.username || '';
        }
    } else {
        title.textContent = '添加代理';
    }

    modal.classList.add('show');
}

function closeProxyModal() {
    document.getElementById('proxyModal').classList.remove('show');
}

/**
 * 保存代理
 */
async function saveProxy() {
    const id = document.getElementById('proxyId').value;
    const proxyData = {
        name: document.getElementById('proxyName').value.trim(),
        type: document.getElementById('proxyType').value,
        host: document.getElementById('proxyHost').value.trim(),
        port: parseInt(document.getElementById('proxyPort').value),
        color: document.getElementById('proxyColor').value,
        username: document.getElementById('proxyUsername').value.trim(),
        password: document.getElementById('proxyPassword').value
    };

    if (!proxyData.name || !proxyData.host || !proxyData.port) {
        showToast('请填写必填字段', 'warning');
        return;
    }

    try {
        if (id) {
            await browser.runtime.sendMessage({ type: 'updateProxy', id, updates: proxyData });
            showToast('代理已更新', 'success');
        } else {
            await browser.runtime.sendMessage({ type: 'addProxy', proxy: proxyData });
            showToast('代理已添加', 'success');
        }

        closeProxyModal();
        await loadData();
        renderProxyTable();
        updateRuleProxySelect();
    } catch (error) {
        console.error('保存代理失败:', error);
        showToast('保存失败', 'error');
    }
}

function editProxy(id) {
    openProxyModal(id);
}

async function deleteProxy(id) {
    const proxy = state.proxies.find(p => p.id === id);
    if (!confirm(`确定要删除代理 "${proxy?.name}" 吗？`)) return;

    try {
        await browser.runtime.sendMessage({ type: 'deleteProxy', id });
        showToast('代理已删除', 'success');
        await loadData();
        renderProxyTable();
        updateRuleProxySelect();
    } catch (error) {
        console.error('删除代理失败:', error);
        showToast('删除失败', 'error');
    }
}

async function toggleProxyEnabled(id, enabled) {
    try {
        await browser.runtime.sendMessage({ type: 'updateProxy', id, updates: { enabled } });
    } catch (error) {
        console.error('更新状态失败:', error);
        showToast('更新失败', 'error');
    }
}

// ==================== 规则管理 ====================

/**
 * 渲染规则表格
 */
function renderRuleTable() {
    const container = document.querySelector('.rule-table-container');
    const tbody = document.getElementById('ruleTableBody');

    if (state.rules.length === 0) {
        container.classList.add('empty');
        return;
    }

    container.classList.remove('empty');
    tbody.innerHTML = state.rules.map(rule => {
        const proxy = rule.proxyId === 'direct'
            ? { name: '直接连接', color: '#666' }
            : state.proxies.find(p => p.id === rule.proxyId) || { name: '未知', color: '#666' };

        return `
      <tr data-id="${rule.id}" draggable="true">
        <td><span class="drag-handle">⋮⋮</span></td>
        <td title="${escapeHtml(rule.pattern)}">${escapeHtml(truncate(rule.pattern, 40))}</td>
        <td><span class="rule-type-badge">${getRuleTypeName(rule.type)}</span></td>
        <td>
          <span style="display: inline-flex; align-items: center; gap: 6px;">
            <span style="width: 10px; height: 10px; border-radius: 50%; background: ${proxy.color}"></span>
            ${escapeHtml(proxy.name)}
          </span>
        </td>
        <td>
          <label class="status-toggle">
            <input type="checkbox" ${rule.enabled ? 'checked' : ''} data-action="toggle-rule" data-id="${rule.id}">
            <span class="slider"></span>
          </label>
        </td>
        <td>
          <div class="action-buttons">
            <button class="btn btn-icon" data-action="edit-rule" data-id="${rule.id}" title="编辑">✏️</button>
            <button class="btn btn-icon" data-action="delete-rule" data-id="${rule.id}" title="删除">🗑️</button>
          </div>
        </td>
      </tr>
    `;
    }).join('');

    // 绑定规则表格事件
    bindRuleTableEvents();
    // 绑定拖拽事件
    setupDragAndDrop();
}

/**
 * 绑定规则表格事件
 */
function bindRuleTableEvents() {
    const tbody = document.getElementById('ruleTableBody');

    tbody.querySelectorAll('[data-action="toggle-rule"]').forEach(el => {
        el.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            toggleRuleEnabled(id, e.target.checked);
        });
    });

    tbody.querySelectorAll('[data-action="edit-rule"]').forEach(el => {
        el.addEventListener('click', (e) => {
            const id = e.target.closest('[data-id]').dataset.id;
            editRule(id);
        });
    });

    tbody.querySelectorAll('[data-action="delete-rule"]').forEach(el => {
        el.addEventListener('click', (e) => {
            const id = e.target.closest('[data-id]').dataset.id;
            deleteRule(id);
        });
    });
}

/**
 * 设置拖拽排序
 */
function setupDragAndDrop() {
    const tbody = document.getElementById('ruleTableBody');
    let draggedRow = null;

    tbody.querySelectorAll('tr').forEach(row => {
        row.addEventListener('dragstart', (e) => {
            draggedRow = row;
            row.style.opacity = '0.5';
        });

        row.addEventListener('dragend', () => {
            draggedRow.style.opacity = '1';
            draggedRow = null;
        });

        row.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        row.addEventListener('drop', async (e) => {
            e.preventDefault();
            if (draggedRow && draggedRow !== row) {
                const rows = Array.from(tbody.querySelectorAll('tr'));
                const draggedIndex = rows.indexOf(draggedRow);
                const dropIndex = rows.indexOf(row);

                if (draggedIndex < dropIndex) {
                    row.parentNode.insertBefore(draggedRow, row.nextSibling);
                } else {
                    row.parentNode.insertBefore(draggedRow, row);
                }

                // 保存新顺序
                const newOrder = Array.from(tbody.querySelectorAll('tr')).map(r => r.dataset.id);
                await browser.runtime.sendMessage({ type: 'reorderRules', ruleIds: newOrder });
                await loadData();
            }
        });
    });
}

/**
 * 更新规则弹窗中的代理选择器
 */
function updateRuleProxySelect() {
    const select = document.getElementById('ruleProxy');
    select.innerHTML = '<option value="direct">直接连接</option>' +
        state.proxies.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
}

/**
 * 打开规则编辑弹窗
 */
function openRuleModal(ruleId = null) {
    const modal = document.getElementById('ruleModal');
    const title = document.getElementById('ruleModalTitle');
    const form = document.getElementById('ruleForm');

    form.reset();
    document.getElementById('ruleId').value = '';
    updateRuleProxySelect();

    if (ruleId) {
        const rule = state.rules.find(r => r.id === ruleId);
        if (rule) {
            title.textContent = '编辑规则';
            document.getElementById('ruleId').value = rule.id;
            document.getElementById('rulePattern').value = rule.pattern;
            document.getElementById('ruleType').value = rule.type;
            document.getElementById('ruleProxy').value = rule.proxyId;
            document.getElementById('ruleNote').value = rule.note || '';
        }
    } else {
        title.textContent = '添加规则';
    }

    modal.classList.add('show');
}

function closeRuleModal() {
    document.getElementById('ruleModal').classList.remove('show');
}

/**
 * 保存规则
 */
async function saveRule() {
    const id = document.getElementById('ruleId').value;
    const ruleData = {
        pattern: document.getElementById('rulePattern').value.trim(),
        type: document.getElementById('ruleType').value,
        proxyId: document.getElementById('ruleProxy').value,
        note: document.getElementById('ruleNote').value.trim()
    };

    if (!ruleData.pattern) {
        showToast('请填写匹配模式', 'warning');
        return;
    }

    try {
        if (id) {
            await browser.runtime.sendMessage({ type: 'updateRule', id, updates: ruleData });
            showToast('规则已更新', 'success');
        } else {
            await browser.runtime.sendMessage({ type: 'addRule', rule: ruleData });
            showToast('规则已添加', 'success');
        }

        closeRuleModal();
        await loadData();
        renderRuleTable();
    } catch (error) {
        console.error('保存规则失败:', error);
        showToast('保存失败', 'error');
    }
}

function editRule(id) {
    openRuleModal(id);
}

async function deleteRule(id) {
    if (!confirm('确定要删除这条规则吗？')) return;

    try {
        await browser.runtime.sendMessage({ type: 'deleteRule', id });
        showToast('规则已删除', 'success');
        await loadData();
        renderRuleTable();
    } catch (error) {
        console.error('删除规则失败:', error);
        showToast('删除失败', 'error');
    }
}

async function toggleRuleEnabled(id, enabled) {
    try {
        await browser.runtime.sendMessage({ type: 'updateRule', id, updates: { enabled } });
    } catch (error) {
        console.error('更新状态失败:', error);
        showToast('更新失败', 'error');
    }
}

/**
 * 批量启用/禁用规则
 */
async function toggleAllRules(enabled) {
    try {
        const ruleIds = state.rules.map(r => r.id);
        for (const id of ruleIds) {
            await browser.runtime.sendMessage({ type: 'updateRule', id, updates: { enabled } });
        }
        showToast(enabled ? '已全部启用' : '已全部禁用', 'success');
        await loadData();
        renderRuleTable();
    } catch (error) {
        console.error('批量更新失败:', error);
        showToast('操作失败', 'error');
    }
}

// ==================== 设置管理 ====================

/**
 * 渲染设置
 */
function renderSettings() {
    const settings = state.settings;

    // 更新默认动作选择器
    const defaultActionSelect = document.getElementById('defaultAction');
    defaultActionSelect.innerHTML = '<option value="direct">直接连接</option>' +
        state.proxies.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
    defaultActionSelect.value = settings.defaultAction || 'direct';

    document.getElementById('pacScriptUrl').value = settings.pacScriptUrl || '';
    document.getElementById('enableNotifications').checked = settings.enableNotifications !== false;
    document.getElementById('enableContextMenu').checked = settings.enableContextMenu !== false;
}

/**
 * 保存设置
 */
async function saveSettings() {
    const settings = {
        defaultAction: document.getElementById('defaultAction').value,
        pacScriptUrl: document.getElementById('pacScriptUrl').value.trim(),
        enableNotifications: document.getElementById('enableNotifications').checked,
        enableContextMenu: document.getElementById('enableContextMenu').checked
    };

    try {
        await browser.runtime.sendMessage({ type: 'updateSettings', settings });
        showToast('设置已保存', 'success');
        state.settings = { ...state.settings, ...settings };
    } catch (error) {
        console.error('保存设置失败:', error);
        showToast('保存失败', 'error');
    }
}

// ==================== 导入导出 ====================

/**
 * 导出配置
 */
async function exportConfig() {
    try {
        const configJson = await browser.runtime.sendMessage({ type: 'exportConfig' });
        const blob = new Blob([configJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `smartproxy-config-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('配置已导出', 'success');
    } catch (error) {
        console.error('导出失败:', error);
        showToast('导出失败', 'error');
    }
}

/**
 * 处理导入
 */
async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const importMode = document.querySelector('input[name="importMode"]:checked').value;

    try {
        const text = await file.text();
        const result = await browser.runtime.sendMessage({
            type: 'importConfig',
            config: text,
            options: { merge: importMode === 'merge' }
        });

        if (result.success) {
            showToast(`导入成功: ${result.proxies} 个代理, ${result.rules} 条规则`, 'success');
            await loadData();
            renderAll();
        } else {
            showToast('导入失败: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('导入失败:', error);
        showToast('导入失败', 'error');
    }

    e.target.value = '';
}

/**
 * 重置配置
 */
async function resetConfig() {
    if (!confirm('确定要重置所有配置吗？此操作不可撤销。')) return;

    try {
        await browser.runtime.sendMessage({ type: 'reset' });
        showToast('配置已重置', 'success');
        await loadData();
        renderAll();
    } catch (error) {
        console.error('重置失败:', error);
        showToast('重置失败', 'error');
    }
}

// ==================== 工具函数 ====================

/**
 * 显示 Toast 通知
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
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
 * 截断字符串
 */
function truncate(str, maxLen) {
    if (!str || str.length <= maxLen) return str;
    return str.slice(0, maxLen) + '...';
}

/**
 * 获取规则类型名称
 */
function getRuleTypeName(type) {
    const names = {
        'wildcard': '通配符',
        'regexp': '正则',
        'domain': '域名',
        'ip': 'IP'
    };
    return names[type] || type;
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
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);
