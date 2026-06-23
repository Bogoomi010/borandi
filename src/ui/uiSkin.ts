// UI 스킨 적용 헬퍼
// ------------------------------------------------------------------
// uiAssets.ts 매니페스트의 key를 받아 실제 PNG를 DOM/캔버스에 입힌다.
//
//  - DOM 프레임/바: CSS `border-image` 기반 9-슬라이스
//  - DOM 배지/아이콘: `background-image`
//  - 캔버스(board.ts): `drawImage` 9분할
//
// 슬라이스 전이라 PNG가 없으면 모든 함수가 안전하게 no-op 한다
// (기존 CSS 룩을 그대로 유지하므로 빌드/렌더가 깨지지 않는다).
// 슬라이스한 PNG를 src/assets/ui/<category>/ 에 넣으면 자동으로 활성화된다.
// ------------------------------------------------------------------

import { getUiAsset, type UiAsset } from "./uiAssets";
import { getLocale } from "../i18n";

// i18n 로케일 -> 에셋 파일 접미사. 파일은 _ko/_en/_jp/_cn 규칙을 쓴다.
const LANG_SUFFIX: Record<string, string> = { ko: "ko", en: "en", ja: "jp", zh: "cn" };

// src/assets/ui 하위 모든 png를 URL로 지연 로딩 (Vite glob)
const assetUrlLoaders = import.meta.glob("../assets/ui/**/*.png", {
  query: "?url",
  import: "default",
}) as Record<string, () => Promise<string>>;

/** 매니페스트 file 경로 -> 해석된 URL 캐시 */
const urlCache = new Map<string, string>();
/** key -> 디코드된 Image 캐시 (캔버스용) */
const imageCache = new Map<string, HTMLImageElement>();

/** 기본 9-슬라이스 inset (px). 매니페스트 border 미지정 시 사용. */
const DEFAULT_BORDER = 24;

function loaderKeyFor(file: string): string | undefined {
  // file 예: "frames/panel-main.png" / 로더 키: "../assets/ui/frames/panel-main.png"
  const suffix = "/assets/ui/" + file;
  return Object.keys(assetUrlLoaders).find((k) => k.endsWith(suffix));
}

/** 임의의 file 경로(카테고리 기준 상대)에 대한 URL 해석. 없으면 undefined. */
async function urlForFile(file: string): Promise<string | undefined> {
  if (urlCache.has(file)) return urlCache.get(file);
  const loaderKey = loaderKeyFor(file);
  if (!loaderKey) return undefined; // 해당 파일 없음 -> no-op
  const url = await assetUrlLoaders[loaderKey]();
  urlCache.set(file, url);
  return url;
}

/** key의 PNG URL을 비동기 해석. 없으면 undefined. */
export async function resolveAssetUrl(key: string): Promise<string | undefined> {
  const asset = getUiAsset(key);
  if (!asset) return undefined;
  return urlForFile(asset.file);
}

/**
 * 현재 언어에 맞는 PNG URL을 해석한다.
 * `<dir>/<base>_<lang>.png`가 있으면 그걸, 없으면 베이스 파일로 폴백한다.
 */
export async function resolveLocalizedAssetUrl(key: string): Promise<string | undefined> {
  const asset = getUiAsset(key);
  if (!asset) return undefined;
  const suffix = LANG_SUFFIX[getLocale()] ?? "en";
  const localizedFile = asset.file.replace(/\.png$/, `_${suffix}.png`);
  return (await urlForFile(localizedFile)) ?? (await urlForFile(asset.file));
}

function borderCss(asset: UiAsset): string {
  const b = asset.border ?? DEFAULT_BORDER;
  return Array.isArray(b) ? b.join(" ") : String(b);
}

