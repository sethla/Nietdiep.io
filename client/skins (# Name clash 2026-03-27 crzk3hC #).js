// Skins system - manages player skins
const AVAILABLE_SKINS = [
  { id: 'default', name: 'Default', path: null, price: 0 },
  { id: 'tank1', name: 'Wietse', path: '/public/skins/wietse.png', price: 50 },
  { id: 'tank2', name: 'ja', path: '/public/skins/ja.png', price: 2 },
  { id: 'custom', name: 'Custom Tank', path: null, price: 200, isCustom: true },
];

let loadedSkinImages = {};
let selectedSkin = localStorage.getItem('selectedSkin') || 'default';
let purchasedSkins = new Set(['default']); // Always have default
let customSkinUrl = null; // Store custom skin URL
let playerCoins = 0;
let onCoinsChanged = null; // Callback when coins change

// Code redemption system
const validCodes = {
  'FREECOINS50': 50,
  'BOOST100': 100,
  'VIP200': 200,
};
let usedCodes = new Set();

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
        loadedSkinImages[skin.id] = img;
        console.log(`✅ Loaded skin: ${skin.name}`);
      } catch (err) {
        console.warn(`⚠️ Failed to load skin ${skin.name}:`, err);
      }
    }
  }
}

function getSkinImage(skinId) {
  return loadedSkinImages[skinId] || null;
}

function setSkin(skinId) {
  if (AVAILABLE_SKINS.find(s => s.id === skinId)) {
    selectedSkin = skinId;
    localStorage.setItem('selectedSkin', skinId);
    return true;
  }
  return false;
}

function getSelectedSkin() {
  return selectedSkin;
}

function createShopPage() {
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
      <div style="padding: 20px; border-bottom: 2px solid rgba(255,255,255,0.2);">
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
      <div style="padding: 30px; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px; flex: 1;">
  `;

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
      <input type="url" id="urlInput" placeholder="https://example.com/tank.png" style="
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
          width: 150px;
          height: 150px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          margin: 0 auto 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        ">
          ${skin.isCustom && customSkinUrl ?
            `<img src="${customSkinUrl}" style="width: 140px; height: 140px; object-fit: contain;">` :
            (skin.path ? `<img src="${skin.path}" style="width: 140px; height: 140px; object-fit: contain;">` :
            `<div style="width: 120px; height: 120px; border-radius: 50%; background: #4caf50;"></div>`)
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

    <div style="padding: 20px; text-align: center; border-top: 2px solid rgba(255,255,255,0.2);">
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

  // Add event listeners to skin cards within this shop
  shop.querySelectorAll('.skinCard').forEach(card => {
    const skinId = card.dataset.skinId;
    const skin = AVAILABLE_SKINS.find(s => s.id === skinId);
    const isPurchased = purchasedSkins.has(skinId);

    card.addEventListener('click', () => {
      if (isPurchased) {
        setSkin(skinId);
      } else if (playerCoins >= skin.price) {
        buySkin(skinId);
      }
      // Refresh shop UI
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

  const shopPage = createShopPage();
  document.body.appendChild(shopPage);
  console.log("✅ shop opened");
}

function closeShop() {
  const shop = document.getElementById('shopPage');
  if (shop) shop.remove();
}

function refreshShop() {
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

  if (purchasedSkins.has(skinId)) {
    // Already purchased
    setSkin(skinId);
    return true;
  }

  if (playerCoins >= skin.price) {
    playerCoins -= skin.price;
    purchasedSkins.add(skinId);
    setSkin(skinId);

    const display = document.getElementById('coinDisplay');
    if (display) {
      display.textContent = playerCoins;
    }

    return true;
  }

  return false;
}

export { loadSkins, getSkinImage, setSkin, getSelectedSkin, AVAILABLE_SKINS, createShopPage, updateCoins, buySkin, openShop, closeShop, refreshShop };
