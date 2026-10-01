const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const esc=t=>String(t??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

let D=null, currentSection='dashboard', analyticsCache=null, analyticsTimer=null, bookingsCache=[];

function showLogin(){
  $('#loginView').hidden=false;
  $('#appView').hidden=true;
  $('#loginUser').focus();
}

function showApp(){
  $('#loginView').hidden=true;
  $('#appView').hidden=false;
  updateAdminBrandLogo();
  renderNav();
  renderSection(currentSection);
}

function updateAdminBrandLogo(){
  const logo = D?.settings?.logo || 'assets/gb-adventure-logo.svg';
  const el = $('#appView .side-brand img');
  if(el) el.src = logo;
  const authLogo = $('.auth-logo-wrap img');
  if(authLogo) authLogo.src = logo;
}

async function api(path,opt={}){
  const token = localStorage.getItem('gb_admin_token') || '';
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(opt.headers || {})
  };
  const res=await fetch('/api'+path,{
    credentials:'include',
    ...opt,
    headers
  });
  const data=await res.json().catch(()=>({}));
  return {ok:res.ok,status:res.status,data};
}

async function boot(){
  const r=await api('/me');
  if(r.ok){
    showApp();
    await loadData();
  } else {
    showLogin();
  }
}

async function loadData(){
  const r=await api('/site?_t=' + Date.now());
  if(r.ok){
    D=r.data;
  } else {
    try{
      D=JSON.parse(localStorage.getItem('gbAdventureSiteDataV2')||'null');
    }catch(e){}
    if(!D){
      const def=await fetch('/data/default-site.json?_t=' + Date.now());
      D=await def.json();
    }
  }
  D.hotels=D.hotels||[];
  updateAdminBrandLogo();
  renderSection(currentSection);
}

