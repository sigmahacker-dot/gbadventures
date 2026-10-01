let SITE = null;
const DEFAULT_DATA_URL = 'data/default-site.json';
const localKey = 'gbAdventureSiteDataV2';

// Elegant SVG mountain vector placeholder if any image fails
const FALLBACK_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 500' width='800' height='500'%3E%3Cdefs%3E%3ClinearGradient id='bg' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23003A66'/%3E%3Cstop offset='100%25' stop-color='%2308619b'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23bg)'/%3E%3Cpath d='M150 420 L350 200 L440 300 L550 170 L730 420 Z' fill='%23ffffff' opacity='0.15'/%3E%3Cpath d='M60 450 L270 240 L390 380 L520 220 L720 450 Z' fill='%23ffffff' opacity='0.25'/%3E%3Ccircle cx='620' cy='130' r='36' fill='%23E02454' opacity='0.85'/%3E%3Ctext x='50%25' y='465' fill='%23ffffff' font-family='sans-serif' font-size='20' font-weight='700' letter-spacing='2' text-anchor='middle' opacity='0.8'%3EGB ADVENTURE%3C/text%3E%3C/svg%3E";

const LOCAL_FALLBACKS = {
  hero: ['img/carousel-1.jpg', 'img/carousel-2.jpg'],
  package: ['img/country-1.jpg', 'img/country-2.jpg', 'img/country-3.jpg', 'img/country-4.jpg', 'img/training-1.jpg', 'img/training-2.jpg'],
  destination: ['img/country-1.jpg', 'img/country-2.jpg', 'img/country-3.jpg', 'img/country-4.jpg'],
  hotel: ['img/office-1.jpg', 'img/office-2.jpg', 'img/office-3.jpg', 'img/office-4.jpg'],
  team: ['assets/team/team-1.jpg', 'assets/team/team-2.jpg', 'assets/team/team-3.jpg'],
  gallery: ['img/car-1.jpg', 'img/car-2.jpg', 'img/country-1.jpg', 'img/country-2.jpg', 'img/carousel-1.jpg'],
  blog: ['img/country-1.jpg', 'img/country-2.jpg', 'img/country-3.jpg'],
  about: 'img/about-3.jpg',
  logo: 'assets/gb-adventure-logo.svg'
};

window.handleImageFallback = function(img, type = 'package') {
  if (!img) return;
  img.onerror = null; // Prevent infinite loop

  const specificFallback = img.getAttribute('data-fallback');
  if (specificFallback && img.src !== specificFallback) {
    img.src = specificFallback;
    img.onerror = function() {
      img.onerror = null;
      img.src = FALLBACK_PLACEHOLDER;
    };
    return;
  }

  const pool = LOCAL_FALLBACKS[type];
  if (Array.isArray(pool) && pool.length > 0) {
    const fallbackSrc = pool[Math.floor(Math.random() * pool.length)];
    if (img.src !== fallbackSrc) {
      img.src = fallbackSrc;
      img.onerror = function() {
        img.onerror = null;
        img.src = FALLBACK_PLACEHOLDER;
      };
      return;
    }
  } else if (typeof pool === 'string' && pool) {
    if (img.src !== pool) {
      img.src = pool;
      img.onerror = function() {
        img.onerror = null;
        img.src = FALLBACK_PLACEHOLDER;
      };
      return;
    }
  }

  img.src = FALLBACK_PLACEHOLDER;
};

// Global error listener catches any missed images anywhere on the page
window.addEventListener('error', function(e) {
  if (e.target && e.target.tagName === 'IMG') {
    const type = e.target.getAttribute('data-type') || 'package';
    window.handleImageFallback(e.target, type);
  }
}, true);

