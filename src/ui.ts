import { TreeParams } from './types';
import {
  getState, getLeaves, addLeaves as gameAddLeaves, spendLeaves,
  tickAutoLeaves, setPixelArtSetting, getUpgrades, getUpgradeCost,
  buyUpgrade, getMaxLeaves, getUpgradeLevel, applyUpgrades,
} from './game';

export type OnChange = (leafCount: number) => void;
export type OnRefresh = () => void;

export function createUI(
  onChange: OnChange,
  onRefresh: OnRefresh,
  getParams: () => TreeParams | null,
  onTogglePixel: (on: boolean) => void,
): { leafCount: number; onAddLeaves: (delta: number) => void } {
  applyUpgrades();
  let leafCount = getLeaves();

  const infoPanel = document.createElement('div');
  infoPanel.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    background: linear-gradient(180deg, rgba(15,12,8,0.92) 0%, rgba(15,12,8,0.7) 80%, transparent 100%);
    color: #b8a070;
    font: 11px/1.7 monospace; padding: 10px 18px 16px;
    user-select: none; touch-action: none;
    display: flex; flex-wrap: wrap; gap: 2px 18px;
    letter-spacing: 0.3px;
  `;
  document.body.appendChild(infoPanel);

  const bottomBar = document.createElement('div');
  bottomBar.style.cssText = `
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 100;
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    background: linear-gradient(0deg, rgba(15,12,8,0.95) 0%, rgba(15,12,8,0.8) 80%, transparent 100%);
    color: #ccc;
    font: 12px/1.5 monospace; padding: 12px 14px 10px;
    user-select: none; touch-action: none;
  `;
  document.body.appendChild(bottomBar);

  const shopPanel = document.createElement('div');
  shopPanel.style.cssText = `
    position: fixed; top: 50%; right: 10px; transform: translateY(-50%); z-index: 200;
    background: rgba(10,8,5,0.92); color: #b8a070;
    font: 11px/1.6 monospace; padding: 12px; border-radius: 8px;
    border: 1px solid rgba(212,160,23,0.2); width: 200px;
    backdrop-filter: blur(6px); user-select: none;
    max-height: 70vh; overflow-y: auto;
  `;
  document.body.appendChild(shopPanel);

  const shopToggle = document.createElement('button');
  shopToggle.textContent = 'Shop';
  shopToggle.style.cssText = `
    background: rgba(212,160,23,0.15); color: #d4a017;
    border: 1px solid rgba(212,160,23,0.3); border-radius: 4px;
    padding: 4px 12px; font: 12px/1.5 monospace; cursor: pointer;
  `;
  let shopOpen = false;
  shopPanel.style.display = 'none';
  shopToggle.addEventListener('click', () => {
    shopOpen = !shopOpen;
    shopPanel.style.display = shopOpen ? 'block' : 'none';
    updateShop();
  });

  const valueEl = document.createElement('span');
  valueEl.style.cssText = 'color: #d4a017; min-width: 40px; text-align: right; font-weight: bold; font-size: 14px;';
  valueEl.textContent = String(leafCount);

  const input = document.createElement('input');
  input.type = 'range';
  input.min = '0';
  input.max = String(getMaxLeaves());
  input.step = '100';
  input.value = String(leafCount);
  input.style.cssText = 'flex: 1; accent-color: #d4a017; min-width: 80px; max-width: 200px;';

  const refreshBtn = document.createElement('button');
  refreshBtn.textContent = '⟳ Refresh';
  const s = getState();
  if (!s.refreshUnlocked) {
    refreshBtn.style.cssText = `
      background: rgba(80,80,80,0.15); color: #666;
      border: 1px solid rgba(80,80,80,0.25); border-radius: 4px;
      padding: 4px 12px; font: 12px/1.5 monospace; cursor: not-allowed;
    `;
    refreshBtn.disabled = true;
  } else {
    refreshBtn.style.cssText = `
      background: rgba(212,160,23,0.12); color: #d4a017;
      border: 1px solid rgba(212,160,23,0.25); border-radius: 4px;
      padding: 4px 12px; font: 12px/1.5 monospace; cursor: pointer;
    `;
  }

  const pixelLabel = document.createElement('label');
  pixelLabel.style.cssText = 'display: inline-flex; align-items: center; gap: 4px; cursor: pointer; color: #999; font: 11px/1.5 monospace; flex-shrink: 0;';

  const pixelCheckbox = document.createElement('input');
  pixelCheckbox.type = 'checkbox';
  pixelCheckbox.checked = getState().pixelArt;
  pixelCheckbox.style.cssText = 'accent-color: #d4a017; cursor: pointer; width: 14px; height: 14px;';

  const pixelText = document.createElement('span');
  pixelText.textContent = 'Px';

  pixelLabel.appendChild(pixelCheckbox);
  pixelLabel.appendChild(pixelText);

  pixelCheckbox.addEventListener('change', () => {
    setPixelArtSetting(pixelCheckbox.checked);
    onTogglePixel(pixelCheckbox.checked);
  });

  function updateInfo() {
    const p = getParams();
    const st = getState();
    if (!p) return;
    infoPanel.innerHTML = [
      `<span style="color:#d4a017;font-weight:bold">seed: ${p.seed}</span>`,
      `trunk h: ${p.trunkHeight.toFixed(1)}`,
      `crown r: ${p.crownRadius.toFixed(1)}`,
      `depth: ${p.branchDepth}`,
      `relief: ${p.relief.toFixed(2)}`,
      `<span style="color:#d4a017">leaves: ${leafCount}</span>`,
      `<span style="color:#8a7050">click: +${st.clickPower}</span>`,
      st.autoLeavesPerSec > 0 ? `<span style="color:#8a7050">auto: ${st.autoLeavesPerSec}/s</span>` : '',
    ].filter(Boolean).map(s => `<span>${s}</span>`).join('');
  }

  function updateShop() {
    const st = getState();
    const upgrades = getUpgrades();
    let html = '<div style="color:#d4a017;font-weight:bold;margin-bottom:8px;text-align:center">SHOP</div>';
    html += `<div style="text-align:center;margin-bottom:8px;color:#d4a017;font-size:13px">${leafCount} leaves</div>`;

    for (const up of upgrades) {
      const level = getUpgradeLevel(up.id);
      const cost = getUpgradeCost(up);
      const maxed = level >= up.maxLevel;
      const canBuy = st.leaves >= cost && !maxed;

      html += `<div style="margin-bottom:8px;padding:6px;border-radius:4px;background:${canBuy ? 'rgba(212,160,23,0.1)' : 'rgba(40,35,25,0.3)'};border:1px solid ${canBuy ? 'rgba(212,160,23,0.3)' : 'rgba(60,50,35,0.2)'}">`;
      html += `<div style="display:flex;justify-content:space-between;align-items:center">`;
      html += `<span style="color:${maxed ? '#666' : '#d4a017'};font-weight:bold">${up.name}</span>`;
      html += `<span style="color:#888;font-size:10px">${level}/${up.maxLevel}</span>`;
      html += `</div>`;
      html += `<div style="color:#998;font-size:10px;margin:2px 0">${up.description}</div>`;
      html += `<div style="display:flex;justify-content:space-between;align-items:center">`;
      html += `<span style="color:${canBuy ? '#d4a017' : '#666'}">${maxed ? 'MAX' : cost + ' leaves'}</span>`;
      if (!maxed) {
        html += `<button data-upgrade="${up.id}" style="background:${canBuy ? 'rgba(212,160,23,0.2)' : 'rgba(40,35,25,0.2)'};color:${canBuy ? '#d4a017' : '#555'};border:1px solid ${canBuy ? 'rgba(212,160,23,0.3)' : 'rgba(60,50,35,0.2)'};border-radius:3px;padding:2px 8px;font:11px/1.3 monospace;cursor:${canBuy ? 'pointer' : 'not-allowed'}">Buy</button>`;
      }
      html += `</div></div>`;
    }

    shopPanel.innerHTML = html;

    shopPanel.querySelectorAll('button[data-upgrade]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-upgrade')!;
        const up = upgrades.find(u => u.id === id)!;
        if (buyUpgrade(up)) {
          refreshBtn.disabled = !getState().refreshUnlocked;
          if (getState().refreshUnlocked) {
            refreshBtn.style.cssText = `
              background: rgba(212,160,23,0.12); color: #d4a017;
              border: 1px solid rgba(212,160,23,0.25); border-radius: 4px;
              padding: 4px 12px; font: 12px/1.5 monospace; cursor: pointer;
            `;
          }
          updateShop();
          updateInfo();
        }
      });
    });
  }

  input.addEventListener('input', () => {
    leafCount = Math.round(Number(input.value));
    valueEl.textContent = String(leafCount);
    updateInfo();
    onChange(leafCount);
  });

  refreshBtn.addEventListener('click', () => {
    if (!getState().refreshUnlocked) return;
    onRefresh();
    updateInfo();
    onChange(leafCount);
  });

  bottomBar.appendChild(document.createElement('span')).textContent = '🍂';
  bottomBar.appendChild(input);
  bottomBar.appendChild(valueEl);
  bottomBar.appendChild(refreshBtn);
  bottomBar.appendChild(shopToggle);
  bottomBar.appendChild(pixelLabel);

  updateInfo();

  function onAddLeaves(delta: number) {
    const max = getMaxLeaves();
    const state = getState();
    const actual = delta * state.clickPower;
    leafCount = Math.min(max, leafCount + actual);
    gameAddLeaves(actual);
    input.max = String(max);
    input.value = String(leafCount);
    valueEl.textContent = String(leafCount);
    updateInfo();
    updateShop();
    onChange(leafCount);
  }

  setInterval(() => {
    const state = getState();
    if (state.autoLeavesPerSec > 0) {
      tickAutoLeaves(1);
      leafCount = getLeaves();
      input.max = String(getMaxLeaves());
      input.value = String(leafCount);
      valueEl.textContent = String(leafCount);
      updateInfo();
      updateShop();
      onChange(leafCount);
    }
  }, 1000);

  return { leafCount, onAddLeaves };
}