/**
 * DOM 요소에 9-슬라이스 프레임을 적용한다.
 * PNG가 아직 없으면 아무 것도 하지 않고 false 반환(기존 CSS 유지).
 *
 * @param opts.slice  소스 이미지에서 잘라낼 모서리 px(미지정 시 매니페스트 border 또는 기본값)
 * @param opts.width  화면에 렌더링할 테두리 두께 px(미지정 시 slice와 동일). 장식을 축소해 그릴 때 사용.
 * @param opts.fill   중앙 영역도 채울지(프레임 배경 이미지로 쓸 때 true). 외곽선 프레임이면 false 권장.
 */
export async function applyNineSlice(
  elem: HTMLElement,
  key: string,
  opts: { slice?: number | [number, number, number, number]; width?: number; fill?: boolean } = {},
): Promise<boolean> {
  const asset = getUiAsset(key);
  if (!asset) return false;
  const url = await resolveAssetUrl(key);
  if (!url) return false;
  const slice = opts.slice !== undefined
    ? (Array.isArray(opts.slice) ? opts.slice.join(" ") : String(opts.slice))
    : borderCss(asset);
  const width = opts.width !== undefined ? `${opts.width}px` : `${slice}px`;
  elem.style.borderImageSource = `url(${url})`;
  elem.style.borderImageSlice = opts.fill === false ? `${slice}` : `${slice} fill`;
  elem.style.borderImageWidth = width;
  elem.style.borderImageRepeat = "stretch";
  elem.style.borderStyle = "solid";
  elem.style.borderColor = "transparent";
  elem.dataset.uiSkin = key;
  return true;
}

/** 전역 커스텀 커서 적용 (controls.cursor). 없으면 no-op. */
export async function applyCursor(): Promise<void> {
  const url = await resolveAssetUrl("controls.cursor");
  if (!url) return;
  document.body.style.cursor = `url(${url}) 2 2, auto`;
}

/**
 * 게임 화면 크롬(상시 패널)에 빈 프레임 키트를 입힌다.
 * 텍스트가 베이크되지 않은 외곽 프레임(nineslice)만 사용하므로 런타임 텍스트와 충돌하지 않는다.
 * 컨테이너 엘리먼트는 영속(렌더 시 innerHTML만 교체)이라 부팅 시 1회 적용으로 유지된다.
 */
export async function skinGameChrome(): Promise<void> {
  // 전역 커스텀 커서만 적용한다.
  // 상단바/액션바/우측/보드의 9-슬라이스 컨테이너 프레임은 기존 CSS(골드 테두리·그라데이션)와
  // 겹쳐 떠 보이는 문제가 있어 제거했다. 프레임이 필요하면 개별 영역에서 신중히 다시 적용한다.
  await applyCursor();
}

/** 액션바 버튼 아이콘 키 → 베이크 버튼 에셋 키 매핑 (renderActionbar에서 사용) */
const ACTION_BTN_SKIN: Record<string, string> = {
  summon: "actionbar.btn.summon",
  merge: "actionbar.btn.merge",
  sell: "actionbar.btn.sell",
  upgrade: "actionbar.btn.upgrade",
  passive: "actionbar.btn.relic",
  damage: "actionbar.btn.dps-toggle",
  skill: "actionbar.btn.round-start.normal",
};

/**
 * 액션 버튼을 현재 언어의 완성 버튼 이미지(아이콘+라벨 베이크)로 입힌다.
 * 적용되면 "img-skinned" 클래스를 붙여, CSS가 중복되는 DOM 아이콘/라벨을 숨기고
 * 동적 수치(sub: 비용/수량)만 오버레이로 남긴다. 에셋 없으면 no-op(기존 DOM 버튼 유지).
 */
export function skinActionButton(elem: HTMLElement, icon: string | undefined): void {
  if (!icon) return;
  const key = ACTION_BTN_SKIN[icon];
  if (!key) return;
  void resolveLocalizedAssetUrl(key).then((url) => {
    if (!url) return;
    elem.style.backgroundImage = `url(${url})`;
    elem.style.backgroundSize = "contain"; // 비율 유지(찌그러짐 방지)
    elem.style.backgroundRepeat = "no-repeat";
    elem.style.backgroundPosition = "center";
    elem.classList.add("img-skinned");
    elem.dataset.uiSkin = key;
  });
}

