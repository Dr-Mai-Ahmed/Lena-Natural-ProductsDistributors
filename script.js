/* ============================================================
   Lēna Natural — السلة، الوضع الداكن، البحث، عرض المنتجات
   الترتيب في الصفحات: products-data.js ثم script.js
   ============================================================ */

const hasCatalog = typeof PRODUCTS !== 'undefined';
const WHATSAPP_NUMBER = typeof STORE !== 'undefined' ? STORE.whatsapp : '201102523873';
const SHIPPING = typeof STORE !== 'undefined' ? STORE.shipping : 80;

// ---------- أدوات عامة ----------
function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// توحيد الحروف العربية للبحث (ة/ه، أ/إ/آ/ا، ى/ي) وإزالة التشكيل
function normalizeAr(text) {
    return String(text).toLowerCase()
        .replace(/[\u064B-\u065F\u0640]/g, '')
        .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
}

const findProduct = id => hasCatalog ? PRODUCTS.find(p => String(p.id) === String(id)) : null;
const productLabel = p => p.short ? `${p.name} (${p.short})` : p.name;

function whatsappLink(p, qty = 1) {
    const msg = `أنا موزع وعايز اطلب: ${productLabel(p)} - سعر التوزيع ${p.price} ج.م` + (qty > 1 ? ` (الكمية: ${qty})` : '');
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
}

// ---------- السلة ----------
// بنحدّث الاسم والسعر والصورة من الكتالوج عند التحميل، فلا يمكن التلاعب بالأسعار من المتصفح
function loadCart() {
    try {
        const saved = JSON.parse(localStorage.getItem('lena_cart'));
        if (!Array.isArray(saved)) return [];
        return saved.map(item => {
            const p = findProduct(item.id);
            const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
            return p ? { id: p.id, name: productLabel(p), price: p.price, image: p.image, quantity } : null;
        }).filter(Boolean);
    } catch (e) {
        return [];
    }
}
let cart = loadCart();

function saveCart() {
    try { localStorage.setItem('lena_cart', JSON.stringify(cart)); } catch (e) { /* التخزين غير متاح */ }
    updateCartCount();
}

function updateCartCount() {
    const total = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.querySelectorAll('#cartCount').forEach(el => { el.textContent = total; });
}

const cartSubtotal = () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

function addToCart(id, qty = 1) {
    const p = findProduct(id);
    if (!p) return;
    const existing = cart.find(item => item.id === p.id);
    if (existing) existing.quantity += qty;
    else cart.push({ id: p.id, name: productLabel(p), price: p.price, image: p.image, quantity: qty });
    saveCart();
    showToast(`تم إضافة "${productLabel(p)}" إلى السلة ✨`);
}

function changeCartQty(id, delta) {
    const item = cart.find(i => String(i.id) === String(id));
    if (!item) return;
    item.quantity = Math.max(1, item.quantity + delta);
    saveCart();
}

function removeFromCart(id) {
    cart = cart.filter(i => String(i.id) !== String(id));
    saveCart();
}

let toastTimer;
function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ---------- الوضع الداكن ----------
function initTheme() {
    let isDark = false;
    try { isDark = localStorage.getItem('lena_theme') === 'dark'; } catch (e) {}
    const toggle = document.getElementById('darkModeToggle');
    const apply = dark => {
        document.body.classList.toggle('dark-mode', dark);
        const icon = toggle && toggle.querySelector('i');
        if (icon) icon.className = dark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    };
    apply(isDark);
    if (toggle) toggle.addEventListener('click', () => {
        isDark = !isDark;
        apply(isDark);
        try { localStorage.setItem('lena_theme', isDark ? 'dark' : 'light'); } catch (e) {}
    });
}

