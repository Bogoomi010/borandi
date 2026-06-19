# 차원 균열 랜덤 디펜스 (rift-random-defense)

Tauri v2 기반 2D 캐릭터 랜덤 디펜스 MVP. `docs` 기획 문서(랜덤 디펜스 MVP 요구사항, Tauri 시스템 기획, 샘플 데이터 팩 등)를 기반으로 구현했다.
모든 캐릭터는 오리지널 IP("차원 균열" 세계관)이며, 에셋 없이 **도형과 색**으로만 표현한다 (에셋은 추후 교체 예정).

## 실행

```bash
yarn install

# 브라우저로 바로 실행 (저장은 localStorage fallback)
yarn dev          # http://localhost:1420

# Tauri 데스크탑 앱 (Rust 툴체인 필요)
yarn tauri dev

# 데스크탑 빌드
yarn tauri build
```

## 테스트 / 시뮬레이션

```bash
yarn test                 # vitest: 코어 규칙 + 리플레이 재현성 테스트
yarn sim --seeds=100      # CLI 자동 시뮬레이션 (--difficulty=novice|normal|intermediate|expert|master)
yarn balance              # 5난이도 목표 밸런스 게이트(기본 30시드)
yarn balance --json=output/balance-report.json  # 게이트 결과를 JSON으로 저장
yarn browser-balance --json=output/browser-balance.json --screenshots=output/browser-balance-shots
                          # 실행 중인 yarn dev 서버를 대상으로 10R 전후 브라우저 플레이테스트 게이트 실행
yarn browser-direct --json=output/browser-direct.json --screenshots=output/browser-direct-shots
                          # 실행 중인 yarn dev 서버에서 실제 소환/합성/조합/업그레이드 입력 흐름으로 2시드 이상 긴 밸런스 표본 수집
yarn manual-playlog --difficulty=normal --minutes=24 --result=loss --stage=1 --round=39 --seed=RUN123 --legends=1 --maxGrade=legend --dataVersion=0.8.0 --stateChecksum=1234abcd --notes="후반 누적 압박"
                          # 사람이 직접 플레이한 수동 밸런스 세션을 output/manual-balance-playlog.json에 누적
yarn manual-playlog --summary
                          # 현재 수동 로그의 120분/난이도별/목표 결과 충족 상태와 다음 필요 세션 확인
yarn manual-playlog --next
                          # 바로 다음에 채워야 할 수동 플레이 세션 1개만 확인
yarn manual-playlog --plan
                          # 남은 120분 수동 플레이 증거를 어떤 순서로 채울지 출력
yarn --silent manual-playlog --summary --json
                          # 같은 수동 로그 상태를 자동화 가능한 JSON으로 출력
yarn balance-audit --manual=output/manual-balance-playlog.json --out=output/balance-audit.md
                          # balance/browser-balance/browser-direct/manual JSON을 모아 요구사항별 근거 감사표 생성
yarn balance-proof        # 자동/브라우저 밸런스 증거 JSON을 재생성하고 감사표까지 갱신
yarn check                # npm 의존성 없이 Node만으로 코어 스모크 테스트
```

인게임에서도 `Tools > 100시드 시뮬레이션` 또는 `Tools > 5난이도 밸런스 게이트` 메뉴로 실행할 수 있다.
40라운드 전체 클리어율 밴드는 `yarn balance`가 기준이고, `yarn browser-balance`는 실제 브라우저 런타임에서 난이도/전설 보유 조건과 10R 첫 보스 전후 체감 차이를 확인하는 보조 게이트다.
`yarn browser-direct`는 DEV 스폰으로 유닛을 고정하지 않고 소환/선택권/합성/조합/업그레이드 입력을 반복해 긴 브라우저 표본을 모으는 보조 플레이테스트다. JSON에는 누적 시뮬레이션 플레이 시간도 함께 기록된다.
`yarn manual-playlog`는 사람이 직접 플레이한 세션을 `output/manual-balance-playlog.json`에 누적한다.
`yarn balance-audit`는 `browser-direct` JSON의 시나리오 범위, strict 통과 여부, 관찰 게이트도 확인해 실제 브라우저 입력 표본이 난이도별 목표와 같은 방향인지 검사한다.
수동 플레이 로그는 `docs/manual-balance-playlog.example.json` 형식을 따른다. 예시 파일은 `example: true`로 표시되어 감사 증거에서 제외된다. `yarn balance-audit`는 시작/종료 시각, 결과, 맵, 라운드, 시드, 전설 수, 최고 등급, 데이터 버전, 상태 체크섬이 완전한 세션만 세며, 전설 수와 최고 등급이 서로 일치해야 한다. 중복 상태 체크섬은 한 번만 카운트한다. 총 120분 이상, 각 난이도 최소 12분 이상을 요구한다. 또한 입문자 40R 무전설 클리어, 일반 40R 1~2전설 클리어, 중급자 40R 5전설 이상 클리어, 고수 40R 5전설 이하 실패 + 40R 6전설 이상 클리어, 초고수 실패 기록은 각각 12분 이상 진행된 목표 결과 세션이어야 한다.
게임 결과 화면과 결과 리포트에는 현재 세션의 실제 경과 시간을 넣은 `yarn manual-playlog` 명령이 함께 표시된다.

