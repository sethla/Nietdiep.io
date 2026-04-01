// Skins system - manages player skins
const AVAILABLE_SKINS = [
  { id: 'default', name: 'Default', path: null, price: 0 },
  { id: 'tank1', name: 'Wietse', path: '/public/skins/wietse.png', price: 50 },
  { id: 'tank2', name: 'ja', path: '/public/skins/ja.png', price: 2 },
  { id: 'custom', name: 'Custom Tank', path: null, price: 200, isCustom: true },
];

let loadedSkinImages = {};
let selectedSkin = localStorage.getItem('selectedSkin') || 'default';

// Hidden container: images must live in the DOM so browsers animate GIF frames
let _skinDomContainer = null;
function getSkinDomContainer() {
  if (!_skinDomContainer) {
    _skinDomContainer = document.createElement('div');
    _skinDomContainer.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;overflow:hidden;pointer-events:none;';
    document.body.appendChild(_skinDomContainer);
  }
  return _skinDomContainer;
}
let purchasedSkins = new Set(['default']);
let customSkinUrl = localStorage.getItem('customSkinUrl') || null;
let playerCoins = 0;
let onCoinsChanged = null;
let onSkinChanged = null;
const customSkinCache = {};
const customSkinLoading = new Set();

if (customSkinUrl) {
  purchasedSkins.add('custom');
}

// Code redemption system
const validCodes = {
  'FREECOINS50': 50,
  'BOOST100': 100,
  'VIP200': 200,
};
let usedCodes = new Set();

const SUPPORTED_CUSTOM_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'];

function isSupportedCustomSkinUrl(url) {
  if (!url || typeof url !== 'string') return false;

  if (url.startsWith('data:image/')) {
    return true;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

    const path = parsed.pathname.toLowerCase();
    const ext = path.includes('.') ? path.split('.').pop() : '';
    return SUPPORTED_CUSTOM_EXTENSIONS.includes(ext);
  } catch {
    return false;
  }
}

async function preloadCustomSkin(url) {
  if (!url) return null;
  if (customSkinCache[url]) return customSkinCache[url];

  let img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;

  try {
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
  } catch {
    // CORS failed — retry without crossOrigin (canvas taint is OK; we never read pixels)
    img = new Image();
    img.src = url;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
  }

  getSkinDomContainer().appendChild(img);
  customSkinCache[url] = img;
  return img;
}

// Load all available skins
async function loadSkins() {
  for (const skin of AVAILABLE_SKINS) {
    if (skin.path) {
      try {
        const img = new Image();
        img.src = skin.path;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
        getSkinDomContainer().appendChild(img);
        loadedSkinImages[skin.id] = img;
        console.log(`✅ Loaded skin: ${skin.name}`);
      } catch (err) {
        console.warn(`⚠️ Failed to load skin ${skin.name}:`, err);
      }
    }
  }
}

function getSkinImage(skinId, playerCustomSkinUrl = null) {
  if (skinId === 'custom') {
    const resolvedCustomUrl = playerCustomSkinUrl || customSkinUrl;
    if (!resolvedCustomUrl) return null;

    if (!customSkinCache[resolvedCustomUrl] && !customSkinLoading.has(resolvedCustomUrl)) {
      customSkinLoading.add(resolvedCustomUrl);
      preloadCustomSkin(resolvedCustomUrl)
        .catch(() => {
          // keep silent to avoid noisy logs when third-party URLs fail
        })
        .finally(() => {
          customSkinLoading.delete(resolvedCustomUrl);
        });
    }

    return customSkinCache[resolvedCustomUrl] || null;
  }

  return loadedSkinImages[skinId] || null;
}

// Offscreen canvas cache: one 128x128 canvas per unique skin, updated once per frame.
// This avoids running ctx.clip() on the main canvas for every player every frame —
// instead we composite the GIF frame into a circular offscreen once, then do a fast
// canvas-to-canvas drawImage for each player that uses it.
const skinCanvasCache = {};