const esc = t => String(t ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

async function loadSite() {
  try {
    const r = await fetch('/api/site?_t=' + Date.now(), {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    if (r.ok) {
      const data = await r.json();
      if (data && typeof data === 'object') {
        SITE = data;
        SITE.settings = SITE.settings || {};
        SITE.hotels = SITE.hotels || [];
        SITE.team = SITE.team || [];
        SITE.packages = SITE.packages || [];
        SITE.heroSlides = SITE.heroSlides || [];
        SITE.gallery = SITE.gallery || [];
        try {
          localStorage.setItem(localKey, JSON.stringify(SITE));
        } catch (e) {}
        return SITE;
      }
    }
  } catch (e) {
    console.warn('Backend load error, falling back:', e);
  }

  const cached = localStorage.getItem(localKey);
  if (cached) {
    try {
      SITE = JSON.parse(cached);
      SITE.settings = SITE.settings || {};
      SITE.hotels = SITE.hotels || [];
      SITE.team = SITE.team || [];
      SITE.packages = SITE.packages || [];
      SITE.heroSlides = SITE.heroSlides || [];
      return SITE;
    } catch (e) {}
  }

  try {
    const r = await fetch(DEFAULT_DATA_URL + '?_t=' + Date.now());
    SITE = await r.json();
    SITE.settings = SITE.settings || {};
    SITE.hotels = SITE.hotels || [];
    SITE.team = SITE.team || [];
    SITE.packages = SITE.packages || [];
    SITE.heroSlides = SITE.heroSlides || [];
    return SITE;
  } catch (e) {
    console.error('Failed to load default site data:', e);
  }
}

function setText(id, val) {
  const e = document.getElementById(id);
  if (e) e.textContent = val ?? '';
}

function setAttr(id, attr, val) {
  const e = document.getElementById(id);
  if (e && val) e.setAttribute(attr, val);
}

function render() {
  if (!SITE) return;
  const s = SITE.settings || {};

  // Title and Meta Tags
  document.title = s.seoTitle || s.brand || 'GB Adventure';
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', s.seoDescription || s.tagline || '');
  const metaKeywords = document.querySelector('meta[name="keywords"]');
  if (metaKeywords) metaKeywords.setAttribute('content', s.seoKeywords || '');

  // Logos & Favicon
  const logoSrc = s.logo || 'assets/gb-adventure-logo.svg';
  ['brandLogo', 'footerLogo'].forEach(id => {
    const e = document.getElementById(id);
    if (e) {
      e.src = logoSrc;
      e.alt = s.brand || 'GB Adventure';
      e.setAttribute('data-type', 'logo');
      e.onerror = function() { this.onerror = null; this.src = 'assets/gb-adventure-logo.svg'; };
    }
  });

  const fav = document.getElementById('favicon');
  if (fav) fav.href = s.favicon || logoSrc;

  // About Section
  setText('aboutTitle', s.aboutTitle || 'About GB Adventure');
  setText('aboutText', s.aboutText || '');
  const ai = document.getElementById('aboutImage');
  if (ai) {
    ai.src = s.aboutImage || 'img/about-3.jpg';
    ai.setAttribute('data-type', 'about');
    ai.onerror = function() { this.onerror = null; this.src = 'img/about-3.jpg'; };
  }

  // Footer & Contact Information
  setText('footerText', s.footerText || s.tagline || '');
  setText('copyright', s.copyright || new Date().getFullYear().toString());
  setText('contactAddress', s.address || 'Gilgit-Baltistan, Pakistan');
  setText('contactPhone', s.phone || '+92 355 5101279');
  setText('contactEmail', s.email || 'rawiedites@gmail.com');
  setText('footerAddress', s.address || 'Gilgit-Baltistan, Pakistan');
  setText('footerPhone', s.phone || '+92 355 5101279');
  setText('footerEmail', s.email || 'rawiedites@gmail.com');

  setAttr('contactPhone', 'href', `tel:${s.phone || '+923555101279'}`);
  setAttr('contactEmail', 'href', `mailto:${s.email || 'rawiedites@gmail.com'}`);
  setAttr('contactWA', 'href', s.whatsapp || `https://wa.me/923555101279`);
  setAttr('waFloat', 'href', s.whatsapp || `https://wa.me/923555101279`);
  setAttr('bookingWhatsApp', 'href', s.whatsapp || `https://wa.me/923555101279`);
  setAttr('aboutWhatsApp', 'href', s.whatsapp || `https://wa.me/923555101279`);

  const topAddr = document.getElementById('topAddress');
  if (topAddr) topAddr.innerHTML = `<i class="fas fa-map-marker-alt me-2"></i>${esc(s.address || 'Gilgit-Baltistan, Pakistan')}`;
  const topPh = document.getElementById('topPhone');
  if (topPh) {
    topPh.href = `tel:${s.phone || '+923555101279'}`;
    topPh.innerHTML = `<i class="fas fa-phone-alt me-2"></i>${esc(s.phone || '+92 355 5101279')}`;
  }
  const topEm = document.getElementById('topEmail');
  if (topEm) {
    topEm.href = `mailto:${s.email || 'rawiedites@gmail.com'}`;
    topEm.innerHTML = `<i class="fas fa-envelope me-2"></i>${esc(s.email || 'rawiedites@gmail.com')}`;
  }

  const safeRender = (name, fn) => {
    try { fn(); } catch (err) { console.error(`Render failed (${name}):`, err); }
  };
  safeRender('socials', renderSocials);
  safeRender('hero', renderHero);
  safeRender('stats', renderStats);
  safeRender('packages', renderPackages);
  safeRender('destinations', renderDestinations);
  safeRender('hotels', renderHotels);
  safeRender('gallery', renderGallery);
  safeRender('services', renderServices);
  safeRender('team', renderTeam);
  safeRender('reviews', renderReviews);
  safeRender('blogs', renderBlogs);
  safeRender('faqs', renderFaqs);
  safeRender('packageSelect', fillPackageSelect);
  safeRender('trackView', trackView);
}

function renderSocials() {
  const s = SITE.socials || [];
  const html = s.map(x => `<a href="${esc(x.url)}" target="_blank" rel="noopener" aria-label="${esc(x.name)}"><i class="${esc(x.icon)}"></i></a>`).join('');
  ['topSocials', 'footerSocials', 'contactSocials', 'fixedSocials'].forEach(id => {
    const e = document.getElementById(id);
    if (e) e.innerHTML = html;
  });
}

function renderHero() {
  const slides = document.getElementById('heroSlides'), ind = document.getElementById('heroIndicators');
  if (!slides || !SITE.heroSlides) return;

  if (ind) {
    ind.innerHTML = SITE.heroSlides.map((_, i) =>
      `<button type="button" data-bs-target="#heroCarousel" data-bs-slide-to="${i}" class="${i ? '' : 'active'}" aria-label="Slide ${i + 1}"></button>`
    ).join('');
  }

  slides.innerHTML = SITE.heroSlides.map((x, i) => {
    const localFb = x.localFallback || (i === 0 ? 'img/carousel-1.jpg' : 'img/carousel-2.jpg');
    return `
      <div class="carousel-item ${i ? '' : 'active'}">
        <img src="${esc(x.image)}" alt="${esc(x.title)}" data-type="hero" data-fallback="${localFb}" referrerpolicy="no-referrer" onerror="handleImageFallback(this, 'hero')">
        <div class="carousel-caption">
          <div class="hero-glass text-center wow fadeInUp">
            <span class="glass-badge mb-3">${esc(x.eyebrow || 'Explore Northern Pakistan')}</span>
            <h1 class="display-3 text-white mb-4 fw-bold">${esc(x.title)}</h1>
            <p class="fs-5 mb-5 text-white-50 mx-auto" style="max-width:760px">${esc(x.text)}</p>
            <a href="#packages" class="btn btn-secondary border-light rounded-pill py-3 px-5 wow fadeInUp">${esc(x.button || 'Explore Packages')}</a>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderStats() {
  const e = document.getElementById('statsGrid');
  if (e) {
    e.innerHTML = (SITE.stats || []).map(x => `
      <div class="col-6 col-md-3">
        <div class="bg-white rounded-4 p-3 text-center shadow-sm h-100">
          <div class="display-6 text-secondary fw-bold">${esc(x.number)}</div>
          <small class="text-muted fw-bold">${esc(x.label)}</small>
        </div>
      </div>
    `).join('');
  }
}

function renderPackages(filter = 'All') {
  const cats = ['All', ...new Set(SITE.packages.map(x => x.category))];
  const f = document.getElementById('packageFilters'), g = document.getElementById('packageGrid');
  if (!f || !g) return;

  f.innerHTML = cats.map(c => `
    <button class="filter-btn ${c === filter ? 'active' : ''}" onclick="renderPackages('${esc(c)}')">${esc(c)}</button>
  `).join('');

  const arr = filter === 'All' ? SITE.packages : SITE.packages.filter(x => x.category === filter);
  g.innerHTML = arr.map((p, idx) => {
    const localFb = p.localFallback || `img/country-${(idx % 4) + 1}.jpg`;
    return `
      <div class="col-md-6 col-xl-4">
        <article class="package-card wow fadeInUp">
          <img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" data-type="package" data-fallback="${localFb}" referrerpolicy="no-referrer" onerror="handleImageFallback(this, 'package')">
          <div class="package-body">
            <span class="badge bg-secondary mb-2">${esc(p.category)}</span>
            <h3>${esc(p.name)}</h3>
            <p class="text-muted"><i class="fas fa-map-marker-alt me-1"></i>${esc(p.location)} · ${esc(p.duration)}</p>
            <div class="price-box mb-3">
              <div class="d-flex justify-content-between"><span>Solo</span><strong>${esc(p.solo)}</strong></div>
              <div class="d-flex justify-content-between"><span>Couple</span><strong>${esc(p.couple)}</strong></div>
            </div>
            <div class="d-flex gap-2">
              <button class="btn btn-primary rounded-pill px-4 flex-grow-1" onclick="openPackage('${esc(p.id)}')">View Details</button>
              <button class="btn btn-outline-secondary rounded-pill px-4" onclick="selectPackage('${esc(p.id)}')">Book</button>
            </div>
          </div>
        </article>
      </div>
    `;
  }).join('');
}

function openPackage(id) {
  const p = SITE.packages.find(x => x.id === id);
  if (!p) return;
  const localFb = p.localFallback || 'img/country-1.jpg';

  document.getElementById('packageModalBody').innerHTML = `
    <div class="package-detail-wrap position-relative">
      <button type="button" class="package-close-btn" data-bs-dismiss="modal" aria-label="Close package details">&times;</button>
      <img class="package-detail-hero" src="${esc(p.image)}" alt="${esc(p.name)}" data-type="package" data-fallback="${localFb}" referrerpolicy="no-referrer" onerror="handleImageFallback(this, 'package')">
      <div class="p-4 p-lg-5">
        <span class="badge bg-secondary mb-2">${esc(p.category)}</span>
        <h2>${esc(p.name)}</h2>
        <p class="text-muted">${esc(p.duration)} · ${esc(p.location)}</p>
        <div class="row g-4 my-3">
          <div class="col-md-3"><strong>Solo</strong><div class="text-primary fw-bold fs-5">${esc(p.solo)}</div></div>
          <div class="col-md-3"><strong>Couple</strong><div class="text-primary fw-bold fs-5">${esc(p.couple)}</div></div>
          <div class="col-md-6"><strong>Highlights</strong><div>${(p.highlights || []).map(esc).join(' · ')}</div></div>
        </div>
        <hr>
        <div class="row g-4">
          <div class="col-lg-6">
            <h4>Overview</h4>
            <p>${esc(p.overview)}</p>
            <h5 class="mt-3">Highlights</h5>
            <ul class="detail-list">${(p.highlights || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
          </div>
          <div class="col-lg-6">
            <h4>Itinerary</h4>
            <ul class="detail-list">${(p.itinerary || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
          </div>
          <div class="col-lg-6">
            <h4>What's Included</h4>
            <ul>${(p.included || []).map(x => `<li><i class="fas fa-check text-success me-2"></i>${esc(x)}</li>`).join('')}</ul>
          </div>
          <div class="col-lg-6">
            <h4>What's Not Included</h4>
            <ul>${(p.excluded || []).map(x => `<li><i class="fas fa-times text-danger me-2"></i>${esc(x)}</li>`).join('')}</ul>
          </div>
          ${p.activities && p.activities.length ? `
            <div class="col-12">
              <h4>Adventure Activities</h4>
              <div>${p.activities.map(x => `<span class="badge bg-light text-dark me-2 mb-2 p-2 border">${esc(x)}</span>`).join('')}</div>
            </div>
          ` : ''}
        </div>
        <div class="text-end mt-4">
          <button class="btn btn-primary rounded-pill px-5 py-2" data-bs-dismiss="modal" onclick="selectPackage('${esc(p.id)}')">Book This Tour</button>
        </div>
      </div>
    </div>
  `;
  new bootstrap.Modal(document.getElementById('packageModal')).show();
}

function selectPackage(id) {
  const p = SITE.packages.find(x => x.id === id), sel = document.getElementById('bookingPackage');
  if (sel) sel.value = p?.id || '';
  document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' });
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const el = document.getElementById('packageModal');
    if (el?.classList.contains('show')) bootstrap.Modal.getInstance(el)?.hide();
  }
});

function renderDestinations() {
  const e = document.getElementById('destinationGrid');
  if (e) {
    e.innerHTML = SITE.destinations.map((x, idx) => {
      const localFb = x.localFallback || `img/country-${(idx % 4) + 1}.jpg`;
      return `
        <div class="col-md-6 col-lg-4">
          <article class="dest-card">
            <img src="${esc(x.image)}" alt="${esc(x.name)}" loading="lazy" data-type="destination" data-fallback="${localFb}" referrerpolicy="no-referrer" onerror="handleImageFallback(this, 'destination')">
            <div class="p-4">
              <h3>${esc(x.icon || '🏔️')} ${esc(x.name)}</h3>
              <p class="mb-0 text-muted">${esc(x.text)}</p>
            </div>
          </article>
        </div>
      `;
    }).join('');
  }
}

function renderHotels() {
  const e = document.getElementById('hotelGrid');
  if (!e) return;
  e.innerHTML = (SITE.hotels || []).map((x, idx) => {
    const localFb = x.localFallback || `img/office-${(idx % 4) + 1}.jpg`;
    return `
      <div class="col-md-6 col-xl-3">
        <article class="hotel-card wow fadeInUp">
          <div class="hotel-image-wrap">
            <img src="${esc(x.image)}" alt="${esc(x.name)}" loading="lazy" data-type="hotel" data-fallback="${localFb}" referrerpolicy="no-referrer" onerror="handleImageFallback(this, 'hotel')">
            <span class="hotel-type">${esc(x.type || 'Hotel')}</span>
          </div>
          <div class="p-4">
            <h3>${esc(x.name)}</h3>
            <p class="hotel-location"><i class="fas fa-map-marker-alt me-2"></i>${esc(x.location)}</p>
            <p class="text-muted" style="font-size:14px">${esc(x.description)}</p>
            ${x.rating ? `<div class="hotel-rating mb-2">★ ${esc(x.rating)}</div>` : ''}
            <div>
              <a class="btn btn-sm btn-primary rounded-pill mt-2" href="${esc(x.map || '#')}" target="_blank" rel="noopener">View Location</a>
            </div>
          </div>
        </article>
      </div>
    `;
  }).join('') || '<div class="col-12"><div class="empty-site">Hotels will be added here soon.</div></div>';
}


let currentGalleryCategory = 'All';
let activeLightboxIndex = 0;
let fullGalleryOpen = false;

function renderGallery() {
  const items = SITE.gallery || [];
  if (!items.length) return;

  const btnText = document.getElementById('galleryBtnText');
  if (btnText) btnText.textContent = `View All Images (${items.length} Photos)`;

  // Item 0 (Top Left)
  const left1 = document.getElementById('galleryLeft1');
  if (left1 && items[0]) {
    const it = items[0];
    left1.innerHTML = `
      <img src="${esc(it.image)}" alt="${esc(it.title)}" loading="lazy" data-type="gallery" data-fallback="img/car-1.jpg" referrerpolicy="no-referrer" onerror="handleImageFallback(this, 'gallery')">
      <div class="gallery-overlay">
        <span class="gallery-tag">${esc(it.category || '4x4 Adventure')}</span>
        <h4 class="gallery-title">${esc(it.title)}</h4>
        <p class="gallery-location"><i class="fas fa-map-marker-alt me-1"></i> ${esc(it.location || 'Deosai Plains')}</p>
      </div>
    `;
  }

  // Item 1 (Bottom Left)
  const left2 = document.getElementById('galleryLeft2');
  if (left2 && items[1]) {
    const it = items[1];
    left2.innerHTML = `
      <img src="${esc(it.image)}" alt="${esc(it.title)}" loading="lazy" data-type="gallery" data-fallback="img/country-1.jpg" referrerpolicy="no-referrer" onerror="handleImageFallback(this, 'gallery')">
      <div class="gallery-overlay">
        <span class="gallery-tag">${esc(it.category || 'Meadows & Treks')}</span>
        <h4 class="gallery-title">${esc(it.title)}</h4>
        <p class="gallery-location"><i class="fas fa-map-marker-alt me-1"></i> ${esc(it.location || 'Fairy Meadows')}</p>
      </div>
    `;
  }

  // Item 2 (Center Hero)
  const center = document.getElementById('galleryCenter');
  if (center && items[2]) {
    const it = items[2];
    center.innerHTML = `
      <img src="${esc(it.image)}" alt="${esc(it.title)}" loading="lazy" data-type="gallery" data-fallback="img/carousel-1.jpg" referrerpolicy="no-referrer" onerror="handleImageFallback(this, 'gallery')">
      <div class="gallery-overlay">
        <div class="d-flex align-items-center gap-2 mb-2">
          <span class="gallery-tag mb-0">${esc(it.category || 'Featured Vista')}</span>
          <span class="badge bg-warning text-dark"><i class="fas fa-star me-1"></i> Featured</span>
        </div>
        <h3 class="gallery-title fs-3">${esc(it.title)}</h3>
        <p class="gallery-location fs-6"><i class="fas fa-map-marker-alt me-1"></i> ${esc(it.location || 'Hunza Valley')}</p>
        <p class="text-white-50 small mb-0 mt-1 d-none d-sm-block">${esc(it.caption || '')}</p>
      </div>
    `;
  }

  renderGalleryCategoryTabs();
  renderFullGalleryGrid();
}

function renderGalleryCategoryTabs() {
  const container = document.getElementById('galleryCategoryTabs');
  if (!container) return;
  const items = SITE.gallery || [];
  const categories = ['All', ...new Set(items.map(x => x.category).filter(Boolean))];

  container.innerHTML = categories.map(cat => `
    <button type="button" class="filter-btn ${cat === currentGalleryCategory ? 'active' : ''}" onclick="setGalleryCategory('${esc(cat)}')">
      ${esc(cat)}
    </button>
  `).join('');
}

function setGalleryCategory(cat) {
  currentGalleryCategory = cat;
  renderGalleryCategoryTabs();
  renderFullGalleryGrid();
}

function renderFullGalleryGrid() {
  const grid = document.getElementById('fullGalleryGrid');
  if (!grid) return;
  const items = SITE.gallery || [];
  const filtered = currentGalleryCategory === 'All' ? items : items.filter(x => x.category === currentGalleryCategory);

  grid.innerHTML = filtered.map((it) => {
    const originalIndex = items.indexOf(it);
    return `
      <div class="col-md-6 col-lg-4 col-xl-3">
        <div class="gallery-grid-item" onclick="openGalleryLightbox(${originalIndex})">
          <img src="${esc(it.image)}" alt="${esc(it.title)}" loading="lazy" data-type="gallery" data-fallback="img/country-2.jpg" referrerpolicy="no-referrer" onerror="handleImageFallback(this, 'gallery')">
          <div class="gallery-overlay p-3">
            <span class="gallery-tag small mb-1">${esc(it.category || 'GB Adventure')}</span>
            <h5 class="gallery-title fs-6 mb-1 text-truncate">${esc(it.title)}</h5>
            <p class="gallery-location small mb-0"><i class="fas fa-map-marker-alt me-1"></i>${esc(it.location || '')}</p>
          </div>
        </div>
      </div>
    `;
  }).join('') || '<div class="col-12 text-center text-muted py-4">No photos found in this category.</div>';
}

function toggleFullGallery() {
  fullGalleryOpen = !fullGalleryOpen;
  const sec = document.getElementById('fullGallerySection');
  const btn = document.getElementById('viewAllGalleryBtn');
  const btnText = document.getElementById('galleryBtnText');
  const items = SITE.gallery || [];

  if (sec) {
    sec.style.display = fullGalleryOpen ? 'block' : 'none';
  }
  if (btn && btnText) {
    if (fullGalleryOpen) {
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-outline-primary');
      btnText.innerHTML = `<i class="fas fa-chevron-up me-1"></i> Hide Full Gallery`;
      sec.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      btn.classList.remove('btn-outline-primary');
      btn.classList.add('btn-primary');
      btnText.innerHTML = `View All Images (${items.length} Photos)`;
    }
  }
}

function openGalleryLightbox(index) {
  const items = SITE.gallery || [];
  if (!items.length || index < 0 || index >= items.length) return;
  activeLightboxIndex = index;
  updateLightboxContent();

  const modalEl = document.getElementById('galleryLightbox');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
}

function updateLightboxContent() {
  const items = SITE.gallery || [];
  const it = items[activeLightboxIndex];
  if (!it) return;

  const lbImg = document.getElementById('lbImg');
  const lbTag = document.getElementById('lbTag');
  const lbCounter = document.getElementById('lbCounter');
  const lbTitle = document.getElementById('lbTitle');
  const lbLoc = document.getElementById('lbLocation');
  const lbCap = document.getElementById('lbCaption');

  if (lbImg) {
    lbImg.src = it.image;
    lbImg.alt = it.title;
    lbImg.onerror = function() { this.onerror = null; this.src = 'img/country-1.jpg'; };
  }
  if (lbTag) lbTag.textContent = it.category || 'GB Adventure';
  if (lbCounter) lbCounter.textContent = `${activeLightboxIndex + 1} of ${items.length}`;
  if (lbTitle) lbTitle.textContent = it.title || '';
  if (lbLoc) {
    const span = lbLoc.querySelector('span');
    if (span) span.textContent = it.location || 'Gilgit-Baltistan, Pakistan';
  }
  if (lbCap) lbCap.textContent = it.caption || '';
}

function prevLightboxImage() {
  const items = SITE.gallery || [];
  if (!items.length) return;
  activeLightboxIndex = (activeLightboxIndex - 1 + items.length) % items.length;
  updateLightboxContent();
}

function nextLightboxImage() {
  const items = SITE.gallery || [];
  if (!items.length) return;
  activeLightboxIndex = (activeLightboxIndex + 1) % items.length;
  updateLightboxContent();
}

// Expose globals on window for inline event handlers
window.renderGallery = renderGallery;
window.renderGalleryCategoryTabs = renderGalleryCategoryTabs;
window.setGalleryCategory = setGalleryCategory;
window.renderFullGalleryGrid = renderFullGalleryGrid;
window.toggleFullGallery = toggleFullGallery;
window.openGalleryLightbox = openGalleryLightbox;
window.prevLightboxImage = prevLightboxImage;
window.nextLightboxImage = nextLightboxImage;

// Keyboard navigation
document.addEventListener('keydown', function(e) {
  const modalEl = document.getElementById('galleryLightbox');
  if (modalEl && modalEl.classList.contains('show')) {
    if (e.key === 'ArrowLeft') prevLightboxImage();
    if (e.key === 'ArrowRight') nextLightboxImage();
  }
});

function renderServices() {
  const e = document.getElementById('serviceGrid');
  if (e) {
    e.innerHTML = SITE.services.map(x => `
      <div class="col-md-6 col-lg-4">
        <article class="service-card p-4 wow fadeInUp">
          <div class="btn btn-primary btn-lg-square mb-3"><i class="${esc(x.icon)}"></i></div>
          <h3>${esc(x.title)}</h3>
          <p class="mb-0 text-muted">${esc(x.text)}</p>
        </article>
      </div>
    `).join('');
  }
}

function renderTeam() {
  const e = document.getElementById('teamGrid');
  if (e) {
    e.innerHTML = SITE.team.map((x, idx) => {
      const localFb = `assets/team/team-${(idx % 3) + 1}.svg`;
      const imgSrc = x.image || localFb;
      return `
        <div class="col-md-6 col-lg-4">
          <article class="team-card p-4 text-center wow fadeInUp">
            <img class="team-photo mb-3" src="${esc(imgSrc)}" alt="${esc(x.name)}" data-type="team" data-fallback="${localFb}" onerror="handleImageFallback(this, 'team')">
            <h3>${esc(x.name)}</h3>
            <span class="badge bg-secondary mb-3">${esc(x.role)}</span>
            <p class="text-muted">${esc(x.description)}</p>
            <div class="social-row">
              ${[['facebook', 'fab fa-facebook-f'], ['instagram', 'fab fa-instagram'], ['tiktok', 'fab fa-tiktok'], ['whatsapp', 'fab fa-whatsapp']]
                .filter(([k]) => x[k])
                .map(([k, i]) => `<a href="${esc(x[k])}" target="_blank" rel="noopener" aria-label="${k}"><i class="${i}"></i></a>`)
                .join('')}
            </div>
          </article>
        </div>
      `;
    }).join('');
  }
}

function renderReviews() {
  const e = document.getElementById('reviewGrid');
  if (e) {
    e.innerHTML = SITE.reviews.map(x => `
      <div class="col-md-6 col-lg-4">
        <article class="review-card p-4 wow fadeInUp">
          <div class="text-secondary fs-2 mb-2">★★★★★</div>
          <p class="fs-5">“${esc(x.text)}”</p>
          <strong>${esc(x.name)}</strong>
          <div class="text-muted">${esc(x.role)}</div>
        </article>
      </div>
    `).join('');
  }
}

function renderBlogs() {
  const e = document.getElementById('blogGrid');
  if (e) {
    e.innerHTML = SITE.blogs.map((x, idx) => {
      const localFb = x.localFallback || `img/country-${(idx % 4) + 1}.jpg`;
      return `
        <div class="col-md-6 col-lg-4">
          <article class="blog-card">
            <img src="${esc(x.image)}" alt="${esc(x.title)}" loading="lazy" data-type="blog" data-fallback="${localFb}" referrerpolicy="no-referrer" onerror="handleImageFallback(this, 'blog')">
            <div class="p-4">
              <span class="eyebrow">${esc(x.category)}</span>
              <h3 class="mt-2">${esc(x.title)}</h3>
              <p class="text-muted">${esc(x.excerpt)}</p>
              <a class="btn btn-primary rounded-pill" href="${esc(x.slug)}">Read Guide →</a>
            </div>
          </article>
        </div>
      `;
    }).join('');
  }
}

function renderFaqs() {
  const e = document.getElementById('faqAccordion');
  if (e) {
    e.innerHTML = SITE.faqs.map((x, i) => `
      <div class="accordion-item faq-item">
        <h2 class="accordion-header">
          <button class="accordion-button ${i ? 'collapsed' : ''}" type="button" data-bs-toggle="collapse" data-bs-target="#faq${i}">
            ${esc(x.q)}
          </button>
        </h2>
        <div id="faq${i}" class="accordion-collapse collapse ${i ? '' : 'show'}" data-bs-parent="#faqAccordion">
          <div class="accordion-body text-muted">${esc(x.a)}</div>
        </div>
      </div>
    `).join('');
  }
}

function fillPackageSelect() {
  const e = document.getElementById('bookingPackage');
  if (e && SITE.packages) {
    e.innerHTML = '<option value="">Select package</option>' + SITE.packages.map(x => `
      <option value="${esc(x.id)}">${esc(x.name)} — ${esc(x.duration)}</option>
    `).join('');
  }
}

async function trackView() {
  try {
    let vid = localStorage.getItem('gbVisitorId');
    if (!vid) {
      vid = crypto.randomUUID ? crypto.randomUUID() : 'v-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      localStorage.setItem('gbVisitorId', vid);
    }
    await fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'page_view', path: location.pathname, visitorId: vid })
    });
  } catch (e) {}
}

function getWhatsAppNumber() {
  let raw = (SITE.settings && SITE.settings.whatsapp) || '923555101279';
  raw = String(raw).replace(/^https?:\/\/(wa\.me|api\.whatsapp\.com\/send\?phone=)\/?/, '');
  let digits = raw.replace(/[^0-9]/g, '');
  if (digits.startsWith('03') && digits.length === 11) {
    digits = '92' + digits.slice(1);
  }
  return digits || '923555101279';
}

function formatBookingWhatsAppMessage(data) {
  const parts = [
    `*🏔️ NEW TOUR BOOKING REQUEST*`,
    `*GB Adventure Travel & Tours*`,
    `──────────────────────────`,
    `👤 *Name:* ${data.name || '-'}`,
    `📱 *WhatsApp / Phone:* ${data.phone || '-'}`,
    data.email ? `📧 *Email:* ${data.email}` : null,
    `🎒 *Tour Package:* ${data.packageName || data.package || 'Custom Tour'}`,
    data.date ? `📅 *Travel Date:* ${data.date}` : null,
    data.travellers ? `👥 *Number of Persons:* ${data.travellers}` : null,
    data.plan ? `⭐ *Package Plan:* ${data.plan}` : null,
    data.days ? `⏳ *Duration:* ${data.days} Days` : null,
    data.message ? `📝 *Special Request / Message:* ${data.message}` : null,
    `──────────────────────────`,
    `🌐 *Sent from Website:* ${window.location.hostname}`
  ].filter(Boolean);
  return parts.join('\n');
}

async function submitBooking(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Submitting & Opening WhatsApp…';
  }

  const f = new FormData(form), data = Object.fromEntries(f.entries());
  data.packageName = SITE.packages.find(x => x.id === data.package)?.name || data.package || 'Custom Tour';
  data.createdAt = new Date().toISOString();

  const waPhone = getWhatsAppNumber();
  const waText = encodeURIComponent(formatBookingWhatsAppMessage(data));
  const waUrl = `https://wa.me/${waPhone}?text=${waText}`;

  let ok = false;
  try {
    const r = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    ok = r.ok;
    if (r.ok) {
      const resData = await r.json().catch(() => ({}));
      if (resData.id) data.id = resData.id;
    }
  } catch (err) {
    console.error('Server booking submission error:', err);
  }

  // Backup to localStorage
  try {
    const b = JSON.parse(localStorage.getItem('gbBookings') || '[]');
    if (!data.id) data.id = 'local-' + Date.now();
    data.status = 'New';
    b.unshift(data);
    localStorage.setItem('gbBookings', JSON.stringify(b));
    ok = true;
  } catch (err) {}

  // Open WhatsApp in a new window/tab
  try {
    window.open(waUrl, '_blank');
  } catch (err) {
    console.warn('WhatsApp auto-open popup prevented by browser:', err);
  }

  const status = document.getElementById('bookingStatus');
  if (status) {
    status.innerHTML = `
      <div class="mt-3 p-3 bg-white text-dark rounded-4 shadow-sm border border-success d-flex flex-wrap align-items-center justify-content-between gap-3">
        <div>
          <div class="fw-bold text-success fs-6"><i class="fas fa-check-circle me-1"></i> Booking Request Saved & Submitted!</div>
          <small class="text-muted">Opening WhatsApp to finalize your booking directly with GB Adventure.</small>
        </div>
        <a href="${waUrl}" target="_blank" class="btn btn-success rounded-pill px-4 py-2 fw-bold text-nowrap shadow-sm">
          <i class="fab fa-whatsapp me-2 fs-5 align-middle"></i> Chat on WhatsApp Now
        </a>
      </div>
    `;
  }

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnHtml;
  }
  form.reset();
}

function dismissSpinner() {
  const sp = document.getElementById('spinner');
  if (sp) {
    sp.style.transition = 'opacity 0.25s ease';
    sp.style.opacity = '0';
    setTimeout(() => {
      sp.classList.remove('show');
      sp.style.display = 'none';
    }, 250);
  }
}

async function startApp() {
  // 1. Instant synchronous pre-hydration from cache: 0ms paint, zero flicker
  let hasCached = false;
  try {
    const cached = localStorage.getItem(localKey);
    if (cached) {
      SITE = JSON.parse(cached);
      if (SITE && typeof SITE === 'object') {
        SITE.settings = SITE.settings || {};
        SITE.hotels = SITE.hotels || [];
        SITE.team = SITE.team || [];
        SITE.packages = SITE.packages || [];
        SITE.heroSlides = SITE.heroSlides || [];
        render();
        hasCached = true;
        // Pre-hydrated cleanly, dismiss spinner
        dismissSpinner();
      }
    }
  } catch (e) {
    console.warn('Pre-hydration warning:', e);
  }

  // 2. Fetch fresh data in background (or foreground if first visit)
  try {
    const r = await fetch('/api/site?_t=' + Date.now(), {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    if (r.ok) {
      const data = await r.json();
      if (data && typeof data === 'object') {
        const freshRaw = JSON.stringify(data);
        const cachedRaw = localStorage.getItem(localKey);
        // Only trigger DOM re-render if data has genuinely changed or wasn't cached
        if (!hasCached || freshRaw !== cachedRaw) {
          SITE = data;
          SITE.settings = SITE.settings || {};
          SITE.hotels = SITE.hotels || [];
          SITE.team = SITE.team || [];
          SITE.packages = SITE.packages || [];
          SITE.heroSlides = SITE.heroSlides || [];
          SITE.gallery = SITE.gallery || [];
          try {
            localStorage.setItem(localKey, freshRaw);
          } catch (e) {}
          render();
        }
      }
    }
  } catch (e) {
    console.warn('Network sync error:', e);
  }

  // 3. If first visit and network failed, fallback to default
  if (!SITE) {
    try {
      const r = await fetch(DEFAULT_DATA_URL + '?_t=' + Date.now());
      SITE = await r.json();
      render();
    } catch (e) {}
  }

  const form = document.getElementById('bookingForm');
  if (form) form.addEventListener('submit', submitBooking);

  dismissSpinner();

  setTimeout(() => {
    dismissSpinner();
    if (window.WOW) {
      try { new WOW().init(); } catch (e) {}
    }
    document.querySelectorAll('.wow').forEach(el => {
      el.style.visibility = 'visible';
    });
  }, 100);
}

// Fallback safety timeout: ensure spinner is never stuck even on extreme slow network
setTimeout(dismissSpinner, 2500);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