## 데스크탑 게임 구성

- **타이틀 화면**: 균열 파티클 배경, 게임 시작 / 이어하기 / 불러오기 / 도감 / 옵션 / 종료.
- **일시정지 메뉴** (`Esc`): 계속하기, 저장/불러오기, 옵션, 타이틀로, 종료.
- **옵션**: 마스터/효과음/음악 볼륨, 화면 흔들림, 고대비 모드, 전체화면, 기본 배속, 창 비활성 시 자동 일시정지. 설정은 영구 저장된다.
- **도감**: 수집한 유닛(미수집은 ???), 히든 조합 발견 기록, 플레이 전적 — 런과 무관하게 누적.
- **사운드**: 외부 에셋 없이 WebAudio로 절차 합성한 효과음(소환/조합/보스/피격/승리 등)과 앰비언트 BGM.
- **연출**: 피격 화면 흔들림, 등급별 소환음 차별화, 보스 경고음.

## 게임 규칙 요약

- **전장**: 적은 사각형 닫힌 루프(둘레)를 출발점에서 계속 돈다. 누수/탈출은 없다. 아군 유닛은 사각형 **내부**에서 자유 이동하며 둘레의 적을 처치한다.
- **패배 조건**: 처치하지 못한 적은 루프에 계속 쌓인다. **다음 라운드가 시작되는 순간** 루프를 도는 적이 난이도별 누적 허용치 이상이면 방어선 붕괴(입문자 100 / 일반 58 / 중급자 52 / 고수 48 / 초고수 32).
- **승리 조건**: 게임 시작 시 선택한 맵에서 40라운드 최종 보스까지 처치하면 클리어.
- 맵은 라운드나 보스마다 바뀌지 않는다. 새 게임에서 고른 맵 하나로 1~40R을 진행하고, 현재 해금된 맵의 40R 최종 보스를 클리어한 뒤에만 다음 맵 선택 권한이 열린다.
- **소환** (20골드): 일반 58% / 희귀 28% / 영웅 10% / 전설 4%. **히든은 소환·3합성·선택권으로 나오지 않으며 히든 조합으로만 획득**한다.
  - 10회 연속 일반이면 다음 소환은 희귀 이상 확정 (보정).
  - 16R까지 영웅 이상이 없으면 영웅 선택권 지급.
- **3합성**: 같은 등급 3기 → 한 등급 위 1기 (같은 계열 3기면 같은 계열 결과 우선).
- **지정 조합**: 조합 탭(조합도우미)에서 제작 가능/1개 부족/잠금 경고 확인. 히든 조합 2종은 발견 전 비공개.
- **미션** 12종(히든 2종 포함): 운이 나쁜 판의 회복 루트.
- **잠금(🔒)** 유닛은 판매/조합 재료에서 보호된다.
- 별도 준비 단계가 없다. 다음 라운드는 **해당 라운드의 적을 모두 전멸시키면 그 시점부터 10초 후**, 전멸시키지 못하면 **스폰 완료로부터 최대 1분 후** 자동 시작된다(둘 중 빠른 쪽). 버튼/Space로 즉시 시작할 수도 있다. 휴식 중에도 아군과 적은 멈추지 않고 계속 움직인다.
- 소환·3합성·조합·판매·업그레이드·속도·잠금은 **전투 중을 포함해 상시** 가능하다(게임 종료 후 제외).

## 조작 (RTS 유닛 컨트롤)

마우스
| 입력 | 동작 |
| --- | --- |
| 좌클릭 | 유닛 선택 (빈 곳 클릭 시 선택 해제) |
| 좌드래그 | 박스 다중 선택 |
| 우클릭(지형) | 선택 유닛 이동 (여러 기는 목적지 주변 대형으로 분산) |
| 우클릭(적) | 선택 유닛으로 해당 적 지정 공격 |

키보드
| 키 | 동작 |
| --- | --- |
| A → 좌클릭 | 공격 이동 (이동 중 적 발견 시 교전) |
| S | 정지(Hold) — 제자리 대기, 사거리 내만 자동 공격 |
| Ctrl + 1~9 | 현재 선택을 해당 번호 부대로 저장 |
| 1~9 | 저장된 부대 선택 |
| Space | 웨이브 시작 / 다음 웨이브 / 일시정지 |
| Q / W / E | 속도 x1 / x2 / x3 |
| Z | 소환 |
| X | 선택 3기 합성 |
| Delete / Backspace | 선택 유닛 판매 (상시 가능, 확인 후) |
| L | 선택 유닛 잠금 |
| Esc | 공격이동 취소 / 모달 닫기 / 일시정지 메뉴 |

