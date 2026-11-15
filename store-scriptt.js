/* --------------------------------------------------------------
   DM GAMES SHOP – SANITY CMS POWERED STORE
-------------------------------------------------------------- */
const SANITY_PROJECT_ID = 'ubi4x431';
const SANITY_DATASET = 'production';
const SANITY_API = `https://${SANITY_PROJECT_ID}.api.sanity.io/v2024-01-01/data/query/${SANITY_DATASET}`;

async function sanityFetch(query) {
  const url = `${SANITY_API}?query=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  const json = await res.json();
  return json.result || [];
}

let cart = JSON.parse(localStorage.getItem("cart")) || [];
let allGames = [];
let allBundles = [];
let activeTimers = {};
let currentCategory = 'all';

/* ---------- UTILITY ---------- */
function truncateText(text, maxLength) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength).trim() + '...' : text;
}

/* ---------- 1. LOAD ALL DATA FROM SANITY ---------- */
Promise.all([
  sanityFetch(`*[_type == "product" && status == "active"]{
    name, "image": imageUrl, description, price, "on offer": onOffer,
    "offer ends": offerEnds, category, status, "slug": slug.current
  }`),
  sanityFetch(`*[_type == "delivery" && active == true]{ text }`),
  sanityFetch(`*[_type == "howToPlay"]{ name, image, rules }`)
])
.then(([gamesData, deliveryData, howToPlayData]) => {
  allGames = gamesData.filter(g => g.name && g.name.trim());
  allBundles = [];

  /* ---- DELIVERY / HERO MESSAGES ---- */
  const incentiveElement = document.querySelector('.delivery-incentive');
  if (incentiveElement) {
    if (deliveryData.length > 0) {
      incentiveElement.innerHTML = '<strong>' + deliveryData.map(d => d.text).join('<br>') + '</strong>';
      incentiveElement.style.display = 'block';
    } else {
      incentiveElement.style.display = 'none';
    }
  }

  /* ---- HOW TO PLAY SECTION ---- */
  const container = document.getElementById("how-to-play-list");
  if (container && howToPlayData.length > 0) {
  container.innerHTML = howToPlayData
    .filter(g => g.name && g.rules)
    .map(g => `
      <li class="testimonial swiper-slide">
        <img src="${g.image || ''}" alt="${g.name}" class="user-image"
          onerror="this.src='https://via.placeholder.com/160?text=Game'">
        <h3 class="name">${g.name}</h3>
        <i class="feedback">${g.rules}</i>
      </li>`).join('');
  }

  initializeStore();
})
.catch(err => {
  console.error("Load error:", err);
  document.getElementById("menu-list").innerHTML =
    "<p style='color:red;text-align:center;'>Failed to load store. Please refresh.</p>";
});

/* ---------- 2. BUILD NAV + DISPLAY ---------- */
function initializeStore() {
  const nav = document.getElementById("category-nav");
  const rawGameCats = allGames.flatMap(g =>
    (g.category || '').split(',').map(c => c.trim()).filter(c => c)
  );
  let categories = [...new Set(rawGameCats)];
  categories.sort((a, b) => a.localeCompare(b));

  nav.innerHTML = `<input type="text" id="search-input" placeholder="Search..." class="search-input" style="max-width:250px; min-width:120px; flex:0 0 auto;" />`;

  let navHtml = `<button class="category-btn active" data-category="all">All Games</button>`;
  navHtml += categories.map(cat => `<button class="category-btn" data-category="${cat}">${cat}</button>`).join('');
  nav.insertAdjacentHTML('beforeend', navHtml);

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    const applyMobileCap = () => {
      if (window.innerWidth <= 768) {
        searchInput.style.width = '120px';
        searchInput.style.flex = '0 0 120px';
      } else {
        searchInput.style.width = '';
        searchInput.style.flex = '';
      }
    };
    applyMobileCap();
    window.addEventListener('resize', applyMobileCap);
  }

  const categoryNav = document.getElementById('category-nav');
  const checkOverflow = () => {
    categoryNav.style.justifyContent = categoryNav.scrollWidth > categoryNav.clientWidth ? 'flex-start' : '';
  };
  setTimeout(checkOverflow, 0);
  window.addEventListener('resize', checkOverflow);

  displayItems();

  document.querySelectorAll(".category-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      currentCategory = btn.dataset.category;
      document.querySelectorAll(".category-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById('search-input').value = '';
      filterAndDisplayItems();
    });
  });

  document.getElementById('search-input')?.addEventListener('input', filterAndDisplayItems);
}

/* ---------- 3. FILTER + DISPLAY ---------- */
function filterAndDisplayItems() {
  const term = (document.getElementById('search-input')?.value || '').toLowerCase();
  let games = allGames;

  if (currentCategory !== "all") {
    games = games.filter(g =>
      (g.category || '').split(',').map(c => c.trim()).includes(currentCategory)
    );
  }

  if (term) {
    games = games.filter(g =>
      g.name.toLowerCase().includes(term) || (g.description || '').toLowerCase().includes(term)
    );
    document.querySelectorAll(".category-btn").forEach(b => b.classList.remove("active"));
    document.querySelector('[data-category="all"]')?.classList.add("active");
  }

  displayItems(games);
}

/* ---------- 4. RENDER CARDS ---------- */
function displayItems(games = allGames) {
  Object.values(activeTimers).forEach(clearInterval);
  activeTimers = {};

  const menu = document.getElementById("menu-list");
  const items = games.map(g => ({ ...g, type: 'game' }));

  menu.innerHTML = items.length
    ? items.map(generateItemCard).join('')
    : `<p style="text-align:center;color:#777;">No items found.</p>`;

  attachCartListeners();
  initializeOfferTimers();
  attachItemClickListeners(items);
}

/* ---------- 5. CARD HTML ---------- */
function generateItemCard(item) {
  const price = parseFloat(item.price) || 0;
  let effectiveOffer = parseFloat(item['on offer']) || 0;
  const endTime = item['offer ends']?.trim();

  if (endTime) {
    const end = new Date(endTime).getTime();
    if (isNaN(end) || end < Date.now()) effectiveOffer = 0;
  }

  const hasOffer = effectiveOffer > 0 && effectiveOffer < price;
  const finalPrice = hasOffer ? effectiveOffer : price;

  let ribbon = '', priceHTML = '', timer = '';

  if (hasOffer) {
    const save = Math.round(((price - effectiveOffer) / price) * 100);
    ribbon = `<div class="offer-ribbon">SALE! -${save}%</div>`;
    if (endTime) {
      timer = `<div class="offer-countdown" data-end-time="${endTime}">Ends in: <span class="timer-display">...</span></div>`;
    }
    priceHTML = `<p class="price-line sale-mode"><span class="old-price">KSH ${price}</span> <span class="sale-price">KSH ${effectiveOffer}</span></p>${timer}`;
  } else {
    priceHTML = `<p class="price-line"><span class="regular-price">KSH ${price}</span></p>`;
  }

  const firstCat = (item.category || 'All').split(',')[0].trim() || 'All';
  const truncatedDescription = truncateText(item.description || 'No description.', 100);

  return `
    <div class="menu-item fade-in" data-category="${firstCat}" data-original-price="${price}">
      ${ribbon}
      <img src="${item.image || ''}" alt="${item.name}" class="single-image"
        onerror="this.src='https://via.placeholder.com/300?text=${encodeURIComponent(item.name)}'">
      <h3 class="product-title">${item.name}</h3>
      <p class="text-card">${truncatedDescription}</p>
      ${priceHTML}
      <button class="add-to-cart" data-name="${item.name}" data-price="${finalPrice}" data-type="game">
        Add to Cart
      </button>
    </div>`;
}

/* ---------- 6. OFFER TIMERS ---------- */
function initializeOfferTimers() {
  document.querySelectorAll('.offer-countdown').forEach(el => {
    const update = () => {
      const end = new Date(el.getAttribute('data-end-time')).getTime();
      const diff = end - Date.now();

      if (isNaN(end) || diff <= 0) {
        const card = el.closest('.menu-item');
        const price = card.getAttribute('data-original-price');
        card.querySelector('.offer-ribbon')?.remove();
        card.querySelector('.price-line').innerHTML = `<span class="regular-price">KSH ${price}</span>`;
        card.querySelector('.add-to-cart').setAttribute('data-price', price);
        el.remove();
        clearInterval(id);
        delete activeTimers[id];
        return;
      }

      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      let str = d > 0 ? `${d}d ` : '';
      str += `${String(h).padStart(2,'0')}h:${String(m).padStart(2,'0')}m:${String(s).padStart(2,'0')}s`;
      el.querySelector('.timer-display').textContent = str;
    };

    const id = setInterval(update, 1000);
    update();
    activeTimers[id] = id;
  });
}

/* ---------- 7. CART ---------- */
function attachCartListeners() {
  document.querySelectorAll(".add-to-cart").forEach(btn => {
    btn.onclick = () => {
      if (btn.disabled) return;
      const name = btn.dataset.name;
      const price = parseFloat(btn.dataset.price);
      const type = btn.dataset.type;
      const existing = cart.find(i => i.name === name);
      if (existing) existing.quantity++;
      else cart.push({ name, price, quantity: 1, type });
      localStorage.setItem("cart", JSON.stringify(cart));
      btn.textContent = "Added!";
      setTimeout(() => btn.textContent = "Add to Cart", 1500);
      updateCartBadge();
    };
  });
}

/* ---------- 8. ITEM DETAIL MODAL ---------- */
function attachItemClickListeners(items) {
  document.querySelectorAll(".menu-item").forEach(card => {
    card.addEventListener('click', (event) => {
      if (event.target.closest('.add-to-cart')) return;
      const itemName = card.querySelector('.product-title')?.textContent.trim();
      const item = items.find(i => i.name === itemName);
      if (item) showDetailModal(item);
    });
  });
}

function generateDetailModalHTML(item) {
  const price = parseFloat(item.price) || 0;
  let effectiveOffer = parseFloat(item['on offer']) || 0;
  const endTime = item['offer ends']?.trim();
  if (endTime) {
    const end = new Date(endTime).getTime();
    if (isNaN(end) || end < Date.now()) effectiveOffer = 0;
  }

  const hasOffer = effectiveOffer > 0 && effectiveOffer < price;
  const finalPrice = hasOffer ? effectiveOffer : price;

  const priceHTML = hasOffer
    ? `<div class="modal-price-line sale-mode"><span class="modal-old-price">KSH ${price}</span> <span class="modal-sale-price">KSH ${finalPrice}</span> (On Sale!)</div>`
    : `<div class="modal-price-line"><span class="modal-regular-price">KSH ${finalPrice}</span></div>`;

  return `
    <span class="close-btn">&times;</span>
    <div class="modal-flex-container">
      <div class="modal-media-section">
        <img src="${item.image || 'https://via.placeholder.com/600?text=Game+View'}" alt="${item.name}" class="modal-main-image"
          onerror="this.src='https://via.placeholder.com/600?text=${encodeURIComponent(item.name)}'">
      </div>
      <div class="modal-details-section">
        <h2 class="modal-title">${item.name}</h2>
        <div class="modal-categories">Category: <strong>${item.category || 'N/A'}</strong></div>
        <h3 class="modal-subtitle">Details:</h3>
        <p class="modal-description">${item.description || 'No detailed description available.'}</p>
        <div class="modal-price-wrapper">${priceHTML}</div>
        <button class="add-to-cart modal-add-to-cart-btn" data-name="${item.name}" data-price="${finalPrice}" data-type="game">
          Add to Cart
        </button>
      </div>
    </div>`;
}

function showDetailModal(item) {
  const modal = document.getElementById('detail-modal');
  const modalContent = document.getElementById('modal-content');
  if (!modal || !modalContent) return;

  modalContent.innerHTML = generateDetailModalHTML(item);
  modal.style.display = 'block';

  const modalCartBtn = modalContent.querySelector('.add-to-cart');
  if (modalCartBtn) {
    modalCartBtn.onclick = () => {
      const name = modalCartBtn.dataset.name;
      const price = parseFloat(modalCartBtn.dataset.price);
      const existing = cart.find(i => i.name === name);
      if (existing) existing.quantity++;
      else cart.push({ name, price, quantity: 1, type: 'game' });
      localStorage.setItem("cart", JSON.stringify(cart));
      modalCartBtn.textContent = "Added!";
      setTimeout(() => modalCartBtn.textContent = "Add to Cart", 1500);
      updateCartBadge();
    };
  }

  modalContent.querySelector('.close-btn')?.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  window.onclick = (event) => {
    if (event.target === modal) {
      modal.style.display = 'none';
      window.onclick = null;
    }
  };
}

/* ---------- 9. CART BADGE ---------- */
function updateCartBadge() {
  const badge = document.querySelector('.cart-badge');
  if (!badge) return;
  const total = cart.reduce((s, i) => s + i.quantity, 0);
  badge.textContent = total;
  badge.classList.toggle('hidden', total === 0);
  badge.classList.remove('pulse');
  void badge.offsetWidth;
  if (total > 0) badge.classList.add('pulse');
  window.dispatchEvent(new Event('storage'));
}

/* ---------- 10. GLOBAL EVENTS ---------- */
window.addEventListener('storage', e => {
  if (e.key === 'cart') { cart = JSON.parse(e.newValue) || []; updateCartBadge(); }
});

document.addEventListener('DOMContentLoaded', () => {
  cart = JSON.parse(localStorage.getItem("cart")) || [];
  updateCartBadge();
});