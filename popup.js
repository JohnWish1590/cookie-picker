// popup.js —— 多站 Cookie 管家 v1.2.0
// 主界面：每站独立「测试读取」+ 状态；复制 JSON；可选导出/直写目录。
// 设置页：NAS 仅填 IP + 测试连接；快捷写入本地目录（File System Access API，一选永逸）。

const $ = (id) => document.getElementById(id);

const DEFAULT_SITES = [
  { key: 'xueqiu', domain: 'xueqiu.com', label: '雪球', checked: true },
  { key: 'weibo', domain: 'weibo.com', label: '微博', checked: true },
];

let currentSites = [];
let collected = {};
let dirHandle = null; // 用户选中的本地目录句柄（In-Memory，持久化在 IndexedDB）

// ---------- 工具 ----------
function esc(s) {
  return (s || '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
}
function normalizeDomain(input) {
  input = (input || '').trim();
  if (!input) return '';
  if (input.startsWith('http://') || input.startsWith('https://')) {
    try { return new URL(input).hostname; } catch (e) { return ''; }
  }
  return input.split('/')[0].split(':')[0];
}
// 仅取 IP（去掉协议/路径），拼成完整端点
function nasEndpoints(ip) {
  const clean = (ip || '').trim().replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
  return {
    set: `http://${clean}:8899/api/set-cookies`,
    health: `http://${clean}:8899/api/health`,
  };
}

// ---------- IndexedDB 持久化目录句柄 ----------
function idb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('cookie-picker', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('handles');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function saveDirHandle(h) {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction('handles', 'readwrite');
    tx.objectStore('handles').put(h, 'dir');
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
}
async function loadDirHandle() {
  const db = await idb();
  return new Promise((res) => {
    const tx = db.transaction('handles', 'readonly');
    const rq = tx.objectStore('handles').get('dir');
    rq.onsuccess = () => res(rq.result || null);
    rq.onerror = () => res(null);
  });
}

// ---------- 配置 ----------
async function loadCfg() {
  const c = await chrome.storage.local.get(['nasIp', 'sites']);
  if (c.nasIp) $('nasIp').value = c.nasIp;
  dirHandle = await loadDirHandle();
  if (dirHandle) {
    try { $('dirPath').textContent = '已选目录：' + (dirHandle.name || '（未知）'); } catch (e) {}
  }
  return (c.sites && c.sites.length) ? c.sites : DEFAULT_SITES.slice();
}
async function saveCfg() {
  await chrome.storage.local.set({ nasIp: $('nasIp').value, sites: currentSites });
}

// ---------- 站点列表渲染 ----------
function renderSites() {
  const box = $('sites');
  box.innerHTML = '';
  if (!currentSites.length) {
    box.innerHTML = '<div class="hint" style="padding:10px">暂无站点，下面添加。默认已含雪球、微博。</div>';
    return;
  }
  currentSites.forEach((s, i) => {
    const el = document.createElement('div');
    el.className = 'site';
    el.innerHTML =
      `<input type="checkbox" data-i="${i}" ${s.checked ? 'checked' : ''} style="accent-color:#4A90D9;width:16px;height:16px"/>` +
      `<b>${esc(s.label)}</b>` +
      `<span class="test" data-i="${i}">测试读取</span>` +
      `<span class="status" id="st-${i}">· 未读</span>` +
      `<span class="del" data-i="${i}">✕</span>`;
    box.appendChild(el);
  });
  box.querySelectorAll('input[type=checkbox]').forEach((cb) => {
    cb.addEventListener('change', (e) => {
      currentSites[+e.target.dataset.i].checked = e.target.checked;
      saveCfg();
    });
  });
  box.querySelectorAll('.test').forEach((b) => {
    b.addEventListener('click', (e) => testRead(+e.target.dataset.i));
  });
  box.querySelectorAll('.del').forEach((d) => {
    d.addEventListener('click', (e) => {
      currentSites.splice(+e.target.dataset.i, 1);
      renderSites();
      saveCfg();
    });
  });
}

// ---------- 单站读取 ----------
async function testRead(i) {
  const s = currentSites[i];
  const dom = normalizeDomain(s.domain);
  const stEl = $(`st-${i}`);
  stEl.textContent = '读取中…'; stEl.className = 'status';
  try {
    const cs = await chrome.cookies.getAll({ domain: dom });
    if (!cs.length) { stEl.textContent = '✗ 无 Cookie'; stEl.className = 'status fail'; return; }
    // 去重：同名 cookie 保留 domain 更具体（带前导 .）的那条，用于拼 header
    const map = new Map();
    for (const c of cs) {
      const k = c.name;
      if (!map.has(k) || (c.domain || '').startsWith('.')) map.set(k, c);
    }
    const header = [...map.values()].map((c) => `${c.name}=${c.value}`).join('; ');
    collected[s.key] = { domain: dom, header, rawCount: cs.length };
    stEl.textContent = `✓ 读取成功`; stEl.className = 'status ok';
    refreshOutput();
    // 自动写入已选目录
    if (dirHandle) await writeToDir();
    // 自动导出（若已配置 NAS IP）
    if ($('nasIp').value.trim()) await pushToNas();
  } catch (e) {
    stEl.textContent = '✗ 失败'; stEl.className = 'status fail';
  }
}

function refreshOutput() {
  const keys = Object.keys(collected);
  if (!keys.length) { $('stat').textContent = '尚未读取。'; $('copy').style.display = 'none'; return; }
  const parts = keys.map((k) => k);
  $('stat').innerHTML = '已读取：<b style="color:#4A90D9">' + parts.join('  ') + '</b>';
  $('out').value = JSON.stringify({ cookies: collected, updatedAt: Date.now() }, null, 2);
  $('copy').style.display = 'inline-block';
  // 若配置了 NAS，显示导出按钮
  if ($('nasIp').value.trim()) $('exportNas').classList.remove('hidden');
}

// ---------- 复制到剪贴板 ----------
$('copy').addEventListener('click', async () => {
  const t = $('out').value;
  if (!t) { alert('还没有可复制的内容。'); return; }
  try {
    await navigator.clipboard.writeText(t);
    const btn = $('copy'); const old = btn.textContent;
    btn.textContent = '已复制 ✓'; btn.classList.add('copied');
    setTimeout(() => { btn.textContent = old; btn.classList.remove('copied'); }, 1500);
  } catch (e) {
    $('out').select(); document.execCommand('copy'); alert('已复制（兼容模式）');
  }
});

// ---------- 导出到 NAS ----------
async function pushToNas() {
  const nas = $('nasIp').value.trim();
  if (!nas || !Object.keys(collected).length) return;
  const url = nasEndpoints(nas).set;
  const payload = { cookies: collected, updatedAt: Date.now() };
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const t = await r.text();
    $('stat').innerHTML += ` · <span style="color:#2a8a4a">已推 NAS ${r.status}</span>`;
  } catch (e) {
    $('stat').innerHTML += ` · <span style="color:#c33">推 NAS 失败（可改用手动复制）</span>`;
  }
}
$('exportNas').addEventListener('click', pushToNas);

// ---------- 写入本地目录 ----------
async function writeToDir() {
  if (!dirHandle) return;
  try {
    const fileHandle = await dirHandle.getFileHandle('cookies-import.json', { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify({ cookies: collected, updatedAt: Date.now() }, null, 2));
    await writable.close();
  } catch (e) {
    console.warn('写入目录失败', e);
  }
}

// ---------- 添加站点 ----------
$('addSite').addEventListener('click', () => {
  const v = $('newSite').value.trim();
  if (!v) return;
  const dom = normalizeDomain(v);
  currentSites.push({ key: dom, domain: dom, label: dom, checked: true });
  $('newSite').value = '';
  renderSites();
  saveCfg();
});

// ---------- 设置面板切换 ----------
$('openSettings').addEventListener('click', () => {
  $('mainView').classList.add('hidden');
  $('settingsView').classList.remove('hidden');
});
$('backMain').addEventListener('click', () => {
  $('settingsView').classList.add('hidden');
  $('mainView').classList.remove('hidden');
  saveCfg();
  refreshOutput(); // 若 NAS IP 已填，显示导出按钮
});

// ---------- 测试 NAS 连接 ----------
$('testNas').addEventListener('click', async () => {
  const ip = $('nasIp').value.trim();
  if (!ip) { alert('请先填写 NAS IP'); return; }
  const st = $('nasStatus');
  st.textContent = '测试中…'; st.style.color = '#999';
  try {
    const r = await fetch(nasEndpoints(ip).health, { method: 'GET' });
    if (r.ok) { st.textContent = '✓ 连接成功'; st.style.color = '#2a8a4a'; }
    else { st.textContent = '✗ 连接失败 (' + r.status + ')'; st.style.color = '#c33'; }
  } catch (e) {
    st.textContent = '✗ 连接失败'; st.style.color = '#c33';
  }
  saveCfg();
});

// ---------- 选择目录 ----------
$('pickDir').addEventListener('click', async () => {
  try {
    const h = await window.showDirectoryPicker();
    dirHandle = h;
    await saveDirHandle(h);
    $('dirPath').textContent = '已选目录：' + (h.name || '（未知）');
  } catch (e) {
    if (e.name !== 'AbortError') alert('选择目录失败：' + e.message);
  }
});

// ---------- 清除数据 ----------
$('clearData').addEventListener('click', async () => {
  if (!confirm('确定清除所有站点、NAS 地址与目录配置？')) return;
  await chrome.storage.local.clear();
  try { const db = await idb(); db.transaction('handles', 'readwrite').objectStore('handles').delete('dir'); } catch (e) {}
  dirHandle = null;
  currentSites = DEFAULT_SITES.slice();
  $('nasIp').value = ''; $('dirPath').textContent = '';
  renderSites(); refreshOutput();
  alert('已清除。');
});

// ---------- 启动 ----------
(async () => {
  currentSites = await loadCfg();
  renderSites();
  refreshOutput();
})();
