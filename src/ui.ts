import { TreeParams } from './types';

export type OnChange = (leafCount: number) => void;
export type OnRefresh = () => void;

export function createUI(
  onChange: OnChange,
  onRefresh: OnRefresh,
  getParams: () => TreeParams | null,
): { leafCount: number } {
  let leafCount = 3000;

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
    display: flex; align-items: center; gap: 16px;
    background: linear-gradient(0deg, rgba(15,12,8,0.95) 0%, rgba(15,12,8,0.8) 80%, transparent 100%);
    color: #ccc;
    font: 13px/1.5 monospace; padding: 16px 20px 12px;
    user-select: none; touch-action: none;
  `;
  document.body.appendChild(bottomBar);

  const valueEl = document.createElement('span');
  valueEl.style.cssText = 'color: #d4a017; min-width: 50px; text-align: right; font-weight: bold;';
  valueEl.textContent = String(leafCount);

  const input = document.createElement('input');
  input.type = 'range';
  input.min = '500';
  input.max = '15000';
  input.step = '100';
  input.value = String(leafCount);
  input.style.cssText = 'flex: 1; accent-color: #d4a017; max-width: 300px;';

  const refreshBtn = document.createElement('button');
  refreshBtn.textContent = '⟳ Refresh';
  refreshBtn.style.cssText = `
    background: rgba(212,160,23,0.12); color: #d4a017;
    border: 1px solid rgba(212,160,23,0.25); border-radius: 4px;
    padding: 5px 16px; font: 13px/1.5 monospace; cursor: pointer;
    transition: background 0.15s;
  `;

  function updateInfo() {
    const p = getParams();
    if (!p) return;
    infoPanel.innerHTML = [
      `<span style="color:#d4a017;font-weight:bold">seed: ${p.seed}</span>`,
      `trunk h: ${p.trunkHeight.toFixed(2)}`,
      `trunk r: ${p.trunkRadius.toFixed(3)}`,
      `crown r: ${p.crownRadius.toFixed(2)}`,
      `crown h: ${p.crownHeight.toFixed(2)}`,
      `irreg: ${p.crownIrregularity.toFixed(2)}`,
      `depth: ${p.branchDepth}`,
      `relief: ${p.relief.toFixed(2)}`,
      `<span style="color:#d4a017">leaves: ${leafCount}</span>`,
    ].map(s => `<span>${s}</span>`).join('');
  }

  input.addEventListener('input', () => {
    leafCount = Math.round(Number(input.value));
    valueEl.textContent = String(leafCount);
    updateInfo();
    onChange(leafCount);
  });

  refreshBtn.addEventListener('click', () => {
    onRefresh();
    updateInfo();
    onChange(leafCount);
  });
  refreshBtn.addEventListener('mouseenter', () => {
    refreshBtn.style.background = 'rgba(212,160,23,0.25)';
  });
  refreshBtn.addEventListener('mouseleave', () => {
    refreshBtn.style.background = 'rgba(212,160,23,0.12)';
  });

  bottomBar.appendChild(document.createElement('span')).textContent = 'Leaves:';
  bottomBar.appendChild(input);
  bottomBar.appendChild(valueEl);
  bottomBar.appendChild(refreshBtn);

  updateInfo();

  return { leafCount };
}
