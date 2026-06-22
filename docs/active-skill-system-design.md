# 액티브 스킬 시스템 기획서

대상: `차원 균열 랜덤 디펜스` (Tauri + Canvas, 결정론 엔진)
작성: 2026-06-22
상태: 설계 제안 (구현 전)

---

## 1. 목표와 설계 원칙

현재 유닛은 **패시브 효과만** 가진다(`UnitDef`의 `splashRadius`, `slowPct`, `stunChance`, `bossDamageBonus`, `armorBreakPct`, `damageAmpPct`, `executePct`). 유닛 상세 패널의 "스킬 슬롯"은 역할/패시브 라벨을 재활용한 장식이라, 레퍼런스 Poly TD가 강조하는 **스킬 아이콘 + 발동률(%)** 의 손맛이 빠져 있다.

이 기획의 목표는 "랜덤 소환 → 조합 → **고급 영웅의 강력한 스킬**"이라는 핵심 판타지를 완성하는 것이다.

설계 원칙(반드시 지킬 제약):

1. **결정론 보존.** 엔진은 `new Rng(seed:difficulty:stage)`로 구동되고, 리플레이/`stateChecksum`/수동 밸런스 증거가 여기에 의존한다. 스킬의 모든 무작위 판정은 `Math.random`이 아니라 **시드 RNG(`this.rng`)를 고정된 순서로** 호출해야 한다(`fireAt` 주석: "rng는 uid 순서로만 호출").
2. **자동 시전 우선.** 장르가 자동전투형 랜덤 디펜스이므로 v1은 **플레이어 입력 없이 엔진이 자동 발동**한다. 새 `GameInput` 타입을 만들지 않으므로 리플레이가 그대로 호환된다. (수동 궁극기는 §11 선택지로 분리.)
3. **레퍼런스 일치.** 발동은 **발동확률(proc%) + 쿨다운** 모델로, 상세 패널에 아이콘과 %를 그대로 노출한다.
4. **기존 프리미티브 재사용.** 피해/방어/슬로우/스턴/방깎/증폭/처형은 이미 `fireAt`·`applyDamage`에 구현돼 있다. 스킬은 이 함수들을 재사용하는 **효과 프리미티브 조합**으로 정의한다.
5. **밸런스 증거 호환.** 등급별 기대 DPS 가이드(일반 ~13 … 히든 ~420)와 수동 증거 목표를 깨지 않도록, 스킬 기여분을 DPS 모델에 포함해 재튜닝한다.

---

## 2. 핵심 모델

### 발동 방식 — 자동 시전, 두 가지 트리거

- **확률 발동(onAttack proc).** 평타가 적중할 때마다 `chance` 확률로 발동. 레퍼런스의 `15% / 12% / 10%` 표기와 직결. 내부 쿨다운(`internalCd`)으로 연속 폭발을 제한.
- **주기 발동(timer).** `everySeconds`마다 자동 발동. "쿨다운형 궁극기"에 사용(전설/히든).

한 유닛은 **0~3개 스킬 슬롯**을 가진다. 등급 게이팅(권장):

| 등급 | 스킬 슬롯 | 성격 |
|---|---|---|
| 일반 | 0 | 패시브만 (현행 유지) |
| 희귀 | 0~1 | 약한 proc 1개 |
| 영웅 | 1~2 | 시그니처 proc 1 + 보조 |
| 전설 | 2~3 | proc 2 + 주기형 궁극기 1 |
| 히든 | 3 | 강력한 궁극기 + proc 2 |

이렇게 하면 "조합으로 고급 유닛을 만들수록 스킬이 늘어난다"는 성장감이 등급에 자연히 매핑된다.

### 스킬 위력 스케일

스킬 피해는 **유닛 공격력 배수**로 정의(`power: 1.8` = 평타의 180%). 따라서 계열 업그레이드(`flame` 공격 +12%/lv 등)와 전설 지휘 보정(`legendCommandAttackMult`)이 자동으로 스킬에도 반영된다.

---