// Client-side smart image compression & reader
function processImageFile(file, callback, key = ''){
  if(!file) return;
  if(file.type === 'image/svg+xml'){
    const reader = new FileReader();
    reader.onload = e => callback(e.target.result);
    reader.readAsDataURL(file);
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e){
    const img = new Image();
    img.onload = function(){
      const lk = String(key || '').toLowerCase();
      let maxDim = 800;
      let quality = 0.78;
      if (lk === 'logo' || lk === 'favicon') {
        maxDim = 400;
        quality = 0.85;
      } else if (lk === 'image' || lk === 'avatar' || lk === 'photo' || lk === 'team') {
        maxDim = 450;
        quality = 0.82;
      }

      let w = img.width, h = img.height;
      if(w > maxDim || h > maxDim){
        if(w > h){
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      let dataUrl;
      try{
        dataUrl = canvas.toDataURL('image/webp', quality);
      }catch(err){
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }
      callback(dataUrl);
    };
    img.onerror = () => callback(e.target.result);
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function initImageDropzones(container = document){
  const dropzones = container.querySelectorAll('.image-drop-area');
  dropzones.forEach(zone => {
    const key = zone.dataset.dropKey || zone.dataset.key;
    const fileInput = zone.querySelector('input[type="file"]') || container.querySelector('#file_' + key);
    const textInput = container.querySelector(`input[data-key="${key}"], input[data-edit="${key}"], #input_${key}`);
    const previewImg = container.querySelector('#prev_' + key);

    if(!zone || !fileInput || zone.__initialized) return;
    zone.__initialized = true;

    const handleFile = (file) => {
      if(!file || !file.type.startsWith('image/')) {
        showToast('Please select a valid image file.', 'warn');
        return;
      }
      showToast('Processing image...', 'ok');
      processImageFile(file, async (dataUrl) => {
        if(textInput) {
          textInput.value = dataUrl;
          textInput.dispatchEvent(new Event('input', {bubbles: true}));
          textInput.dispatchEvent(new Event('change', {bubbles: true}));
        }
        if(previewImg) {
          previewImg.src = dataUrl;
        }
        if(key === 'logo') {
          if(D && D.settings) D.settings.logo = dataUrl;
          updateAdminBrandLogo();
          showToast('Saving new logo...', 'ok');
          await persist();
        } else {
          showToast('Image ready! Click Save to save changes.', 'ok');
        }
      }, key);
    };

    zone.addEventListener('dragover', e => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', e => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove('drag-over');
    });
    zone.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove('drag-over');
      if(e.dataTransfer.files && e.dataTransfer.files[0]){
        handleFile(e.dataTransfer.files[0]);
      }
    });
    zone.addEventListener('click', () => {
      fileInput.click();
    });
    fileInput.addEventListener('change', e => {
      if(e.target.files && e.target.files[0]){
        handleFile(e.target.files[0]);
      }
    });

    if(textInput && previewImg){
      textInput.addEventListener('input', () => {
        previewImg.src = textInput.value || 'assets/gb-adventure-logo.svg';
        if(key === 'logo') {
          if(D && D.settings) D.settings.logo = textInput.value;
          updateAdminBrandLogo();
        }
      });
    }
  });
}

window.clearImageField = async function(key){
  const textInput = document.querySelector(`input[data-key="${key}"], input[data-edit="${key}"], #input_${key}`);
  const previewImg = document.querySelector('#prev_' + key);
  if(textInput) {
    textInput.value = '';
    textInput.dispatchEvent(new Event('input', {bubbles: true}));
    textInput.dispatchEvent(new Event('change', {bubbles: true}));
  }
  const fallback = key === 'logo' ? 'assets/gb-adventure-logo.svg' : 'assets/team/team-1.svg';
  if(previewImg) previewImg.src = fallback;
  if(key === 'logo'){
    if(D && D.settings) D.settings.logo = 'assets/gb-adventure-logo.svg';
    if(textInput) textInput.value = 'assets/gb-adventure-logo.svg';
    updateAdminBrandLogo();
    showToast('Reset logo to default...', 'ok');
    await persist();
  }
};

window.resetDefaultLogo = async function(){
  const defaultLogo = 'assets/gb-adventure-logo.svg';
  const textInput = document.querySelector('input[data-key="logo"], #input_logo');
  const previewImg = document.querySelector('#prev_logo');
  if(textInput) textInput.value = defaultLogo;
  if(previewImg) previewImg.src = defaultLogo;
  if(D && D.settings) D.settings.logo = defaultLogo;
  updateAdminBrandLogo();
  showToast('Saving default logo...', 'ok');
  await persist();
};

const navItems=[
  ['dashboard','Dashboard','chart-pie'],
  ['settings','Website Settings & Logo','sliders-h'],
  ['hero','Hero Slider','images'],
  ['stats','Key Metrics','chart-bar'],
  ['packages','Tour Packages','map-marked-alt'],
  ['destinations','Destinations','compass'],
  ['hotels','Hotels & Resorts','hotel'],
  ['gallery','Photo Gallery','camera-retro'],
  ['services','Services','concierge-bell'],
  ['team','Guides & Team','users'],
  ['reviews','Testimonials','star'],
  ['blogs','Travel Guides & Blog','newspaper'],
  ['faqs','FAQs','question-circle'],
  ['socials','Social Links','share-alt'],
  ['bookings','Booking Manager','calendar-check'],
  ['admins','User Accounts','user-shield'],
  ['ownership','Ownership','key'],
  ['backup','Data Backup & Sync','database']
];

function renderNav(){
  $('#sideNav').innerHTML=navItems.map(([k,label,icon])=>`
    <button class="${k===currentSection?'active':''}" onclick="navigate('${k}')">
      <i class="fas fa-${icon}"></i>
      <span>${label}</span>
    </button>
  `).join('');
}

function navigate(sec){
  if(currentSection === 'settings' && sec !== 'settings'){
    const keys = ['brand','tagline','domain','email','phone','whatsapp','address','logo','favicon','seoTitle','seoDescription','seoKeywords','aboutTitle','aboutText','aboutImage','aboutImage2','footerText','copyright'];
    keys.forEach(k => {
      const el = document.querySelector(`input[data-key="${k}"], textarea[data-key="${k}"], select[data-key="${k}"], #input_${k}`);
      if(el && D && D.settings) D.settings[k] = el.value.trim();
    });
  }
  currentSection=sec;
  renderNav();
  renderSection(sec);
}

function renderSection(sec){
  $$('.panel').forEach(p=>p.classList.remove('active'));
  const el=$('#'+sec);
  if(!el) return;
  el.classList.add('active');
  const label=navItems.find(x=>x[0]===sec)?.[1]||'Dashboard';
  $('#pageTitle').textContent=label;
  const map={
    dashboard:renderDashboard,
    settings:renderSettings,
    hero:renderHero,
    stats:renderStats,
    packages:renderPackages,
    destinations:renderDestinations,
    hotels:renderHotels,
    gallery:renderGallery,
    services:renderServices,
    team:renderTeam,
    reviews:renderReviews,
    blogs:renderBlogs,
    faqs:renderFaqs,
    socials:renderSocials,
    bookings:renderBookings,
    admins:renderAdmins,
    ownership:renderOwnership,
    backup:renderBackup
  };
  (map[sec]||renderDashboard)();
}

function card(title,body,cls=''){
  return `<div class="card ${cls}"><h3>${title}</h3>${body}</div>`;
}

function metric(label,value,sub='',tone='blue'){
  return `<div class="metric-card tone-${tone}">
    <div class="metric-icon"><i class="fas fa-${tone==='green'?'check-circle':tone==='pink'?'chart-line':tone==='orange'?'clock':'chart-bar'}"></i></div>
    <div>
      <div class="muted">${label}</div>
      <div class="metric-value">${value}</div>
      <div class="metric-sub">${sub}</div>
    </div>
  </div>`;
}

async function refreshAnalytics(){
  const r=await api('/analytics');
  if(r.ok){
    analyticsCache=r.data;
    renderDashboard();
  }
}

async function renderDashboard(){
  const r=await api('/analytics');
  analyticsCache=r.ok?r.data:{totals:{views:0,visitors:0,bookings:0,revenue:0},bookingStats:{new:0,contacted:0,confirmed:0,cancelled:0},topPackages:[],daily:[]};
  const a=analyticsCache;
  const bStats=a.bookingStats||{new:0,contacted:0,confirmed:0,cancelled:0};
  const tot=a.totals||{views:0,visitors:0,bookings:0};
  const maxDay=Math.max(...(a.daily||[]).map(d=>Math.max(d.views,d.visitors)),1);

  $('#dashboard').innerHTML=`
    <div class="dashboard-head">
      <div>
        <div class="eyebrow">Realtime Control Center</div>
        <h2>Live Website Analytics</h2>
      </div>
      <div class="actions">
        <button class="small-btn" onclick="refreshAnalytics()"><i class="fas fa-sync-alt"></i> Refresh</button>
      </div>
    </div>
    <div class="metrics-grid">
      ${metric('Total Page Views', tot.views, 'Realtime tracked', 'blue')}
      ${metric('Unique Visitors', tot.visitors, 'Distinct devices', 'pink')}
      ${metric('Total Bookings', tot.bookings, 'Submitted leads', 'green')}
      ${metric('New Leads', bStats.new||0, 'Awaiting response', 'orange')}
    </div>
    <div class="dashboard-grid">
      <div class="card">
        <div class="card-head">
          <h3>Visitor Activity (Last 7 Days)</h3>
          <span class="live-dot">Live sync</span>
        </div>
        <div class="mini-chart">
          ${(a.daily||[]).map(d=>`
            <div class="chart-col">
              <div class="chart-bars">
                <span style="height:${Math.round((d.views/maxDay)*100)}%" title="${d.views} views"></span>
                <span class="visit-bar" style="height:${Math.round((d.visitors/maxDay)*100)}%" title="${d.visitors} visitors"></span>
              </div>
              <small>${d.date?.slice(5)||''}</small>
            </div>
          `).join('')}
        </div>
        <div class="legend-note">
          <span style="color:#003a66">■ Views</span> &nbsp;
          <span style="color:#e02454">■ Visitors</span>
        </div>
      </div>
      <div class="card">
        <div class="card-head">
          <h3>Booking Pipeline</h3>
          <button class="link-btn" onclick="navigate('bookings')">View All</button>
        </div>
        <div class="bars">
          <div>
            <div class="bar-label"><span>New Leads</span><b>${bStats.new||0}</b></div>
            <div class="bar-track"><span style="width:${Math.min(100,(bStats.new||0)*20)}%;background:#0b5a96"></span></div>
          </div>
          <div>
            <div class="bar-label"><span>Contacted</span><b>${bStats.contacted||0}</b></div>
            <div class="bar-track"><span style="width:${Math.min(100,(bStats.contacted||0)*20)}%;background:#e09400"></span></div>
          </div>
          <div>
            <div class="bar-label"><span>Confirmed</span><b>${bStats.confirmed||0}</b></div>
            <div class="bar-track"><span style="width:${Math.min(100,(bStats.confirmed||0)*20)}%;background:#159957"></span></div>
          </div>
          <div>
            <div class="bar-label"><span>Cancelled</span><b>${bStats.cancelled||0}</b></div>
            <div class="bar-track"><span style="width:${Math.min(100,(bStats.cancelled||0)*20)}%;background:#c0392b"></span></div>
          </div>
        </div>
      </div>
      <div class="card wide">
        <div class="card-head">
          <h3>Popular Tour Inquiries</h3>
          <button class="link-btn" onclick="navigate('packages')">Manage Packages</button>
        </div>
        <div class="top-list">
          ${(a.topPackages||[]).map((p,i)=>`
            <div class="top-row">
              <span class="rank">${i+1}</span>
              <span class="grow"><b>${esc(p.name)}</b></span>
              <span class="tag">${p.count} bookings</span>
            </div>
          `).join('')||'<div class="empty">No booking inquiries logged yet.</div>'}
        </div>
      </div>
    </div>
  `;
}

function field(label,key,val,type='text',hint=''){
  return `<div class="field">
    <label>${esc(label)}</label>
    ${type==='textarea'
      ? `<textarea data-key="${esc(key)}">${esc(val)}</textarea>`
      : `<input data-key="${esc(key)}" type="${type}" value="${esc(val)}">`
    }
    ${hint?`<small class="field-hint">${esc(hint)}</small>`:''}
  </div>`;
}

function imageField(label, key, val, hint='Drag & drop image or browse file', isModal=false){
  const attr = isModal ? 'data-edit' : 'data-key';
  return `
    <div class="field image-uploader-field">
      <label>${esc(label)}</label>
      <div class="image-uploader-box">
        <div class="image-preview-wrap">
          <img class="image-preview-thumb" id="prev_${esc(key)}" src="${esc(val||'assets/gb-adventure-logo.svg')}" alt="Preview" onerror="this.src='assets/gb-adventure-logo.svg'">
        </div>
        <div class="image-drop-area" data-drop-key="${esc(key)}" id="drop_${esc(key)}" style="position:relative;"><i class="fas fa-cloud-upload-alt"></i><span><b>Drag & drop</b> image or <span class="browse-link" style="text-decoration:underline;font-weight:700;color:#003a66;">browse</span></span><input type="file" accept="image/*,.svg" id="file_${esc(key)}" style="position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;z-index:5;pointer-events:none;">
        </div>
      </div>
      <div class="image-url-input-wrap">
        <input ${attr}="${esc(key)}" id="input_${esc(key)}" value="${esc(val)}" placeholder="Or paste image URL / asset path...">
        <button type="button" class="clear-img-btn" onclick="clearImageField('${esc(key)}')">Clear</button>
      </div>
      ${hint ? `<small class="field-hint">${esc(hint)}</small>` : ''}
    </div>
  `;
}

function renderSettings(){
  $('#settings').innerHTML=`
    <div class="card logo-manager-card mb-4" style="margin-bottom:16px;">
      <div class="card-head">
        <div>
          <div class="eyebrow" style="color:#003a66">Brand Identity</div>
          <h3 style="margin:0">Website Logo Manager</h3>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="primary small-btn" onclick="saveSettings()"><i class="fas fa-save"></i> Save Logo</button>
          <button class="small-btn" onclick="resetDefaultLogo()"><i class="fas fa-undo"></i> Reset Default</button>
        </div>
      </div>
      <p class="muted" style="margin:6px 0 14px">Upload your agency logo or drag and drop a new logo file (SVG, PNG, WebP, JPG). The logo updates instantly across the navbar, footer, and admin dashboard.</p>
      <div class="logo-preview-container">
        <div class="logo-display-box">
          <img id="prev_logo" src="${esc(D.settings.logo || 'assets/gb-adventure-logo.svg')}" alt="Current Logo" onerror="this.src='assets/gb-adventure-logo.svg'">
        </div>
        <div class="logo-actions">
          <div class="image-drop-area" data-drop-key="logo" id="drop_logo" style="position:relative;min-height:65px"><i class="fas fa-cloud-upload-alt"></i><span><b>Drag & drop new logo file here</b> or <span class="browse-link" style="text-decoration:underline;font-weight:700;color:#003a66;">browse file</span></span><input type="file" accept="image/*,.svg" id="file_logo" style="position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;z-index:5;pointer-events:none;">
          </div>
          <div class="image-url-input-wrap">
            <input data-key="logo" id="input_logo" value="${esc(D.settings.logo)}" placeholder="Or enter logo path / URL">
            <button type="button" class="clear-img-btn" onclick="clearImageField('logo')">Clear</button>
          </div>
        </div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h3>Brand & Contact</h3>
        ${field('Brand name','brand',D.settings.brand)}
        ${field('Tagline','tagline',D.settings.tagline)}
        ${field('Domain','domain',D.settings.domain)}
        ${field('Email','email',D.settings.email,'email')}
        ${field('Phone / WhatsApp','phone',D.settings.phone)}
        ${field('WhatsApp URL','whatsapp',D.settings.whatsapp)}
        ${field('Address','address',D.settings.address)}
      </div>
      <div class="card">
        <h3>Favicon & SEO</h3>
        ${imageField('Favicon Image','favicon',D.settings.favicon, 'Small icon for browser tab (32x32 PNG/SVG/ICO)')}
        ${field('SEO title','seoTitle',D.settings.seoTitle)}
        ${field('SEO description','seoDescription',D.settings.seoDescription,'textarea')}
        ${field('SEO keywords','seoKeywords',D.settings.seoKeywords,'textarea')}
      </div>
      <div class="card">
        <h3>About Section</h3>
        ${field('About title','aboutTitle',D.settings.aboutTitle)}
        ${field('About text','aboutText',D.settings.aboutText,'textarea')}
        ${imageField('About Image 1','aboutImage',D.settings.aboutImage, 'Primary about section photo')}
        ${imageField('About Image 2','aboutImage2',D.settings.aboutImage2, 'Secondary about section graphic')}
      </div>
      <div class="card">
        <h3>Footer & Copyright</h3>
        ${field('Footer text','footerText',D.settings.footerText,'textarea')}
        ${field('Copyright','copyright',D.settings.copyright)}
      </div>
    </div>
    <div class="actions page-actions">
      <button class="primary" onclick="saveSettings()"><i class="fas fa-save"></i> Save Website Settings</button>
    </div>
  `;
  initImageDropzones($('#settings'));
}

async function saveSettings(){
  const keys = ['brand','tagline','domain','email','phone','whatsapp','address','logo','favicon','seoTitle','seoDescription','seoKeywords','aboutTitle','aboutText','aboutImage','aboutImage2','footerText','copyright'];
  keys.forEach(k => {
    const el = document.querySelector(`input[data-key="${k}"], textarea[data-key="${k}"], select[data-key="${k}"]`);
    if(el && D && D.settings) D.settings[k] = el.value.trim();
  });
  updateAdminBrandLogo();
  return await persist();
}

function renderHero(){
  $('#hero').innerHTML=`
    <div class="toolbar">
      <button class="primary" onclick="editHero(-1)">+ Add Hero Slide</button>
    </div>
    <div class="list">
      ${D.heroSlides.map((s,i)=>`
        <div class="item-row">
          <img src="${esc(s.image)}" alt="" onerror="this.src='img/carousel-1.jpg'">
          <div>
            <div class="title">${esc(s.title)}</div>
            <div class="muted">${esc(s.eyebrow||'')} · ${esc(s.button)}</div>
          </div>
          <div class="actions">
            <button class="small-btn" onclick="editHero(${i})">Edit</button>
            <button class="danger" onclick="delItem('heroSlides',${i})">Delete</button>
          </div>
        </div>
      `).join('')||'<div class="empty">No slides. Add one above.</div>'}
    </div>
  `;
}

function renderStats(){
  $('#stats').innerHTML=`
    <div class="toolbar"><button class="primary" onclick="editSimple('stats',-1)">+ Add Stat Metric</button></div>
    <div class="list">
      ${D.stats.map((s,i)=>`
        <div class="item-row">
          <div class="stat" style="font-size:22px">${esc(s.number)}</div>
          <div><div class="title">${esc(s.label)}</div></div>
          <div class="actions">
            <button class="small-btn" onclick="editSimple('stats',${i})">Edit</button>
            <button class="danger" onclick="delItem('stats',${i})">Delete</button>
          </div>
        </div>
      `).join('')||'<div class="empty">No stats.</div>'}
    </div>
  `;
}

function renderPackages(){
  $('#packages').innerHTML=`
    <div class="toolbar">
      <button class="primary" onclick="editPackage(-1)">+ Add Tour Package</button>
    </div>
    <div class="list">
      ${D.packages.map((p,i)=>`
        <div class="item-row">
          <img src="${esc(p.image)}" alt="" onerror="this.src='img/country-1.jpg'">
          <div>
            <div class="title">${esc(p.name)}</div>
            <div class="muted">${esc(p.category)} · ${esc(p.duration)} · Solo: ${esc(p.solo)}</div>
          </div>
          <div class="actions">
            <button class="small-btn" onclick="editPackage(${i})">Edit</button>
            <button class="danger" onclick="delItem('packages',${i})">Delete</button>
          </div>
        </div>
      `).join('')||'<div class="empty">No packages.</div>'}
    </div>
  `;
}

function renderDestinations(){
  $('#destinations').innerHTML=`
    <div class="toolbar"><button class="primary" onclick="editSimple('destinations',-1)">+ Add Destination</button></div>
    <div class="list">
      ${D.destinations.map((d,i)=>`
        <div class="item-row">
          <img src="${esc(d.image)}" alt="" onerror="this.src='img/country-1.jpg'">
          <div>
            <div class="title">${esc(d.icon)} ${esc(d.name)}</div>
            <div class="muted">${esc(d.text?.slice(0,80))}…</div>
          </div>
          <div class="actions">
            <button class="small-btn" onclick="editSimple('destinations',${i})">Edit</button>
            <button class="danger" onclick="delItem('destinations',${i})">Delete</button>
          </div>
        </div>
      `).join('')||'<div class="empty">No destinations.</div>'}
    </div>
  `;
}

function renderHotels(){
  $('#hotels').innerHTML=`
    <div class="toolbar"><button class="primary" onclick="editHotel(-1)">+ Add Hotel / Stay</button></div>
    <div class="list">
      ${D.hotels.map((h,i)=>`
        <div class="item-row">
          <img src="${esc(h.image)}" alt="" onerror="this.src='img/office-1.jpg'">
          <div>
            <div class="title">${esc(h.name)}</div>
            <div class="muted">${esc(h.type||'Hotel')} · ${esc(h.location)} · Rating: ${esc(h.rating||'4.8')}</div>
          </div>
          <div class="actions">
            <button class="small-btn" onclick="editHotel(${i})">Edit</button>
            <button class="danger" onclick="delItem('hotels',${i})">Delete</button>
          </div>
        </div>
      `).join('')||'<div class="empty">No hotels added yet.</div>'}
    </div>
  `;
}

function renderServices(){
  $('#services').innerHTML=`
    <div class="toolbar"><button class="primary" onclick="editSimple('services',-1)">+ Add Service</button></div>
    <div class="list">
      ${D.services.map((s,i)=>`
        <div class="item-row">
          <div style="font-size:24px;text-align:center"><i class="${esc(s.icon)}"></i></div>
          <div>
            <div class="title">${esc(s.title)}</div>
            <div class="muted">${esc(s.text?.slice(0,80))}…</div>
          </div>
          <div class="actions">
            <button class="small-btn" onclick="editSimple('services',${i})">Edit</button>
            <button class="danger" onclick="delItem('services',${i})">Delete</button>
          </div>
        </div>
      `).join('')||'<div class="empty">No services.</div>'}
    </div>
  `;
}

function renderTeam(){
  $('#team').innerHTML=`
    <div class="toolbar"><button class="primary" onclick="editSimple('team',-1)">+ Add Team Member</button></div>
    <div class="list">
      ${D.team.map((t,i)=>`
        <div class="item-row">
          <img src="${esc(t.image)}" alt="" class="avatar-sm" onerror="this.src='assets/team/team-1.svg'">
          <div>
            <div class="title">${esc(t.name)}</div>
            <div class="muted">${esc(t.role)}</div>
          </div>
          <div class="actions">
            <button class="small-btn" onclick="editSimple('team',${i})">Edit</button>
            <button class="danger" onclick="delItem('team',${i})">Delete</button>
          </div>
        </div>
      `).join('')||'<div class="empty">No team members.</div>'}
    </div>
  `;
}

function renderReviews(){
  $('#reviews').innerHTML=`
    <div class="toolbar"><button class="primary" onclick="editSimple('reviews',-1)">+ Add Review</button></div>
    <div class="list">
      ${D.reviews.map((r,i)=>`
        <div class="item-row">
          <div style="font-size:20px;color:#e02454">★★★★★</div>
          <div>
            <div class="title">${esc(r.name)} <small class="muted">(${esc(r.role)})</small></div>
            <div class="muted">“${esc(r.text?.slice(0,90))}…”</div>
          </div>
          <div class="actions">
            <button class="small-btn" onclick="editSimple('reviews',${i})">Edit</button>
            <button class="danger" onclick="delItem('reviews',${i})">Delete</button>
          </div>
        </div>
      `).join('')||'<div class="empty">No reviews.</div>'}
    </div>
  `;
}

function renderBlogs(){
  $('#blogs').innerHTML=`
    <div class="toolbar"><button class="primary" onclick="editSimple('blogs',-1)">+ Add Blog / Travel Guide</button></div>
    <div class="list">
      ${D.blogs.map((b,i)=>`
        <div class="item-row">
          <img src="${esc(b.image)}" alt="" onerror="this.src='img/country-1.jpg'">
          <div>
            <div class="title">${esc(b.title)}</div>
            <div class="muted">${esc(b.category)} · ${esc(b.slug)}</div>
          </div>
          <div class="actions">
            <button class="small-btn" onclick="editSimple('blogs',${i})">Edit</button>
            <button class="danger" onclick="delItem('blogs',${i})">Delete</button>
          </div>
        </div>
      `).join('')||'<div class="empty">No blogs.</div>'}
    </div>
  `;
}

function renderFaqs(){
  $('#faqs').innerHTML=`
    <div class="toolbar"><button class="primary" onclick="editSimple('faqs',-1)">+ Add FAQ</button></div>
    <div class="list">
      ${D.faqs.map((f,i)=>`
        <div class="item-row">
          <div style="font-weight:800;color:#003a66">Q</div>
          <div>
            <div class="title">${esc(f.q)}</div>
            <div class="muted">${esc(f.a?.slice(0,90))}…</div>
          </div>
          <div class="actions">
            <button class="small-btn" onclick="editSimple('faqs',${i})">Edit</button>
            <button class="danger" onclick="delItem('faqs',${i})">Delete</button>
          </div>
        </div>
      `).join('')||'<div class="empty">No FAQs.</div>'}
    </div>
  `;
}

function renderSocials(){
  $('#socials').innerHTML=`
    <div class="toolbar"><button class="primary" onclick="editSimple('socials',-1)">+ Add Social Link</button></div>
    <div class="list">
      ${D.socials.map((s,i)=>`
        <div class="item-row">
          <div style="font-size:22px;text-align:center"><i class="${esc(s.icon)}"></i></div>
          <div>
            <div class="title">${esc(s.name)}</div>
            <div class="muted">${esc(s.url)}</div>
          </div>
          <div class="actions">
            <button class="small-btn" onclick="editSimple('socials',${i})">Edit</button>
            <button class="danger" onclick="delItem('socials',${i})">Delete</button>
          </div>
        </div>
      `).join('')||'<div class="empty">No social links.</div>'}
    </div>
  `;
}

function cleanCustomerPhone(phone) {
  if (!phone) return '';
  let digits = String(phone).replace(/[^0-9]/g, '');
  if (digits.startsWith('03') && digits.length === 11) {
    digits = '92' + digits.slice(1);
  }
  return digits;
}

async function renderBookings(){
  const r=await api('/bookings');
  bookingsCache=r.ok?r.data:(JSON.parse(localStorage.getItem('gbBookings')||'[]'));
  $('#bookings').innerHTML=`
    <div class="toolbar" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div class="tag">Total Bookings: ${bookingsCache.length}</div>
        <button class="small-btn" onclick="renderBookings()"><i class="fas fa-sync-alt"></i> Refresh</button>
      </div>
      <div style="color:#64748b;font-size:12px;">
        <i class="fab fa-whatsapp text-success"></i> Customer WhatsApp links are live for instant replies
      </div>
    </div>
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Date</th><th>Customer</th><th>Package</th><th>Persons / Plan</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${bookingsCache.map(b=>{
            const cPhone = cleanCustomerPhone(b.phone);
            const waText = encodeURIComponent(`Salam ${b.name || 'valued customer'}, this is GB Adventure regarding your tour booking request for ${b.packageName || b.package || 'our tour'}! How can we assist you with your trip?`);
            return `
            <tr>
              <td><small>${formatDate(b.createdAt)}</small></td>
              <td>
                <b>${esc(b.name)}</b><br>
                <small class="muted">
                  ${cPhone ? `<a href="https://wa.me/${cPhone}?text=${waText}" target="_blank" style="color:#087443;font-weight:700;text-decoration:none;"><i class="fab fa-whatsapp"></i> ${esc(b.phone)}</a>` : esc(b.phone)}
                </small>
                ${b.email ? `<br><small class="muted"><i class="fas fa-envelope"></i> ${esc(b.email)}</small>` : ''}
              </td>
              <td><b>${esc(b.packageName||b.package||'-')}</b></td>
              <td>${esc(b.travellers||'-')} persons<br><small class="muted">${esc(b.plan||'Standard')} · ${esc(b.days||'-')} days</small></td>
              <td>
                <select onchange="markBooking('${esc(b.id)}', this.value)" style="padding:4px 8px;border-radius:20px;font-size:11px;font-weight:700;border:1px solid #cbd5e1;cursor:pointer;">
                  <option value="New" ${b.status==='New'?'selected':''}>🔵 New</option>
                  <option value="Contacted" ${b.status==='Contacted'?'selected':''}>🟡 Contacted</option>
                  <option value="Confirmed" ${b.status==='Confirmed'?'selected':''}>🟢 Confirmed</option>
                  <option value="Cancelled" ${b.status==='Cancelled'?'selected':''}>🔴 Cancelled</option>
                </select>
              </td>
              <td>
                <button class="small-btn" onclick="viewBooking('${esc(b.id)}')"><i class="fas fa-eye"></i> View</button>
                ${cPhone ? `<a href="https://wa.me/${cPhone}?text=${waText}" target="_blank" class="small-btn" style="color:#087443;font-weight:700;text-decoration:none;"><i class="fab fa-whatsapp"></i> Chat</a>` : ''}
                <button class="danger" onclick="deleteBooking('${esc(b.id)}')"><i class="fas fa-trash-alt"></i></button>
              </td>
            </tr>
          `}).join('')||'<tr><td colspan="6" class="empty">No bookings found yet. Submitted customer bookings will appear here.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

function viewBooking(id){
  const b=bookingsCache.find(x=>x.id===id);
  if(!b) return;
  const cPhone = cleanCustomerPhone(b.phone);
  const waText = encodeURIComponent(`Salam ${b.name || 'valued customer'}, this is GB Adventure regarding your tour booking request for ${b.packageName || b.package || 'our tour'}!`);
  
  closeModal();
  const modalHtml = `
    <div id="editorModal" class="modal">
      <div class="modal-card" style="max-width:620px;">
        <div class="modal-head">
          <h2><i class="fas fa-calendar-check" style="color:#003a66"></i> Booking Details</h2>
          <button class="close" onclick="closeModal()">✕</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
          <div><label style="font-size:11px;color:#607086;text-transform:uppercase;font-weight:800;">Customer Name</label><div style="font-size:15px;font-weight:800;">${esc(b.name||'-')}</div></div>
          <div><label style="font-size:11px;color:#607086;text-transform:uppercase;font-weight:800;">Booking Received</label><div style="font-size:14px;">${formatDate(b.createdAt)}</div></div>
          <div><label style="font-size:11px;color:#607086;text-transform:uppercase;font-weight:800;">WhatsApp / Phone</label><div style="font-size:15px;font-weight:700;color:#087443;"><i class="fab fa-whatsapp"></i> ${esc(b.phone||'-')}</div></div>
          <div><label style="font-size:11px;color:#607086;text-transform:uppercase;font-weight:800;">Email Address</label><div style="font-size:14px;">${esc(b.email||'Not provided')}</div></div>
          <div><label style="font-size:11px;color:#607086;text-transform:uppercase;font-weight:800;">Tour Package</label><div style="font-size:15px;font-weight:800;color:#003a66;">${esc(b.packageName||b.package||'Custom Tour')}</div></div>
          <div><label style="font-size:11px;color:#607086;text-transform:uppercase;font-weight:800;">Travel Date</label><div style="font-size:14px;font-weight:700;">${esc(b.date||'Not specified')}</div></div>
          <div><label style="font-size:11px;color:#607086;text-transform:uppercase;font-weight:800;">Persons / Plan</label><div style="font-size:14px;">${esc(b.travellers||'-')} persons · ${esc(b.plan||'Standard')} (${esc(b.days||'-')} Days)</div></div>
          <div><label style="font-size:11px;color:#607086;text-transform:uppercase;font-weight:800;">Current Status</label><div><span class="status status-${String(b.status||'new').toLowerCase()}">${esc(b.status||'New')}</span></div></div>
        </div>
        
        <div style="background:#f8fafc;padding:12px 14px;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:18px;">
          <label style="font-size:11px;color:#607086;text-transform:uppercase;font-weight:800;display:block;margin-bottom:5px;">Customer Special Request / Message</label>
          <div style="font-size:13px;line-height:1.5;color:#334155;white-space:pre-wrap;">${esc(b.message || 'No special requests submitted.')}</div>
        </div>
        
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;border-top:1px solid #edf1f5;padding-top:14px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <label style="font-size:11px;font-weight:800;color:#607086;">Status:</label>
            <select onchange="markBooking('${esc(b.id)}', this.value); closeModal();" style="padding:5px 9px;border-radius:6px;border:1px solid #cbd5e1;font-weight:600;">
              <option value="New" ${b.status==='New'?'selected':''}>🔵 New</option>
              <option value="Contacted" ${b.status==='Contacted'?'selected':''}>🟡 Contacted</option>
              <option value="Confirmed" ${b.status==='Confirmed'?'selected':''}>🟢 Confirmed</option>
              <option value="Cancelled" ${b.status==='Cancelled'?'selected':''}>🔴 Cancelled</option>
            </select>
          </div>
          <div style="display:flex;gap:8px;">
            ${cPhone ? `<a href="https://wa.me/${cPhone}?text=${waText}" target="_blank" class="primary" style="background:#25D366;text-decoration:none;display:inline-flex;align-items:center;gap:6px;"><i class="fab fa-whatsapp"></i> Chat on WhatsApp</a>` : ''}
            <button class="secondary" onclick="closeModal()">Close</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function formatDate(v){
  if(!v) return '-';
  try{
    return new Date(v).toLocaleString('en-PK',{dateStyle:'medium',timeStyle:'short'});
  }catch{
    return v;
  }
}

function renderAdmins(){
  api('/users').then(r=>{
    const u=r.ok?r.data:[];
    $('#admins').innerHTML=`
      <div class="toolbar"><button class="primary" onclick="editUser(-1)">+ Add Admin / User</button></div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>User</th><th>Role</th><th>Status</th><th>Action</th></tr>
          </thead>
          <tbody>
            ${u.map((x,i)=>`
              <tr>
                <td><img class="avatar-xs" src="${esc(x.avatar||'assets/gb-adventure-logo.svg')}" alt="" onerror="this.src='assets/gb-adventure-logo.svg'"> <b>${esc(x.username)}</b><br><span class="muted">${esc(x.name||'')}</span></td>
                <td>${esc(x.role)}</td>
                <td>${x.active===false?'Disabled':'Active'}</td>
                <td>
                  <button class="small-btn" onclick="editUser(${i})">Edit</button>
                  <button class="danger" onclick="deleteUser('${esc(x.id)}')">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  });
}

function renderOwnership(){
  api('/users').then(r=>{
    const u=r.ok?r.data:[];
    $('#ownership').innerHTML=`
      <div class="card danger-zone">
        <h3>Website Ownership Transfer</h3>
        <p>Transfer the owner role to another administrator. The previous owner becomes an administrator.</p>
        <div class="field">
          <label>New owner</label>
          <select id="ownerSelect">
            ${u.filter(x=>x.role!=='owner').map(x=>`<option value="${esc(x.id)}">${esc(x.username)} — ${esc(x.name||x.role)}</option>`).join('')}
          </select>
        </div>
        <button class="danger" onclick="transferOwnership()">Transfer Ownership</button>
      </div>
    `;
  });
}

function renderBackup(){
  $('#backup').innerHTML=`
    <div class="grid-2">
      <div class="card">
        <h3>Export website data</h3>
        <p class="muted">Download a complete JSON backup of editable website content, packages, destinations, and settings.</p>
        <button class="primary" onclick="exportData()"><i class="fas fa-download"></i> Export JSON Backup</button>
      </div>
      <div class="card">
        <h3>Import website data</h3>
        <p class="muted">Restore an exported JSON backup file directly to the website.</p>
        <input id="importFile" type="file" accept="application/json" style="margin-bottom:10px">
        <button class="secondary" onclick="importData()"><i class="fas fa-upload"></i> Restore Backup</button>
      </div>
    </div>
  `;
}

function editHero(i){
  const x=i<0?{eyebrow:'',title:'',text:'',image:'',button:'Explore Packages'}:D.heroSlides[i];
  openForm('Hero Slide',x,async obj=>{
    if(i<0) D.heroSlides.push(obj);
    else D.heroSlides[i]=obj;
    await persist();
  });
}

function editPackage(i){
  const x=i<0?{
    id:'p'+Date.now(),name:'',category:'Adventure',solo:'Price on request',couple:'Price on request',
    duration:'',location:'',image:'',highlights:[],overview:'',itinerary:[],included:[],excluded:[],activities:[]
  }:D.packages[i];

  openForm('Package',x,async obj=>{
    obj.id=x.id||('p'+Date.now());
    ['highlights','itinerary','included','excluded','activities'].forEach(k=>{
      obj[k]=String(obj[k]??'').split('\n').map(s=>s.trim()).filter(Boolean);
    });
    if(i<0) D.packages.push(obj);
    else D.packages[i]=obj;
    await persist();
  });
}

function editHotel(i){
  const x=i<0?{id:'h'+Date.now(),name:'',type:'Hotel',location:'',image:'',map:'',website:'',rating:'4.8',description:''}:D.hotels[i];
  openForm('Hotel / Resort',x,async obj=>{
    obj.id=x.id||('h'+Date.now());
    if(i<0) D.hotels.push(obj);
    else D.hotels[i]=obj;
    await persist();
  });
}

const schemas={
  stats:['number','label'],
  destinations:['name','icon','image','text'],
  services:['icon','title','text'],
  team:['id','name','role','description','image','facebook','instagram','tiktok','whatsapp'],
  reviews:['name','role','text'],
  blogs:['id','title','category','excerpt','image','slug','content'],
  faqs:['q','a'],
  socials:['name','icon','url'],
  gallery:['id','title','category','location','image','caption']
};

function editSimple(type,i){
  let x=i<0?Object.fromEntries(schemas[type].map(k=>[k,k==='id'?type+Date.now():k==='icon'?'fas fa-mountain':''])):D[type][i];
  const typeTitle = type === 'team' ? 'Team Member' : (type.endsWith('s') ? type.slice(0,-1) : type);
  openForm(typeTitle,x,async obj=>{
    if(i<0) D[type].push(obj);
    else D[type][i]=obj;
    await persist();
  },schemas[type]);
}

function isImageKey(key){
  const l = String(key||'').toLowerCase();
  return ['image','avatar','photo','logo','cover','aboutimage','aboutimage2','favicon'].includes(l) || l.endsWith('image') || l.endsWith('photo');
}

function openForm(title,obj,onSave,keys){
  closeModal();
  const arr=keys||Object.keys(obj);
  const isReadOnly=title==='Booking Details';

  const html=`
    <div class="modal open" id="editorModal">
      <div class="modal-card">
        <div class="modal-head">
          <div>
            <div class="eyebrow">${isReadOnly?'Booking information':'Content editor'}</div>
            <h2>${esc(title)}</h2>
          </div>
          <button class="close" onclick="closeModal()" aria-label="Close">&times;</button>
        </div>
        <div class="grid-2">
          ${arr.map(k=>{
            const v=Array.isArray(obj[k])?obj[k].join('\n'):obj[k]??'';
            const area=['overview','description','text','excerpt','content','a','seoDescription','seoKeywords','message'].includes(k);
            const ro=isReadOnly?'readonly':'';

            // Drag & Drop Image Uploader widget for image keys
            if(!isReadOnly && isImageKey(k)){
              return imageField(k, k, v, 'Drag and drop an image file or enter URL', true);
            }

            return `<div class="field">
              <label>${esc(k)}</label>
              ${area
                ? `<textarea data-edit="${esc(k)}" ${ro}>${esc(v)}</textarea>`
                : `<input data-edit="${esc(k)}" value="${esc(v)}" ${ro}>`
              }
            </div>`;
          }).join('')}
        </div>
        <div class="actions" style="margin-top:16px">
          ${isReadOnly?'':'<button class="primary" id="modalSave"><i class="fas fa-check"></i> Save</button>'}
          <button class="secondary" onclick="closeModal()">Close</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend',html);
  const modalEl = $('#editorModal');
  initImageDropzones(modalEl);

  if(!isReadOnly){
    const saveBtn = modalEl.querySelector('#modalSave');
    if(saveBtn){
      saveBtn.onclick = async () => {
        saveBtn.disabled = true;
        const origHtml = saveBtn.innerHTML;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        const o = {...obj};
        arr.forEach(k => {
          const el = modalEl.querySelector(`input[data-edit="${k}"], textarea[data-edit="${k}"], select[data-edit="${k}"]`);
          if(el) o[k] = el.value;
        });
        try {
          if(typeof onSave === 'function'){
            await onSave(o);
          }
          closeModal();
          renderSection(currentSection);
        } catch(err) {
          console.error('Save error:', err);
          saveBtn.disabled = false;
          saveBtn.innerHTML = origHtml;
          showToast('Failed to save changes.', 'warn');
        }
      };
    }
  }
}

function closeModal(){
  $('#editorModal')?.remove();
}

function delItem(type,i){
  if(confirm('Delete this item?')){
    D[type].splice(i,1);
    persist();
  }
}

async function persist(){
  showToast('Saving changes to live website...', 'ok');

  const r = await api('/site', {
    method: 'POST',
    body: JSON.stringify(D)
  });

  if (r.ok) {
    try {
      localStorage.setItem('gbAdventureSiteDataV2', JSON.stringify(D));
    } catch(e) {
      console.warn('LocalStorage save failed:', e);
    }
    showToast('Saved & live on website!', 'ok');
    renderSection(currentSection);
    return true;
  } else if (r.status === 401) {
    showToast('Session expired. Please log in again to save.', 'warn');
    showLogin();
    return false;
  } else {
    showToast('Could not save to backend (' + (r.data?.error || `HTTP ${r.status}`) + '). Please try again.', 'warn');
    return false;
  }
}

function showToast(msg,type='ok'){
  let t=$('#adminToast');
  if(!t){
    document.body.insertAdjacentHTML('beforeend','<div id="adminToast" class="admin-toast"></div>');
    t=$('#adminToast');
  }
  t.textContent=msg;
  t.className='admin-toast '+type;
  t.classList.add('show');
  clearTimeout(window.__toast);
  window.__toast=setTimeout(()=>t.classList.remove('show'),2800);
}

function editUser(i){
  api('/users').then(r=>{
    const u=r.ok?r.data:[];
    const x=i<0?{username:'',name:'',role:'admin',active:true,password:'',avatar:'',icon:''}:u[i];
    const keys=['username','name','role','active','password','avatar','icon'];
    openForm('Admin User',x,obj=>saveUser(obj,x.id),keys);
  });
}

async function saveUser(obj,id){
  const r=await api(id?'/users/'+encodeURIComponent(id):'/users',{
    method:id?'PUT':'POST',
    body:JSON.stringify(obj)
  });
  showToast(r.ok?'User saved.':(r.data.error||'User save failed'),r.ok?'ok':'warn');
  renderSection('admins');
}

async function deleteUser(id){
  if(confirm('Delete this user?')){
    const r=await api('/users/'+encodeURIComponent(id),{method:'DELETE'});
    showToast(r.ok?'User deleted.':(r.data.error||'Delete failed'),r.ok?'ok':'warn');
    renderSection('admins');
  }
}

async function transferOwnership(){
  const id=$('#ownerSelect').value;
  if(!id||!confirm('Transfer website ownership to this administrator?')) return;
  const r=await api('/ownership',{method:'POST',body:JSON.stringify({userId:id})});
  showToast(r.ok?'Ownership transferred.':(r.data.error||'Transfer failed'),r.ok?'ok':'warn');
  renderSection('ownership');
  renderSection('admins');
}

async function markBooking(id,status){
  const r=await api('/bookings/'+encodeURIComponent(id),{method:'PUT',body:JSON.stringify({status})});
  showToast(r.ok?'Booking updated.':(r.data.error||'Update failed'),r.ok?'ok':'warn');
  await renderBookings();
  await refreshAnalytics();
}

async function deleteBooking(id){
  if(!confirm('Delete booking?')) return;
  const r=await api('/bookings/'+encodeURIComponent(id),{method:'DELETE'});
  showToast(r.ok?'Booking deleted.':(r.data.error||'Delete failed'),r.ok?'ok':'warn');
  await renderBookings();
  await refreshAnalytics();
}

function exportData(){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(D,null,2)],{type:'application/json'}));
  a.download='gb-adventure-site-backup.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function importData(){
  const f=$('#importFile').files[0];
  if(!f) return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      D=JSON.parse(r.result);
      persist();
      showToast('Data imported successfully!', 'ok');
    }catch(e){
      showToast('Invalid JSON backup file', 'warn');
    }
  };
  r.readAsText(f);
}

$('#loginForm').onsubmit=async e=>{
  e.preventDefault();
  const status=$('#loginStatus'),button=$('#loginButton');
  const username=$('#loginUser').value.trim(),password=$('#loginPass').value;
  if(!username||!password){
    status.className='login-error';
    status.textContent='Username and password are required.';
    return;
  }
  button.disabled=true;
  status.className='';
  status.textContent='Signing in…';
  const r=await api('/login',{method:'POST',body:JSON.stringify({username,password})});
  button.disabled=false;
  if(r.ok){
    if(r.data?.token){
      localStorage.setItem('gb_admin_token', r.data.token);
    }
    status.className='login-ok';
    status.textContent='Signed in. Loading dashboard…';
    showApp();
    await loadData();
  } else {
    status.className='login-error';
    status.textContent=(r.data&&r.data.error)||(`Login failed (HTTP ${r.status||'network'})`);
  }
};

$('#logoutBtn').onclick=async()=>{
  await api('/logout',{method:'POST'});
  localStorage.removeItem('gb_admin_token');
  if(analyticsTimer) clearInterval(analyticsTimer);
  showLogin();
};

$('#saveBtn').onclick=async()=>{
  if(currentSection==='settings'){
    await saveSettings();
  } else {
    await persist();
  }
};

window.addEventListener('keydown',e=>{
  if(e.key==='Escape') closeModal();
});

function initAdmin(){
  boot().then(()=>{
    analyticsTimer=setInterval(()=>{
      if(currentSection==='dashboard'&&$('#appView')&&!$('#appView').hidden){
        refreshAnalytics();
      }
    },10000);
  });
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initAdmin);
} else {
  initAdmin();
}


function renderGallery() {
  D.gallery = D.gallery || [];
  $('#gallery').innerHTML = `
    <div class="toolbar">
      <button class="primary" onclick="editGalleryPhoto(-1)"><i class="fas fa-plus me-1"></i> Add Gallery Photo</button>
      <div class="hint ms-auto text-muted small">The first 3 photos form the front page collage (Top Left, Bottom Left, Center Featured).</div>
    </div>
    <div class="list">
      ${D.gallery.map((g, i) => `
        <div class="item-row" style="display:flex;align-items:center;gap:16px;padding:12px;border-bottom:1px solid #edf2f7;">
          <div style="width:75px;height:55px;border-radius:8px;overflow:hidden;background:#1a202c;flex-shrink:0;">
            <img src="${esc(g.image)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.src='img/country-1.jpg'">
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:15px;color:#2d3748;">
              ${i === 0 ? '<span class="badge" style="background:#E02454;color:#fff;font-size:10px;padding:2px 6px;border-radius:4px;margin-right:6px;">TOP LEFT</span>' : ''}
              ${i === 1 ? '<span class="badge" style="background:#E02454;color:#fff;font-size:10px;padding:2px 6px;border-radius:4px;margin-right:6px;">BOTTOM LEFT</span>' : ''}
              ${i === 2 ? '<span class="badge" style="background:#ff9900;color:#000;font-size:10px;padding:2px 6px;border-radius:4px;margin-right:6px;">CENTER HERO</span>' : ''}
              ${esc(g.title)}
            </div>
            <div style="font-size:12px;color:#718096;margin-top:2px;">
              <span style="background:#e2e8f0;padding:2px 8px;border-radius:4px;font-weight:600;">${esc(g.category || 'General')}</span>
              <span style="margin-left:8px;"><i class="fas fa-map-marker-alt"></i> ${esc(g.location || '')}</span>
            </div>
          </div>
          <div style="display:flex;gap:6px;">
            ${i > 0 ? `<button class="sm" onclick="moveGalleryPhoto(${i},-1)" title="Move up"><i class="fas fa-arrow-up"></i></button>` : ''}
            ${i < D.gallery.length - 1 ? `<button class="sm" onclick="moveGalleryPhoto(${i},1)" title="Move down"><i class="fas fa-arrow-down"></i></button>` : ''}
            <button class="sm" onclick="editGalleryPhoto(${i})"><i class="fas fa-edit"></i> Edit</button>
            <button class="sm danger" onclick="deleteGalleryPhoto(${i})"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `).join('') || '<div class="empty">No gallery photos added yet.</div>'}
    </div>
  `;
}

function moveGalleryPhoto(index, dir) {
  const target = index + dir;
  if (target < 0 || target >= D.gallery.length) return;
  const temp = D.gallery[index];
  D.gallery[index] = D.gallery[target];
  D.gallery[target] = temp;
  renderGallery();
}

function deleteGalleryPhoto(index) {
  if (!confirm('Are you sure you want to delete this photo from the gallery?')) return;
  D.gallery.splice(index, 1);
  renderGallery();
}

function editGalleryPhoto(index) {
  const isNew = index < 0;
  const item = isNew
    ? { id: 'g' + Date.now(), title: '', category: '4x4 Jeeps & Cars', location: '', image: '', caption: '' }
    : D.gallery[index];
  openForm('Gallery Photo', item, async obj => {
    obj.id = item.id || ('g' + Date.now());
    if (!obj.title || !obj.image) {
      showToast('Please provide both a Title and an Image.', 'warn');
      return;
    }
    if (isNew) D.gallery.push(obj);
    else D.gallery[index] = obj;
    await persist();
    renderGallery();
  }, schemas.gallery);
}
window.editGalleryPhoto = editGalleryPhoto;
window.moveGalleryPhoto = moveGalleryPhoto;
window.deleteGalleryPhoto = deleteGalleryPhoto;