function getSkinCanvas(skinId, playerCustomSkinUrl = null) {
  const img = getSkinImage(skinId, playerCustomSkinUrl);
  if (!img) return null;

  const key = skinId === 'custom' ? (playerCustomSkinUrl || 'custom') : skinId;
  const SIZE = 256;
  const now = performance.now();

  let entry = skinCanvasCache[key];
  if (!entry) {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    entry = { canvas, ctx: canvas.getContext('2d'), lastUpdated: -1 };
    skinCanvasCache[key] = entry;
  }

  // Only redraw once per ~16 ms so multiple players sharing a skin cost just 1 composite
  if (now - entry.lastUpdated >= 14) {
    const { canvas, ctx: offCtx } = entry;
    offCtx.clearRect(0, 0, SIZE, SIZE);
    offCtx.drawImage(img, 0, 0, SIZE, SIZE);
    // Clip to circle using destination-in (no ctx.clip needed on the main canvas)
    offCtx.globalCompositeOperation = 'destination-in';
    offCtx.beginPath();
    offCtx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
    offCtx.fill();
    offCtx.globalCompositeOperation = 'source-over';
    entry.lastUpdated = now;
  }

  return entry.canvas;
}

function setSkin(skinId) {
  if (AVAILABLE_SKINS.find(s => s.id === skinId)) {
    selectedSkin = skinId;
    localStorage.setItem('selectedSkin', skinId);

    if (onSkinChanged) {
      onSkinChanged({
        skin: selectedSkin,
        customSkinUrl
      });
    }

    return true;
  }
  return false;
}

function getSelectedSkin() {
  return selectedSkin;
}

function getCustomSkinUrl() {
  return customSkinUrl;
}

function setSkinChangedHandler(handler) {
  onSkinChanged = typeof handler === 'function' ? handler : null;
}

function redeemCode(code) {
  if (usedCodes.has(code)) {
    return { success: false, message: 'Code already used' };
  }
  if (!validCodes[code]) {
    return { success: false, message: 'Invalid code' };
  }
  const coinsGained = validCodes[code];
  playerCoins += coinsGained;
  usedCodes.add(code);
  return { success: true, message: `+${coinsGained} coins!` };
}