## 3. 데이터 스키마

`src/core/types.ts`에 추가:

```ts
export type SkillTrigger =
  | { kind: "onAttack"; chance: number; internalCd?: number } // 적중 시 chance 확률, internalCd초 내부 쿨다운
  | { kind: "timer"; everySeconds: number };                  // 주기 자동 발동

export type SkillTarget =
  | "self"            // 자기 자신(버프)
  | "currentTarget"   // 현재 평타 대상
  | "nearestEnemy"
  | "lowestHpEnemy"
  | "highestHpEnemy"
  | "randomEnemy"     // rng 사용
  | "areaAroundTarget"// 대상 주변 radius
  | "alliesInRadius"; // 주변 아군 버프

export interface SkillEffect {
  type:
    | "burst"        // 즉시 피해 (power × 공격력), attackType 따름
    | "chain"        // 튕기는 피해 (maxJumps, falloff)
    | "dot"          // 도트 피해 (perSecond, duration)
    | "slow" | "stun" | "armorBreak" | "amp" | "execute" // 기존 프리미티브 재사용
    | "buffAttack" | "buffAttackSpeed"                   // 아군/자기 버프 (mult, duration)
    | "summon";      // 임시 소환수 (defId, count, lifeSeconds)
  power?: number;        // 공격력 배수
  radius?: number;       // 범위
  maxJumps?: number; falloff?: number;
  perSecond?: number; duration?: number;
  pct?: number;          // slow/execute/amp 비율
  mult?: number;         // 버프 배수
  defId?: string; count?: number; lifeSeconds?: number;
}

export interface SkillDef {
  id: string;
  name: string;
  icon: string;            // src/assets/ui/icon-*.svg 키 (skill, passive, attack ...) 재사용/확장
  trigger: SkillTrigger;
  target: SkillTarget;
  effects: SkillEffect[];  // 한 발동에 복수 효과 적용 (예: burst + stun)
  desc: string;
}
```

`UnitDef`에 추가:

```ts
export interface UnitDef {
  // ... 기존 ...
  skills?: SkillDef[];     // 없으면 패시브만
}
```

`OwnedUnit`에 런타임 쿨다운 추가(세이브/체크섬 영향 → §5):

```ts
export interface OwnedUnit {
  // ... 기존 ...
  skillCd: number[];       // skills와 같은 인덱스, 남은 쿨다운(초). 초기 [].
}
```

---

## 4. 엔진 통합 지점

모든 변경은 `src/core/engine.ts`의 전투 패스에 국한된다.

1. **쿨다운 감소** — 유닛 루프에서 평타 쿨다운(`u.cooldown -= DT`, 684행)과 같은 자리에서 `u.skillCd[i] -= DT`.
2. **proc 트리거** — `fireAt` 말미(805행 `collectDead()` 직전)에서, 유닛의 각 `onAttack` 스킬에 대해 순서대로:
   ```
   for i in skills:
     if trigger.onAttack and skillCd[i] <= 0 and rng.next() < chance:
        applySkill(u, d, skill, target)
        skillCd[i] = internalCd ?? 0
   ```
   **RNG 순서 규칙**: 유닛은 이미 고정 순서로 처리되고, `fireAt`는 그 안에서 `rng.next()`를 부른다(stun 판정). 스킬 proc 판정도 **유닛 내 스킬 인덱스 순서**로 호출하면 결정론이 유지된다.
3. **timer 트리거** — 유닛 루프에서 `skillCd[i] <= 0`이면 발동 후 `skillCd[i] = everySeconds`. 대상이 필요한데 적이 없으면 발동 보류(쿨다운 미초기화).
4. **효과 적용(`applySkill`)** — 신규 private 메서드. 대부분 기존 함수 재사용:
   - `burst/chain/dot/execute` → `this.applyDamage(...)` 재사용, `u.totalDamage += ...` (DPS 미터·전적 자동 반영).
   - `slow/stun/armorBreak/amp` → `fireAt`의 기존 코드 경로와 동일 로직 추출.
   - `randomEnemy`/`chain`의 대상 선택은 `this.rng.pick`/순회로 결정론 유지.
   - `summon`은 임시 `OwnedUnit`을 `lifeSeconds` 후 자동 제거(소환수는 조합/판매 불가 플래그 필요 → `OwnedUnit`에 `temporary?: boolean` 추가 검토).