// ---------- كارت المنتج ----------
function createProductCard(p) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.dataset.id = p.id;
    card.dataset.category = p.category;
    const link = `product.html?id=${p.id}`;
    card.innerHTML = `
        <a href="${link}" class="product-img">
            <img src="${escapeHtml(p.image)}" alt="${escapeHtml(productLabel(p))}" loading="lazy">
        </a>
        <div class="product-info">
            <h3>${escapeHtml(p.name)}</h3>
            ${p.short ? `<p class="product-size">${escapeHtml(p.short)}</p>` : ''}
            <span class="price-tag">سعر التوزيع</span>
            <span class="price">${p.price} ج.م</span>
            <a href="${link}" class="btn-details">التفاصيل</a>
            <div class="card-actions">
                <button type="button" class="btn-add" data-add="${p.id}">إضافة للسلة</button>
                <a href="${whatsappLink(p)}" target="_blank" rel="noopener" class="btn-whatsapp">
                    <i class="fa-brands fa-whatsapp"></i> واتساب
                </a>
            </div>
        </div>`;
    card.querySelector('[data-add]').addEventListener('click', () => addToCart(p.id));
    return card;
}

function searchTextOf(p) {
    const d = p.details || {};
    const parts = [p.name, p.short, CATEGORIES[p.category] && CATEGORIES[p.category].label,
        ...(d.intro || []), ...(d.features || []), ...(d.ingredients || [])];
    return normalizeAr(parts.filter(Boolean).join(' '));
}

// ---------- الصفحة الرئيسية: الكروت مكتوبة في index.html، والكود هنا للفلترة والبحث والإضافة للسلة ----------
function initStorePage() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    if (hasCatalog) PRODUCTS.forEach(p => grid.appendChild(createProductCard(p)));
    const state = { category: 'all', query: '' };
    const boxes = document.getElementById('categoryBoxes');
    const noResults = document.getElementById('noResults');
    const cards = [...grid.querySelectorAll('.product-card')].map(el => ({
        el, category: el.dataset.category, text: normalizeAr(el.textContent)
    }));

    function applyFilters() {
        const q = normalizeAr(state.query.trim());
        let shown = 0;
        cards.forEach(({ el, category, text }) => {
            const visible = (state.category === 'all' || category === state.category) && (!q || text.includes(q));
            el.classList.toggle('is-hidden', !visible);
            if (visible) shown++;
        });
        noResults.hidden = shown > 0;
    }

    boxes.addEventListener('click', e => {
        const box = e.target.closest('.big-cat-box');
        if (!box) return;
        boxes.querySelectorAll('.big-cat-box').forEach(b => b.classList.remove('active'));
        box.classList.add('active');
        state.category = box.dataset.category;
        applyFilters();
    });

    const searchBtn = document.getElementById('searchIconBtn');
    const searchInput = document.getElementById('searchInput');
    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', e => {
            e.stopPropagation();
            const open = searchInput.style.display === 'block';
            searchInput.style.display = open ? 'none' : 'block';
            if (!open) searchInput.focus();
        });
        document.addEventListener('click', e => {
            if (!searchInput.contains(e.target) && !searchBtn.contains(e.target)) searchInput.style.display = 'none';
        });
        searchInput.addEventListener('input', () => { state.query = searchInput.value; applyFilters(); });
    }
}

// ---------- رسالة الدخول: الموقع خاص بالموزعين (مرة في كل جلسة) ----------
function showDistributorGate() {
    try { if (sessionStorage.getItem('lena_gate_ok') === '1') return; } catch (e) {}
    const overlay = document.createElement('div');
    overlay.className = 'gate-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
        <div class="gate-box">
            <div class="gate-icon"><i class="fa-solid fa-handshake"></i></div>
            <h2>موقع خاص بالموزعين فقط</h2>
            <p>أهلاً بيك في موقع موزعي <strong>Lēna Natural</strong>.<br>
            الأسعار المعروضة هنا هي <strong>أسعار التوزيع</strong> وخاصة بأعضاء جروب الموزعين فقط.</p>
            <button type="button" class="gate-btn">أنا موزع — دخول الموقع</button>
        </div>`;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    const btn = overlay.querySelector('.gate-btn');
    btn.focus();
    btn.addEventListener('click', () => {
        overlay.remove();
        document.body.style.overflow = '';
        try { sessionStorage.setItem('lena_gate_ok', '1'); } catch (e) {}
    });
}

document.addEventListener('DOMContentLoaded', () => {
    showDistributorGate();
    initTheme();
    updateCartCount();
    initStorePage();
});
