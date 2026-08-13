// ============================================================
//  設定區
// ============================================================

const ADMIN_PASSWORD = '123456';

// ============================================================
//  資料層
// ============================================================

const DB_KEY = 'groupBuyData';

function getDefaultData() {
    return {
        activities: []
    };
}

function loadData() {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return getDefaultData();
    try {
        const data = JSON.parse(raw);
        if (!data.activities) data.activities = [];
        return data;
    } catch {
        return getDefaultData();
    }
}

function saveData(data) {
    localStorage.setItem(DB_KEY, JSON.stringify(data));
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// ============================================================
//  倒數計時工具
// ============================================================

function getRemainingText(deadline) {
    const now = Date.now();
    const target = new Date(deadline).getTime();
    const diff = target - now;

    if (diff <= 0) {
        return '⏰ 已截止';
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
        return `⏳ 剩 ${days} 天 ${hours} 時`;
    }
    if (hours > 0) {
        return `⏳ 剩 ${hours} 時 ${minutes} 分`;
    }
    if (minutes > 0) {
        return `⏳ 剩 ${minutes} 分`;
    }
    return '⏳ 即將截止';
}

function isExpired(deadline) {
    return Date.now() > new Date(deadline).getTime();
}

// ============================================================
//  金額計算工具
// ============================================================

function calcParticipantTotal(qty, price) {
    return (parseInt(qty) || 1) * parseFloat(price);
}

function calcTotalAmount(participants, price) {
    if (!participants || participants.length === 0) return 0;
    return participants.reduce((sum, p) => sum + calcParticipantTotal(p.qty, price), 0);
}

function formatMoney(amount) {
    return 'NT$ ' + amount.toFixed(2);
}

// ============================================================
//  畫面渲染
// ============================================================

const listView = document.getElementById('listView');
const detailView = document.getElementById('detailView');
const activityList = document.getElementById('activityList');
const detailContent = document.getElementById('detailContent');
const createModal = document.getElementById('createModal');
const closeModal = document.getElementById('closeModal');
const btnCreate = document.getElementById('btnCreate');
const createForm = document.getElementById('createForm');
const deleteModal = document.getElementById('deleteModal');
const closeDeleteModal = document.getElementById('closeDeleteModal');
const deleteForm = document.getElementById('deleteForm');
const deletePassword = document.getElementById('deletePassword');
const deleteError = document.getElementById('deleteError');
const cancelDelete = document.getElementById('cancelDelete');
const deleteActivityName = document.getElementById('deleteActivityName');

let timerInterval = null;
let _currentDetailId = null;
let _pendingDeleteId = null;

// ---------- 渲染列表 ----------
function renderList() {
    const data = loadData();
    if (data.activities.length === 0) {
        activityList.innerHTML = `
            <div style="text-align:center;color:#8a7a6a;padding:50px 0;font-size:17px;line-height:2;">
                🍃 還沒有接龍<br>
                <span style="font-size:14px;color:#b0a8a0;">點選右上角「發起接龍」開始吧！</span>
            </div>
        `;
        return;
    }

    const sorted = [...data.activities].reverse();
    let html = '';
    sorted.forEach(a => {
        const participantCount = a.participants ? a.participants.length : 0;
        const totalQty = a.participants ? a.participants.reduce((sum, p) => sum + (parseInt(p.qty) || 1), 0) : 0;
        const expired = isExpired(a.deadline);
        const remainingText = getRemainingText(a.deadline);
        const deadlineClass = expired ? 'deadline expired' : 'deadline';

        // 卡片邊框顏色依據是否截止變化
        const borderColor = expired ? '#ff6b6b' : '#ff7e5f';

        html += `
            <div class="activity-card" data-id="${a.id}" style="border-left-color:${borderColor};">
                <button class="delete-btn" data-id="${a.id}" title="刪除此接龍">✕</button>
                <div class="title">${escapeHtml(a.name)}</div>
                <div class="price">${formatMoney(a.price)}</div>
                <div class="meta">
                    <span>👤 ${participantCount}人</span>
                    <span>📦 ${totalQty}件</span>
                    <span>💰 ${formatMoney(calcTotalAmount(a.participants, a.price))}</span>
                </div>
                <div class="${deadlineClass}">${remainingText}</div>
            </div>
        `;
    });
    activityList.innerHTML = html;

    document.querySelectorAll('.activity-card').forEach(card => {
        card.addEventListener('click', function(e) {
            if (e.target.classList.contains('delete-btn')) return;
            const id = this.dataset.id;
            showDetail(id);
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const id = this.dataset.id;
            openDeleteModal(id);
        });
    });
}

// ---------- 顯示詳情 ----------
function showDetail(activityId) {
    _currentDetailId = activityId;
    const data = loadData();
    const activity = data.activities.find(a => a.id === activityId);
    if (!activity) {
        alert('該接龍不存在或已刪除');
        return;
    }

    listView.style.display = 'none';
    detailView.style.display = 'block';

    renderDetailContent(activity);
}

function renderDetailContent(activity) {
    const participants = activity.participants || [];
    const count = participants.length;
    const totalQty = participants.reduce((sum, p) => sum + (parseInt(p.qty) || 1), 0);
    const expired = isExpired(activity.deadline);
    const remainingText = getRemainingText(activity.deadline);
    const deadlineClass = expired ? 'detail-deadline expired' : 'detail-deadline';
    const price = parseFloat(activity.price);
    const totalAmount = calcTotalAmount(participants, price);

    const expiredBadge = expired ? '<span class="badge-expired">已截止</span>' : '';

    let participantHtml = '';
    if (participants.length === 0) {
        participantHtml = '<div style="color:#b0a8a0;text-align:center;padding:16px 0;font-size:15px;">還沒有任何人參與，快來搶購吧 🛍️</div>';
    } else {
        participantHtml = participants.map((p, index) => {
            const qty = parseInt(p.qty) || 1;
            const total = calcParticipantTotal(qty, price);
            return `
                <div class="item" key="${index}">
                    <div class="info">
                        <span class="name">${escapeHtml(p.name)}</span>
                        <span class="address">🏠 ${escapeHtml(p.address || '未填')}</span>
                    </div>
                    <div class="right">
                        <span class="qty">${qty}件</span>
                        <span class="total">${formatMoney(total)}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    const deadlineDisplay = activity.deadline ? new Date(activity.deadline).toLocaleString('zh-TW') : '未設定';

    const btnDisabled = expired ? 'disabled' : '';
    const btnText = expired ? '⏰ 已截止，無法參與' : '🔥 立即參與';
    const btnClass = expired ? 'btn-submit expired-btn' : 'btn-submit';

    detailContent.innerHTML = `
        <button class="back-btn" id="backToList">← 返回列表</button>
        <div class="detail-title">
            ${escapeHtml(activity.name)}
            ${expiredBadge}
        </div>
        <div class="detail-price">${formatMoney(price)}</div>
        <div class="${deadlineClass}">${remainingText}（截止：${deadlineDisplay}）</div>
        ${activity.desc ? `<div style="color:#8a7a6a;font-size:14px;margin:4px 0 10px;background:#faf8f7;padding:10px 14px;border-radius:10px;">${escapeHtml(activity.desc)}</div>` : ''}

        <div class="stats-row">
            <div class="stat-item">
                <div class="number">${count}</div>
                <div class="label">👤 參加人數</div>
            </div>
            <div class="stat-item">
                <div class="number">${totalQty}</div>
                <div class="label">📦 總件數</div>
            </div>
            <div class="stat-item">
                <div class="number">${formatMoney(totalAmount)}</div>
                <div class="label">💰 總金額</div>
            </div>
        </div>

        <div class="participant-form">
            <input type="text" id="inputName" placeholder="你的名字" required ${expired ? 'disabled' : ''}>
            <input type="text" id="inputAddress" placeholder="社區名稱 + 門牌號碼（如：幸福社區 5號3樓）" required ${expired ? 'disabled' : ''}>
            <input type="number" id="inputQty" placeholder="購買數量" value="1" min="1" ${expired ? 'disabled' : ''}>
            <button class="${btnClass}" id="btnJoin" ${btnDisabled}>
                ${btnText}
            </button>
        </div>

        <div class="participant-list">
            <div class="list-header">
                <span>📋 已參與</span>
                <span>金額</span>
            </div>
            ${participantHtml}
            ${participants.length > 0 ? `
                <div class="summary-row">
                    <span>📊 總計</span>
                    <span class="total-amount">${formatMoney(totalAmount)}</span>
                </div>
            ` : ''}
        </div>
    `;

    document.getElementById('backToList').addEventListener('click', function() {
        detailView.style.display = 'none';
        listView.style.display = 'block';
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        renderList();
    });

    const joinBtn = document.getElementById('btnJoin');
    if (!expired && joinBtn) {
        joinBtn.addEventListener('click', function() {
            handleJoin(activity.id);
        });
    }
}

// ---------- 處理參與 ----------
function handleJoin(activityId) {
    const nameInput = document.getElementById('inputName');
    const addressInput = document.getElementById('inputAddress');
    const qtyInput = document.getElementById('inputQty');

    const name = nameInput.value.trim();
    const address = addressInput.value.trim();
    let qty = parseInt(qtyInput.value) || 1;
    if (qty < 1) qty = 1;

    if (!name) {
        alert('請輸入你的名字');
        nameInput.focus();
        return;
    }
    if (!address) {
        alert('請輸入社區名稱和門牌號碼');
        addressInput.focus();
        return;
    }

    const currentData = loadData();
    const currentActivity = currentData.activities.find(a => a.id === activityId);
    if (!currentActivity) {
        alert('接龍已不存在');
        return;
    }
    if (isExpired(currentActivity.deadline)) {
        alert('⏰ 此接龍已截止，無法再參與');
        renderDetailContent(currentActivity);
        renderList();
        return;
    }

    if (!currentActivity.participants) currentActivity.participants = [];
    currentActivity.participants.push({
        name: name,
        address: address,
        qty: qty,
        joinedAt: new Date().toISOString()
    });

    saveData(currentData);
    renderDetailContent(currentActivity);
    renderList();
}

// ---------- 刪除接龍 ----------
function openDeleteModal(activityId) {
    const data = loadData();
    const activity = data.activities.find(a => a.id === activityId);
    if (!activity) {
        alert('該接龍已不存在');
        return;
    }

    _pendingDeleteId = activityId;
    deleteActivityName.textContent = activity.name;
    deletePassword.value = '';
    deleteError.style.display = 'none';
    deleteModal.style.display = 'flex';
    setTimeout(() => deletePassword.focus(), 100);
}

function closeDeleteModalFn() {
    deleteModal.style.display = 'none';
    _pendingDeleteId = null;
    deletePassword.value = '';
    deleteError.style.display = 'none';
}

closeDeleteModal.addEventListener('click', closeDeleteModalFn);
cancelDelete.addEventListener('click', closeDeleteModalFn);
deleteModal.addEventListener('click', function(e) {
    if (e.target === deleteModal) {
        closeDeleteModalFn();
    }
});

deleteForm.addEventListener('submit', function(e) {
    e.preventDefault();

    const password = deletePassword.value.trim();

    if (password !== ADMIN_PASSWORD) {
        deleteError.style.display = 'block';
        deletePassword.value = '';
        deletePassword.focus();
        return;
    }

    deleteError.style.display = 'none';

    if (!_pendingDeleteId) {
        alert('發生錯誤，請重新操作');
        closeDeleteModalFn();
        return;
    }

    const data = loadData();
    const index = data.activities.findIndex(a => a.id === _pendingDeleteId);
    if (index === -1) {
        alert('該接龍已不存在');
        closeDeleteModalFn();
        return;
    }

    const deletedName = data.activities[index].name;
    data.activities.splice(index, 1);
    saveData(data);

    closeDeleteModalFn();

    if (_currentDetailId === _pendingDeleteId) {
        detailView.style.display = 'none';
        listView.style.display = 'block';
        _currentDetailId = null;
    }

    renderList();
    alert(`✅ 已刪除「${deletedName}」`);
});

deletePassword.addEventListener('input', function() {
    deleteError.style.display = 'none';
});

// ---------- 輔助 ----------
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================
//  倒數計時定時器
// ============================================================

function startTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    timerInterval = setInterval(function() {
        if (detailView.style.display !== 'none' && _currentDetailId) {
            const data = loadData();
            const activity = data.activities.find(a => a.id === _currentDetailId);
            if (activity) {
                renderDetailContent(activity);
            }
        }
        renderList();
    }, 10000);
}

// ============================================================
//  建立接龍
// ============================================================

btnCreate.addEventListener('click', function() {
    createModal.style.display = 'flex';
    document.getElementById('activityName').focus();
    const defaultDeadline = new Date();
    defaultDeadline.setDate(defaultDeadline.getDate() + 3);
    const formatted = defaultDeadline.toISOString().slice(0, 16);
    document.getElementById('activityDeadline').value = formatted;
    document.getElementById('adminPassword').value = '';
    const errorEl = document.querySelector('.password-error');
    if (errorEl) errorEl.style.display = 'none';
});

closeModal.addEventListener('click', function() {
    createModal.style.display = 'none';
});

createModal.addEventListener('click', function(e) {
    if (e.target === createModal) {
        createModal.style.display = 'none';
    }
});

function ensureErrorElement() {
    let errorEl = document.querySelector('.password-error');
    if (!errorEl) {
        const form = document.getElementById('createForm');
        const passwordInput = document.getElementById('adminPassword');
        errorEl = document.createElement('div');
        errorEl.className = 'password-error';
        errorEl.textContent = '❌ 密碼錯誤，請重新輸入';
        passwordInput.parentNode.insertBefore(errorEl, passwordInput.nextSibling);
    }
    return errorEl;
}

createForm.addEventListener('submit', function(e) {
    e.preventDefault();

    const password = document.getElementById('adminPassword').value.trim();
    const errorEl = ensureErrorElement();

    if (password !== ADMIN_PASSWORD) {
        errorEl.style.display = 'block';
        document.getElementById('adminPassword').focus();
        document.getElementById('adminPassword').select();
        return;
    }
    errorEl.style.display = 'none';

    const name = document.getElementById('activityName').value.trim();
    const price = parseFloat(document.getElementById('activityPrice').value);
    const deadline = document.getElementById('activityDeadline').value;
    const desc = document.getElementById('activityDesc').value.trim();

    if (!name) { alert('請輸入商品名稱'); return; }
    if (isNaN(price) || price <= 0) { alert('請輸入有效價格'); return; }
    if (!deadline) { alert('請設定截止時間'); return; }
    if (new Date(deadline).getTime() <= Date.now()) {
        alert('截止時間必須在未來');
        return;
    }

    const data = loadData();
    const newActivity = {
        id: generateId(),
        name: name,
        price: price,
        deadline: deadline,
        desc: desc,
        createdAt: new Date().toISOString(),
        participants: []
    };

    data.activities.push(newActivity);
    saveData(data);

    createModal.style.display = 'none';
    createForm.reset();
    renderList();

    alert('✅ 接龍已發佈！');
});

document.addEventListener('DOMContentLoaded', function() {
    const passwordInput = document.getElementById('adminPassword');
    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            const errorEl = document.querySelector('.password-error');
            if (errorEl) errorEl.style.display = 'none';
        });
    }
});

// ============================================================
//  啟動
// ============================================================

renderList();
startTimer();