5. **렌더 훅 재사용** — 보드 렌더러는 이미 발사 엣지·피격·처치 이펙트를 그린다(`board.ts`의 `spawnBeam/spawnSparks/spawnDeath`). 스킬 발동 시 별도 이펙트(예: 더 굵은 빔, 폭발 링)를 같은 시스템으로 추가하면 됨. 엔진→렌더 통신은 결정론 무관한 "발동 로그"를 state에 push하거나, 렌더가 `totalDamage`/HP 급변을 감지하는 기존 방식 확장.

---

## 5. 결정론·세이브·버전

- `OwnedUnit.skillCd`(및 가능시 `temporary`) 추가는 **상태 스키마 변경**이다. `DATA_VERSION`(현재 `0.8.4`)을 올리고, 구버전 세이브 로드시 `skillCd`를 `def.skills?.map(()=>0) ?? []`로 채우는 **마이그레이션**을 `saveApi`/리플레이 복원부에 추가한다.
- `stateChecksum`에 `skillCd`가 포함되면 기존 수동 증거 JSON과 체크섬이 달라진다 → **밸런스 증거 재수집 필요**. 증거 프레임워크의 `--dataVersion`이 이미 버전을 키로 쓰므로 신버전 라인으로 새로 쌓으면 된다.
- 스킬 proc는 시드 RNG를 추가로 소비하므로 **기존 시드의 결과가 바뀐다**(의도된 콘텐츠 변경). 밸런스 게이트/시뮬은 신버전 기준으로 다시 통과시킨다.

---

## 6. 효과 프리미티브 라이브러리

재사용(기존 `fireAt`/`applyDamage` 로직):
`burst`(즉시 피해), `slow`, `stun`, `armorBreak`, `amp`, `execute`, `splash`(=areaAroundTarget+burst).

신규(추가 구현):
- `chain` — 가장 가까운 적으로 N회 튕김, 점감(falloff). storm/void 시그니처.
- `dot` — 지속 피해(초당). flame(화상)/void(부식).
- `buffAttack` / `buffAttackSpeed` — 자기 또는 주변 아군 배수 버프, 지속시간. forest(지원)/iron(전열).
- `summon` — 임시 유닛 소환(전열 벽/추가 딜). void/forest 궁극기.

---

## 7. 계열별 예시 스킬 (콘텐츠 시드)

| 계열 | 트리거 | 스킬 예시 |
|---|---|---|
| 화염 flame | onAttack 15% | **폭심**: 대상 주변 radius 광역 burst(power 1.6) + dot(초당 0.4×, 3s) |
| 서리 frost | onAttack 18% | **절대영도**: 대상 stun 1.2s + 주변 slow 40%/2.5s |
| 폭풍 storm | onAttack 20% | **연쇄 번개**: chain 4회(power 1.2, falloff 0.7) |
| 강철 iron | timer 8s | **포위 강타**: 최대체력 대상 burst(power 3.0, 보스 추가 +30%) |
| 공허 void | onAttack 12% | **차원 균열**: armorBreak +2스택 + amp + 부식 dot |
| 숲 forest | timer 10s | **생명의 진**: 주변 아군 공격속도 +25%/5s (전설은 +공격력 동시) |

전설/히든은 위 proc 1~2개 + **주기형 궁극기 1개**(예: 히든 화염 "운석" — timer 12s, 전 화면 최대체력 3타깃 대형 burst + 화상). 발동률/쿨다운/배수는 §9 기준으로 튜닝.

---

## 8. UI 연동

