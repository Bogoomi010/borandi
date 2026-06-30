import { Assets, Texture } from "pixi.js";
import { UI_ASSET_MANIFEST } from "./UiAssetManifest";
import type { UiTextureKey } from "../skin/UiTextureKeys";

const textureCache = new Map<UiTextureKey, Texture>();

export function uiAssetUrl(key: UiTextureKey): string {
  return UI_ASSET_MANIFEST[key];
}

export function uiTexture(key: UiTextureKey): Texture {
  const cached = textureCache.get(key);
  if (cached) return cached;
  const texture = Texture.from(uiAssetUrl(key));
  textureCache.set(key, texture);
  return texture;
}

export function preloadUiTextures(keys: readonly UiTextureKey[] = Object.keys(UI_ASSET_MANIFEST) as UiTextureKey[]) {
  return Assets.load(keys.map(uiAssetUrl));
}
