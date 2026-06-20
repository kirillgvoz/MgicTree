export interface GameState {
  leaves: number;
  totalLeaves: number;
  clicks: number;
  clickPower: number;
  autoLeavesPerSec: number;
  refreshUnlocked: boolean;
  upgradesBought: Record<string, number>;
  pixelArt: boolean;
}

const STORAGE_KEY = 'magictree_save';

const DEFAULT_STATE: GameState = {
  leaves: 0,
  totalLeaves: 0,
  clicks: 0,
  clickPower: 1,
  autoLeavesPerSec: 0,
  refreshUnlocked: false,
  upgradesBought: {},
  pixelArt: true,
};

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  baseCost: number;
  costMultiplier: number;
  maxLevel: number;
  effect: (level: number) => void;
}

let state: GameState = loadState();

function loadState(): GameState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_STATE, ...JSON.parse(saved) };
    }
  } catch {}
  return { ...DEFAULT_STATE };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function getState(): GameState {
  return state;
}

export function getLeaves(): number {
  return state.leaves;
}

export function addLeaves(delta: number) {
  state.leaves += delta;
  state.totalLeaves += delta;
  saveState();
}

export function spendLeaves(amount: number): boolean {
  if (state.leaves >= amount) {
    state.leaves -= amount;
    saveState();
    return true;
  }
  return false;
}

export function tickAutoLeaves(dt: number) {
  if (state.autoLeavesPerSec > 0) {
    const earned = Math.floor(state.autoLeavesPerSec * dt);
    if (earned > 0) {
      state.leaves += earned;
      state.totalLeaves += earned;
    }
  }
}

export function setPixelArtSetting(on: boolean) {
  state.pixelArt = on;
  saveState();
}

export function getUpgradeLevel(id: string): number {
  return state.upgradesBought[id] || 0;
}

export function getUpgrades(): Upgrade[] {
  return [
    {
      id: 'clickPower',
      name: 'Power Click',
      description: '+1 leaf per click',
      baseCost: 25,
      costMultiplier: 2.2,
      maxLevel: 20,
      effect: (level) => { state.clickPower = 1 + level; },
    },
    {
      id: 'autoLeaf',
      name: 'Auto Leaf',
      description: '+1 leaf/sec',
      baseCost: 50,
      costMultiplier: 2.5,
      maxLevel: 15,
      effect: (level) => { state.autoLeavesPerSec = level; },
    },
    {
      id: 'refreshUnlock',
      name: 'Unlock Refresh',
      description: 'Enable tree regeneration',
      baseCost: 200,
      costMultiplier: 1,
      maxLevel: 1,
      effect: () => { state.refreshUnlocked = true; },
    },
    {
      id: 'clickMulti',
      name: 'Click Multiplier',
      description: 'x2 leaves per click',
      baseCost: 500,
      costMultiplier: 3,
      maxLevel: 5,
      effect: (level) => { state.clickPower *= Math.pow(2, level); },
    },
    {
      id: 'autoMulti',
      name: 'Auto Multiplier',
      description: 'x2 auto leaves/sec',
      baseCost: 800,
      costMultiplier: 3.5,
      maxLevel: 5,
      effect: (level) => { state.autoLeavesPerSec *= Math.pow(2, level); },
    },
    {
      id: 'leafBoost',
      name: 'Leaf Boost',
      description: '+500 max leaves',
      baseCost: 300,
      costMultiplier: 2.8,
      maxLevel: 10,
      effect: () => {},
    },
  ];
}

export function getUpgradeCost(upgrade: Upgrade): number {
  const level = getUpgradeLevel(upgrade.id);
  return Math.floor(upgrade.baseCost * Math.pow(upgrade.costMultiplier, level));
}

export function buyUpgrade(upgrade: Upgrade): boolean {
  const cost = getUpgradeCost(upgrade);
  if (spendLeaves(cost)) {
    state.upgradesBought[upgrade.id] = (state.upgradesBought[upgrade.id] || 0) + 1;
    applyUpgrades();
    saveState();
    return true;
  }
  return false;
}

export function applyUpgrades() {
  state.clickPower = 1;
  state.autoLeavesPerSec = 0;
  state.refreshUnlocked = false;

  for (const upgrade of getUpgrades()) {
    const level = getUpgradeLevel(upgrade.id);
    if (level > 0) {
      upgrade.effect(level);
    }
  }
}

export function getMaxLeaves(): number {
  const boostLevel = getUpgradeLevel('leafBoost');
  return 8000 + boostLevel * 500;
}

export function resetGame() {
  localStorage.removeItem(STORAGE_KEY);
  state = { ...DEFAULT_STATE };
}