- 명령이 없는 유닛은 시야(=사거리+α) 안의 적을 자동으로 교전하고, 추적 한계(leash)를 벗어나면 원래 위치로 복귀한다.
- 플레이어 명령이 자동 행동보다 항상 우선한다.
- 유닛은 서로 겹치지 않으며 적 이동 경로 위에는 설 수 없다(자동으로 밀려남).
- 조합/미션/보스 탭은 우측 패널의 탭을 클릭해 전환한다.

## 구조

```
src/
  core/      판정 가능한 모든 게임 규칙 (순수 TS, 결정론적)
    rng.ts        시드 RNG (xmur3+mulberry32)
    engine.ts     Game 클래스: 소환/조합/미션/전투 tick/보스/리플레이
    advisor.ts    조합도우미 · 보스 위험도 (순수 함수)
    path.ts       경로/슬롯 좌표
    checksum.ts   상태 체크섬 (재현성 검증)
  data/      콘텐츠 데이터 (코드와 분리, 밸런스 조정은 여기서)
    units.ts      유닛 24종 (일반6/희귀6/영웅6/전설4/히든2)
    recipes.ts    조합식 17종 (히든 2종)
    missions.ts   미션 12종
    waves.ts      웨이브 1~40R + 보스 4종
    upgrades.ts   계열 업그레이드 6종
    difficulty.ts 난이도/확률표/보정/환급
  ui/        DOM/캔버스 (판정 로직 없음)
  sim/       자동 플레이어 + 다중 시드 시뮬레이터 (실제 core 재사용)
  save/      저장 추상화 (Tauri SQLite ↔ localStorage fallback)
src-tauri/   데스크탑 쉘: SQLite 저장/리포트 등 낮은 빈도 I/O만 담당
scripts/     sim.ts (CLI 시뮬레이션), sandbox-check.mjs (무의존 스모크 테스트)
```

## 재현성 (핵심 설계)

- 같은 `dataVersion` + `seed` + `difficulty` + `inputHistory` ⇒ 같은 결과.
- 전투는 20Hz 고정 timestep. 렌더링은 rAF로 분리.
- 모든 난수는 시드 RNG 인스턴스를 통해서만 발생.
- 저장은 스냅샷이 아니라 **입력 로그 리플레이**로 복원하고, 체크섬으로 검증한다.
- 자동 저장은 phase 전환(준비/정산 진입) 기준. 수동 슬롯 3개 + 자동 1개(백업 1개 유지).

## Tauri 명령 (낮은 빈도 I/O 전용)

`save_run_snapshot` / `load_run_snapshot` / `list_save_slots` / `delete_save_slot` /
`record_run_result` / `list_run_results` / `write_run_report` / `open_app_data_dir`

- 유저 데이터: 앱 데이터 폴더의 `random-defense.db` (SQLite, rusqlite bundled).
- 리포트: 앱 데이터 폴더 `reports/`에 Markdown으로 저장.
- 프런트엔드는 npm 패키지 대신 `withGlobalTauri`(window.__TAURI__)를 사용한다.
- 권한은 `core:default`만 허용 (fs/shell/network 미사용).

## 밸런스 현황 (30시드 자동 시뮬레이션, balanced 전략)

| 조건 | 클리어율 | 목표 |
| --- | ---: | --- |
| 입문자 / 전설 없음 | 30/30 | 전설 없이도 클리어 가능 |
| 일반 / 전설 0개 | 6/30 | 불안정 |
| 일반 / 전설 1개 | 12/30 | 클리어권 진입 |
| 일반 / 전설 2개 | 17/30 | 더 안정적인 클리어권 |
| 중급자 / 전설 2개 | 4/30 | 부족 |
| 중급자 / 전설 5개 | 15/30 | 클리어권 진입 |
| 중급자 / 제한 없음 | 30/30 | 충분한 전설 축적 시 안정 |
| 고수 / 전설 5개 | 0/30 | 중급 예산으로는 부족 |
| 고수 / 제한 없음 | 19/30 | 더 높은 성장 필요 |
| 초고수 / 제한 없음 | 0/30 | 매우 어려움 |

자동 플레이어 기준 수치이므로 실제 플레이어 체감과 다를 수 있다. 현재 게이트는 중급자 2전설 클리어율을 15% 이하로 제한하고, 5전설 조건이 2전설보다 최소 30%p 높아야 통과한다.
게이트는
`yarn balance` 또는 인게임 `Tools > 5난이도 밸런스 게이트`로 재현하며, `--json=경로`를 붙이면 시나리오별 결과와 게이트 판정을 JSON으로 저장한다. 조정 절차는
`random-defense-balance-formulas.md`의 "첫 조정 절차"를 따른다.

## MVP에서 뺀 것

멀티플레이, 계정/클라우드, 과금, 모바일 UI, OS 네이티브 메뉴(인앱 HTML 메뉴로 대체),
텔레메트리 테이블 적재(스키마만 존재), 즐겨찾기 시드 UI.