- **유닛 상세 패널(`renderUnitDetail`)**: 현재 장식인 `ud-slot`을 실제 `def.skills`로 치환. 각 슬롯에 아이콘 + 발동조건(`15%` 또는 `8초`) + 호버 툴팁(효과 설명). 레퍼런스 `unit_detail_panel.png`의 스킬 아이콘+% 레이아웃과 일치.
- **도감(`openCollection`)**: 유닛별 스킬 목록 노출로 빌드 설계 지원.
- **발동 피드백**: 스킬 발동 시 보드에 굵은 빔/폭발 링(이미 만든 파티클 시스템 재사용) + 짧은 발동음(§9 사운드 작업과 연계). 유닛 위 작은 스킬 아이콘 플래시.
- **DPS 미터**: 스킬 피해가 `u.totalDamage`에 합산되므로 별도 작업 없이 미터/전적에 반영. (선택: 평타 vs 스킬 피해 분리 집계.)

---

## 9. 밸런스 가이드

- 등급별 기대 DPS 가이드(일반 ~13 … 히든 ~420)에 **스킬 기여분 포함**하도록 평타 계수를 하향 조정해 총 DPS를 유지하거나, 스킬을 "상방 분산"으로 두고 가이드 상한을 재설정한다.
- proc 스킬은 `chance × power × 공격속도`로 기대 DPS 기여를 계산해 시뮬(`scripts/sim.ts`, `balance-check.ts`)로 검증.
- 보스전 편중 방지: 광역(`chain/splash`)은 라인전, 단일 대형 burst는 보스전에 유리하도록 역할(`waveClear` vs `bossKiller`)과 일치시킨다.
- 자동 밸런스 게이트(`balanceGate.ts`)·100시드 시뮬을 신버전으로 재통과시키는 것을 머지 기준으로 삼는다.

---

## 10. 단계적 구현 계획

**Phase 1 — 기반(자동 proc만):**
타입(`SkillDef`/`SkillEffect`/`SkillTrigger`) 추가 → `OwnedUnit.skillCd` + `DATA_VERSION` 업 + 마이그레이션 → 엔진 `applySkill`(burst/slow/stun/armorBreak/amp/execute 재사용) + `fireAt` proc 훅 → 영웅+ 6계열에 시그니처 proc 1개씩 → 유닛 상세 패널 스킬 슬롯 실연동. (리플레이/체크섬/세이브 테스트 갱신.)

**Phase 2 — 신규 프리미티브 + 궁극기:**
`chain`/`dot`/`buff` 구현 → 전설/히든에 timer 궁극기 → 발동 이펙트·사운드 → 도감 스킬 표시.

**Phase 3 — 심화:**
`summon`(임시 유닛) → 평타/스킬 피해 분리 집계 → 밸런스 게이트 신버전 재튜닝 → (선택) 수동 궁극기.

---

## 11. 미결정 / 선택 사항

1. **수동 궁극기 도입 여부.** v1은 전부 자동. 원하면 1~2개 "플레이어 발동 궁극기"를 `GameInput`(`castSkill`)으로 추가 가능하나, 리플레이/증거에 입력이 추가되고 자동전투 톤과 상충. → 기본 제외 권장.
2. **스킬 RNG를 평타 RNG와 분리할지.** 같은 `this.rng` 순서 호출이면 충분. 별도 스트림은 불필요(복잡도↑).
3. **소환수 처리.** 조합/판매/유닛칸 카운트 제외 플래그 필요. Phase 3로 미룸.
4. **등급 게이팅 강도.** 위 표는 제안. 희귀에 스킬을 줄지(입문 난이도↑) 결정 필요.

---

## 요약

자동 시전 + 발동확률/쿨다운 모델은 (1) 결정론 엔진과 리플레이를 깨지 않고, (2) 기존 `fireAt`/`applyDamage` 프리미티브를 재사용하며, (3) 레퍼런스의 "스킬 아이콘 + %" 손맛과 일치하고, (4) 이미 만들어 둔 파티클/DPS 미터와 자연히 맞물린다. Phase 1만으로도 영웅+ 유닛에 시그니처 스킬이 붙어 체감이 크게 달라진다.
