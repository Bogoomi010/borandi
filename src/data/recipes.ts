import type { RecipeDef } from "../core/types";

export const RECIPES: RecipeDef[] = [
  // ===== 희귀 조합 (샘플 데이터 팩 기준) =====
  {
    id: "recipe_flame_mage", resultUnitId: "flame_mage",
    ingredients: [{ unitId: "ember_scout", count: 2 }, { unitId: "rift_eye", count: 1 }],
    cost: { gold: 40 }, visibility: "visible",
  },
  {
    id: "recipe_ice_shaman", resultUnitId: "ice_shaman",
    ingredients: [{ unitId: "frost_archer", count: 2 }, { unitId: "sprout_healer", count: 1 }],
    cost: { gold: 40 }, visibility: "visible",
  },
  {
    id: "recipe_storm_lancer", resultUnitId: "storm_lancer",
    ingredients: [{ unitId: "gust_gunner", count: 2 }, { unitId: "ember_scout", count: 1 }],
    cost: { gold: 40 }, visibility: "visible",
  },
  {
    id: "recipe_steam_knight", resultUnitId: "steam_knight",
    ingredients: [{ unitId: "gear_soldier", count: 2 }, { unitId: "frost_archer", count: 1 }],
    cost: { gold: 45 }, visibility: "visible",
  },
  {
    id: "recipe_void_priest", resultUnitId: "void_priest",
    ingredients: [{ unitId: "rift_eye", count: 2 }, { unitId: "gear_soldier", count: 1 }],
    cost: { gold: 45 }, visibility: "visible",
  },
  {
    id: "recipe_grove_druid", resultUnitId: "grove_druid",
    ingredients: [{ unitId: "sprout_healer", count: 2 }, { unitId: "gust_gunner", count: 1 }],
    cost: { gold: 40 }, visibility: "visible",
  },

  // ===== 영웅 조합 =====
  {
    id: "recipe_phoenix_archmage", resultUnitId: "phoenix_archmage",
    ingredients: [{ unitId: "flame_mage", count: 2 }, { unitId: "storm_lancer", count: 1 }],
    cost: { gold: 120 }, visibility: "visible", minRound: 8,
  },
  {
    id: "recipe_glacier_warden", resultUnitId: "glacier_warden",
    ingredients: [{ unitId: "ice_shaman", count: 2 }, { unitId: "void_priest", count: 1 }],
    cost: { gold: 120 }, visibility: "visible", minRound: 8,
  },
  {
    id: "recipe_tempest_blademaster", resultUnitId: "tempest_blademaster",
    ingredients: [{ unitId: "storm_lancer", count: 2 }, { unitId: "flame_mage", count: 1 }],
    cost: { gold: 120 }, visibility: "visible", minRound: 8,
  },
  {
    id: "recipe_fortress_breaker", resultUnitId: "fortress_breaker",
    ingredients: [{ unitId: "steam_knight", count: 2 }, { unitId: "ice_shaman", count: 1 }],
    cost: { gold: 130 }, visibility: "visible", minRound: 8,
  },
  {
    id: "recipe_abyss_oracle", resultUnitId: "abyss_oracle",
    ingredients: [{ unitId: "void_priest", count: 2 }, { unitId: "steam_knight", count: 1 }],
    cost: { gold: 130 }, visibility: "visible", minRound: 8,
  },
  {
    id: "recipe_world_tree_sage", resultUnitId: "world_tree_sage",
    ingredients: [{ unitId: "grove_druid", count: 2 }, { unitId: "void_priest", count: 1 }],
    cost: { gold: 120 }, visibility: "visible", minRound: 8,
  },

  // ===== 전설 조합 =====
  {
    id: "recipe_solar_avatar", resultUnitId: "solar_avatar",
    ingredients: [
      { unitId: "phoenix_archmage", count: 1 },
      { unitId: "tempest_blademaster", count: 1 },
      { unitId: "flame_mage", count: 1 },
    ],
    cost: { gold: 300 }, visibility: "visible", minRound: 12,
  },
  {
    id: "recipe_chrono_marshal", resultUnitId: "chrono_marshal",
    ingredients: [
      { unitId: "glacier_warden", count: 1 },
      { unitId: "abyss_oracle", count: 1 },
      { unitId: "ice_shaman", count: 1 },
    ],
    cost: { gold: 300 }, visibility: "visible", minRound: 12,
  },
  {
    id: "recipe_titan_slayer", resultUnitId: "titan_slayer",
    ingredients: [
      { unitId: "fortress_breaker", count: 2 },
      { unitId: "world_tree_sage", count: 1 },
    ],
    cost: { gold: 350 }, visibility: "visible", minRound: 12,
  },

  // ===== 히든 조합 (도감 발견 전에는 도우미에 노출하지 않음) =====
  {
    id: "recipe_rift_singularity", resultUnitId: "rift_singularity",
    ingredients: [
      { unitId: "abyss_oracle", count: 2 },
      { unitId: "chrono_marshal", count: 1 },
    ],
    cost: { gold: 500 }, visibility: "hidden", minRound: 14,
  },
  {
    id: "recipe_prism_dragon", resultUnitId: "prism_dragon",
    ingredients: [
      { unitId: "solar_avatar", count: 1 },
      { unitId: "titan_slayer", count: 1 },
      { unitId: "glacier_warden", count: 1 },
    ],
    cost: { gold: 600 }, visibility: "hidden", minRound: 14,
  },
];

export const RECIPE_BY_ID: Record<string, RecipeDef> = Object.fromEntries(
  RECIPES.map((r) => [r.id, r]),
);