/**
 * DOM 요소 배경에 단일 스프라이트(배지/아이콘/버튼)를 깐다.
 * PNG가 없으면 no-op + false.
 */
export async function applySprite(
  elem: HTMLElement,
  key: string,
  fit: "contain" | "cover" | "100% 100%" = "contain",
): Promise<boolean> {
  const url = await resolveAssetUrl(key);
  if (!url) return false;
  elem.style.backgroundImage = `url(${url})`;
  elem.style.backgroundSize = fit;
  elem.style.backgroundRepeat = "no-repeat";
  elem.style.backgroundPosition = "center";
  elem.dataset.uiSkin = key;
  return true;
}

/** 현재 언어 변형 스프라이트를 배경으로 깐다(고정 라벨 배지/버튼용). 없으면 no-op + false. */
export async function applySpriteLocalized(
  elem: HTMLElement,
  key: string,
  fit: "contain" | "cover" | "100% 100%" = "contain",
): Promise<boolean> {
  const url = await resolveLocalizedAssetUrl(key);
  if (!url) return false;
  elem.style.backgroundImage = `url(${url})`;
  elem.style.backgroundSize = fit;
  elem.style.backgroundRepeat = "no-repeat";
  elem.style.backgroundPosition = "center";
  elem.dataset.uiSkin = key;
  return true;
}

/**
 * 파일 경로(카테고리 기준 상대, 예: "topbar/speed-x1-selected.png")로 직접 배경 스킨.
 * 매니페스트 키가 없는 상태 변형(속도 선택/재생·일시정지 등)에 사용. 없으면 no-op + false.
 * 적용 시 data-ui-skin 설정 → CSS가 기존 텍스트/배경을 숨기도록 트리거.
 */
export async function skinByFile(
  elem: HTMLElement,
  file: string,
  fit: "contain" | "cover" | "100% 100%" = "contain",
): Promise<boolean> {
  const url = await urlForFile(file);
  if (!url) return false;
  elem.style.backgroundImage = `url(${url})`;
  elem.style.backgroundSize = fit;
  elem.style.backgroundRepeat = "no-repeat";
  elem.style.backgroundPosition = "center";
  elem.dataset.uiSkin = file;
  return true;
}

/** 캔버스용 Image 로드(캐시). 없으면 undefined. */
export async function loadUiImage(key: string): Promise<HTMLImageElement | undefined> {
  if (imageCache.has(key)) return imageCache.get(key);
  const url = await resolveAssetUrl(key);
  if (!url) return undefined;
  const img = new Image();
  img.src = url;
  imageCache.set(key, img);
  return img;
}

/**
 * 캔버스 9분할 그리기. board.ts 등 캔버스 렌더에서 사용.
 * img가 로드 전이면 그냥 반환(다음 프레임에 그려짐).
 */
export function drawNineSlice(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  border: number | [number, number, number, number] = DEFAULT_BORDER,
): void {
  if (!img.complete || img.naturalWidth === 0) return;
  const [t, r, b, l] = Array.isArray(border)
    ? border
    : [border, border, border, border];
  const sw = img.naturalWidth;
  const sh = img.naturalHeight;
  // 소스/대상 9개 영역: 모서리는 고정, 변/중앙은 늘림
  const sx = [0, l, sw - r];
  const sy = [0, t, sh - b];
  const sCols = [l, sw - l - r, r];
  const sRows = [t, sh - t - b, b];
  const dX = [dx, dx + l, dx + dw - r];
  const dY = [dy, dy + t, dy + dh - b];
  const dCols = [l, dw - l - r, r];
  const dRows = [t, dh - t - b, b];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      if (sCols[col] <= 0 || sRows[row] <= 0) continue;
      ctx.drawImage(
        img,
        sx[col], sy[row], sCols[col], sRows[row],
        dX[col], dY[row], dCols[col], dRows[row],
      );
    }
  }
}