function createShopPage() {
  console.log("📖 Creating shop page - customSkinUrl:", customSkinUrl, "purchasedSkins:", Array.from(purchasedSkins));
  const shop = document.createElement('div');
  shop.id = 'shopPage';
  shop.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
    z-index: 99;
    display: flex;
    flex-direction: column;
    color: #fff;
    font-family: sans-serif;
    overflow: hidden;
  `;

  let html = `
    <div style="padding: 30px; text-align: center; border-bottom: 2px solid rgba(255,255,255,0.2); flex-shrink: 0;">
      <h1 style="margin: 0 0 10px 0;">🛍️ SKIN SHOP</h1>
      <div style="font-size: 24px; color: #ffd700;">💰 Coins: <span id="shopCoinDisplay">${playerCoins}</span></div>
    </div>

    <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column;">
      <!-- Code Redemption Section -->
      <div style="padding: 20px; border-bottom: 2px solid rgba(255,255,255,0.2); flex-shrink: 0;">
        <h3 style="margin: 0 0 15px 0; color: #ffeb3b;">🔑 REDEEM CODE</h3>
        <div style="display: flex; gap: 10px;">
          <input type="text" id="codeInput" placeholder="Enter code..." maxlength="20" style="
            flex: 1;
            padding: 10px;
            border: 1px solid rgba(255,255,255,0.3);
            border-radius: 8px;
            background: rgba(255,255,255,0.1);
            color: #fff;
            font-size: 14px;
          ">
          <button id="redeemBtn" style="
            padding: 10px 20px;
            background: #ffeb3b;
            color: #000;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
            transition: all 0.2s;
          ">Redeem</button>
        </div>
        <div id="codeMessage" style="margin-top: 10px; font-size: 12px; color: #ff9800;"></div>
      </div>

      <!-- Skins Grid -->
      <div style="padding: 30px; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px; flex: 1; overflow-y: auto;">
  `;

  AVAILABLE_SKINS.forEach(skin => {
    const isSelected = skin.id === selectedSkin;
    const isPurchased = purchasedSkins.has(skin.id);
    const canAfford = playerCoins >= skin.price;

    let statusText = '';
    let statusColor = '';

    if (isSelected) {
      statusText = '✓ EQUIPPED';
      statusColor = '#4caf50';
    } else if (isPurchased) {
      statusText = 'OWNED';
      statusColor = '#2196F3';
    } else if (canAfford) {
      statusText = `BUY - ${skin.price}💰`;
      statusColor = '#ff9800';
    } else {
      statusText = `${skin.price - playerCoins} MORE 💰`;
      statusColor = '#999';
    }

    html += `
      <div style="
        background: rgba(0, 0, 0, 0.5);
        border: 2px solid ${statusColor};
        border-radius: 10px;
        padding: 20px;
        text-align: center;
        cursor: ${isPurchased || canAfford ? 'pointer' : 'not-allowed'};
        transition: transform 0.2s, box-shadow 0.2s;
        opacity: ${canAfford || isPurchased || isSelected ? 1 : 0.6};
      " class="skinCard" data-skin-id="${skin.id}">
        <div style="
          width: 128px;
          height: 128px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 50%;
          margin: 0 auto 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        " class="skinPreview" data-skin-id="${skin.id}">
          ${skin.isCustom && customSkinUrl ?
            `<img src="${customSkinUrl}" style="width: 128px; height: 128px; object-fit: cover;" class="customImage">` :
            (skin.path ? `<img src="${skin.path}" style="width: 128px; height: 128px; object-fit: cover;">` :
            `<div style="width: 128px; height: 128px; border-radius: 50%; background: #4caf50;"></div>`)
          }
        </div>

        <h3 style="margin: 10px 0; font-size: 18px;">${skin.name}</h3>
        <div style="
          padding: 10px;
          background: ${statusColor}33;
          border: 1px solid ${statusColor};
          border-radius: 5px;
          font-weight: bold;
          color: ${statusColor};
          margin-top: 10px;
        ">${statusText}</div>
      </div>
    `;
  });

  html += `
      </div>
    </div>

    <div style="padding: 20px; text-align: center; border-top: 2px solid rgba(255,255,255,0.2); flex-shrink: 0;">
      <button id="closeShopBtn" style="
        padding: 15px 40px;
        background: #4caf50;
        color: white;
        border: none;
        border-radius: 25px;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        transition: background 0.2s;
      ">CLOSE SHOP</button>
    </div>
  `;

  shop.innerHTML = html;

  // Helper function to create URL input modal
  const createUrlInputModal = () => {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      z-index: 200;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const form = document.createElement('div');
    form.style.cssText = `
      background: rgba(0, 0, 0, 0.9);
      border: 2px solid rgba(255,255,255,0.3);
      border-radius: 15px;
      padding: 30px;
      width: 90%;
      max-width: 500px;
    `;

    form.innerHTML = `
      <h2 style="color: #fff; margin: 0 0 20px 0;">Enter Custom Tank Image URL</h2>
      <input type="url" id="urlInput" placeholder="https://example.com/tank.gif" style="
        width: 100%;
        padding: 12px;
        border: 1px solid rgba(255,255,255,0.3);
        border-radius: 8px;
        background: rgba(255,255,255,0.1);
        color: #fff;
        font-size: 14px;
        box-sizing: border-box;
        margin-bottom: 15px;
      ">
      <p style="margin: 0 0 12px 0; color: #ccc; font-size: 12px;">Supports PNG, JPG, GIF, WEBP, SVG and AVIF.</p>
      <div style="display: flex; gap: 10px;">
        <button id="confirmUrlBtn" style="
          flex: 1;
          padding: 12px;
          background: #4caf50;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: bold;
        ">Confirm</button>
        <button id="cancelUrlBtn" style="
          flex: 1;
          padding: 12px;
          background: #f44336;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: bold;
        ">Cancel</button>
      </div>
    `;

    modal.appendChild(form);
    return modal;
  };

  // Handle custom image loading
  const customImage = shop.querySelector('.customImage');
  if (customImage) {
    console.log("🎨 Custom image element found, URL:", customSkinUrl);

    customImage.onload = () => {
      console.log("✅ Custom image loaded successfully:", customSkinUrl);
    };

    customImage.onerror = () => {
      console.error("❌ Failed to load custom image:", customSkinUrl);
      // Fallback: show orange circle with text
      const preview = shop.querySelector('.skinPreview[data-skin-id="custom"]');
      if (preview) {
        preview.innerHTML = `<div style="width: 120px; height: 120px; border-radius: 50%; background: #ff9800; display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; text-align: center; font-weight: bold;">Image<br>Failed</div>`;
      }
    };
  }

  // Add event listeners to skin cards within this shop
  shop.querySelectorAll('.skinCard').forEach(card => {
    const skinId = card.dataset.skinId;
    const skin = AVAILABLE_SKINS.find(s => s.id === skinId);
    const isPurchased = purchasedSkins.has(skinId);

    card.addEventListener('click', () => {
      // Handle custom tank purchase
      if (skinId === 'custom') {
        console.log("Custom tank clicked - isPurchased:", isPurchased, "canAfford:", playerCoins >= skin.price);
        if (!isPurchased && playerCoins >= skin.price) {
          console.log("Opening URL input modal");
          const modal = createUrlInputModal();
          document.body.appendChild(modal);

          const confirmBtn = modal.querySelector('#confirmUrlBtn');
          const cancelBtn = modal.querySelector('#cancelUrlBtn');
          const urlInput = modal.querySelector('#urlInput');

          confirmBtn.onclick = async () => {
            const url = urlInput.value.trim();
            if (!isSupportedCustomSkinUrl(url)) {
              alert('Enter a valid image URL (png, jpg, gif, webp, svg, avif or data:image/*)');
              return;
            }

            try {
              await preloadCustomSkin(url);
              console.log("🎨 Setting custom skin URL:", url);
              customSkinUrl = url;
              localStorage.setItem('customSkinUrl', customSkinUrl);
              buySkin(skinId);
              modal.remove();
              refreshShop();
            } catch (error) {
              console.error('❌ Failed to load custom skin URL:', error);
              alert('Image could not be loaded from that URL. Try another link.');
            }
          };

          cancelBtn.onclick = () => {
            console.log("URL input cancelled");
            modal.remove();
          };

          urlInput.focus();
        } else if (isPurchased) {
          console.log("Opening change-URL modal for custom tank");
          const modal = createUrlInputModal();
          document.body.appendChild(modal);

          const confirmBtn = modal.querySelector('#confirmUrlBtn');
          const cancelBtn = modal.querySelector('#cancelUrlBtn');
          const urlInput = modal.querySelector('#urlInput');

          modal.querySelector('h2').textContent = 'Change Custom Tank Image';
          confirmBtn.textContent = 'Change';
          cancelBtn.textContent = 'Just equip';
          cancelBtn.style.background = '#2196F3';

          if (customSkinUrl) urlInput.value = customSkinUrl;

          confirmBtn.onclick = async () => {
            const url = urlInput.value.trim();
            if (!isSupportedCustomSkinUrl(url)) {
              alert('Enter a valid image URL (png, jpg, gif, webp, svg, avif or data:image/*)');
              return;
            }
            try {
              // Invalidate cache for new URL so a fresh image is loaded
              delete customSkinCache[url];
              await preloadCustomSkin(url);
              customSkinUrl = url;
              localStorage.setItem('customSkinUrl', customSkinUrl);
              setSkin(skinId);
              modal.remove();
              refreshShop();
            } catch (error) {
              console.error('\u274C Failed to load custom skin URL:', error);
              alert('Image could not be loaded from that URL. Try another link.');
            }
          };

          cancelBtn.onclick = () => {
            setSkin(skinId);
            modal.remove();
            refreshShop();
          };

          urlInput.focus();
        } else {
          console.log("Not enough coins for custom tank");
        }
        return;
      }

      if (isPurchased) {
        setSkin(skinId);
      } else if (playerCoins >= skin.price) {
        buySkin(skinId);
      }
      refreshShop();
    });

    card.addEventListener('mouseover', () => {
      if (playerCoins >= skin.price || isPurchased || skin.id === selectedSkin) {
        card.style.transform = 'scale(1.05)';
        card.style.boxShadow = `0 0 20px ${card.style.borderColor}`;
      }
    });

    card.addEventListener('mouseout', () => {
      card.style.transform = 'scale(1)';
      card.style.boxShadow = 'none';
    });
  });

  // Code redemption handler
  const codeInput = shop.querySelector('#codeInput');
  const redeemBtn = shop.querySelector('#redeemBtn');
  const codeMessage = shop.querySelector('#codeMessage');

  redeemBtn.addEventListener('click', () => {
    const code = codeInput.value.trim().toUpperCase();
    const result = redeemCode(code);
    if (result.success) {
      codeMessage.style.color = '#4caf50';
      codeMessage.textContent = `✅ ${result.message}`;
      codeInput.value = '';
      const display = shop.querySelector('#shopCoinDisplay');
      if (display) display.textContent = playerCoins;
      setTimeout(() => { codeMessage.textContent = ''; }, 3000);
    } else {
      codeMessage.style.color = '#f44336';
      codeMessage.textContent = `❌ ${result.message}`;
      setTimeout(() => { codeMessage.textContent = ''; }, 3000);
    }
  });

  codeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') redeemBtn.click();
  });

  shop.querySelector('#closeShopBtn').addEventListener('click', () => {
    closeShop();
  });

  return shop;
}

function openShop() {
  console.log("🛍️ opening shop...");
  const existing = document.getElementById('shopPage');
  if (existing) {
    console.log("removing existing shop");
    existing.remove();
  }

  // Hide menus
  const startMenu = document.getElementById('startMenu');
  const respawnMenu = document.getElementById('respawnMenu');
  if (startMenu) startMenu.style.display = 'none';
  if (respawnMenu) respawnMenu.style.display = 'none';

  const shopPage = createShopPage();
  document.body.appendChild(shopPage);
  console.log("✅ shop opened");
}

function closeShop() {
  const shop = document.getElementById('shopPage');
  if (shop) {
    shop.remove();
    // Show menus again
    const startMenu = document.getElementById('startMenu');
    const respawnMenu = document.getElementById('respawnMenu');
    if (startMenu && startMenu.classList.contains('show')) startMenu.style.display = 'block';
    if (respawnMenu && respawnMenu.classList.contains('show')) respawnMenu.style.display = 'block';
  }
}

function refreshShop() {
  console.log("🔄 Refreshing shop - customSkinUrl:", customSkinUrl, "selectedSkin:", selectedSkin);
  const shop = document.getElementById('shopPage');
  if (shop) {
    const newShop = createShopPage();
    shop.replaceWith(newShop);
  }
}

function updateCoins(newAmount) {
  playerCoins = newAmount;
  const display = document.getElementById('coinDisplay');
  if (display) {
    display.textContent = playerCoins;
  }
  if (onCoinsChanged) {
    onCoinsChanged(playerCoins);
  }
}

function buySkin(skinId) {
  const skin = AVAILABLE_SKINS.find(s => s.id === skinId);
  if (!skin) return false;

  console.log("💰 Buying skin:", skinId, "currentCoins:", playerCoins, "skinPrice:", skin.price);

  if (purchasedSkins.has(skinId)) {
    console.log("Already owned, equipping:", skinId);
    setSkin(skinId);
    return true;
  }

  if (playerCoins >= skin.price) {
    playerCoins -= skin.price;
    purchasedSkins.add(skinId);
    console.log("✅ Skin purchased! Remaining coins:", playerCoins, "purchasedSkins:", Array.from(purchasedSkins), "customSkinUrl:", customSkinUrl);
    setSkin(skinId);

    const display = document.getElementById('coinDisplay');
    if (display) {
      display.textContent = playerCoins;
    }

    return true;
  }

  console.log("❌ Not enough coins");
  return false;
}

async function initializeCustomSkinCache() {
  if (!customSkinUrl) return;

  try {
    await preloadCustomSkin(customSkinUrl);
  } catch (error) {
    console.warn('⚠️ Saved custom skin URL could not be loaded:', error);
    customSkinUrl = null;
    localStorage.removeItem('customSkinUrl');
  }
}

export { loadSkins, getSkinImage, getSkinCanvas, setSkin, getSelectedSkin, getCustomSkinUrl, setSkinChangedHandler, AVAILABLE_SKINS, createShopPage, updateCoins, buySkin, openShop, closeShop, refreshShop, redeemCode, initializeCustomSkinCache };
