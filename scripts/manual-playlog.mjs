// Append one human playtest session to the manual balance play log.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ""), "true"];
  }),
);

const DEFAULT_MANUAL_LOG_PATH = "output/manual-balance-playlog.json";
const outPath = String(args.out ?? DEFAULT_MANUAL_LOG_PATH);
const difficulties = ["novice", "normal", "intermediate", "expert", "master"];
const results = ["clear", "loss", "quit"];
const grades = ["common", "rare", "hero", "legend", "hidden"];

function usage() {
  return [
    "사용법:",
    "  yarn manual-playlog --difficulty=normal --minutes=24 --result=loss --stage=1 --round=39 --seed=RUN123 --legends=1 --maxGrade=legend --dataVersion=RESULT_DATA_VERSION --stateChecksum=RESULT_CHECKSUM --notes=\"2전설, 후반 누적 압박\"",
    "",
    "필수:",
    "  --difficulty=novice|normal|intermediate|expert|master",
    "  --minutes=분 또는 --seconds=초",
    "  --result=clear|loss|quit",
    "  --stage=1 --round=40 --seed=...",
    "  --legends=2        # 전설 이상 보유 수",
    "  --maxGrade=legend",
    "  --dataVersion=...  # 결과 리포트의 데이터 버전",
    "  --stateChecksum=... # 결과 리포트의 상태 체크섬",
    "",
    "선택:",
    "  --out=output/manual-balance-playlog.json",
    "  --start --id=RUN1 --difficulty=normal --stage=1 --seed=RUN123 --startedAt=ISO",
    "                          # 수동 플레이 시작 마커를 pendingSessions에 저장",
    "  --start-next --seed=RUN123",
    "                          # 다음 필요 수동 세션의 난이도/목표로 시작 마커를 저장",
    "  --pending                # 아직 finish되지 않은 시작 마커 목록 출력",
    "  --finish=RUN1 --result=loss --round=40 --legends=1 --maxGrade=legend --dataVersion=RESULT_DATA_VERSION --stateChecksum=RESULT_CHECKSUM",
    "                          # 시작 마커의 startedAt/difficulty/stage/seed를 사용해 결과 세션 저장",
    "  --finish-latest --result=loss --round=40 --legends=1 --maxGrade=legend --dataVersion=RESULT_DATA_VERSION --stateChecksum=RESULT_CHECKSUM",
    "                          # 가장 최근 시작 마커를 자동 선택해 결과 세션 저장",
    "  --finish                 # --finish-latest와 동일",
    "  --summary             # 현재 수동 로그 충족/미충족 항목만 출력",
    "  --summary --json      # 현재 수동 로그 상태를 JSON으로 출력",
    "  --plan                # 남은 120분 수동 플레이 증거 수집 순서 출력",
    "  --plan --json         # 남은 수동 플레이 계획을 JSON으로 출력",
    "  --next                # 바로 다음에 필요한 수동 플레이 세션 1개만 출력",
    "  --next --json         # 다음 필요 세션을 JSON으로 출력",
    "                        # --next/--plan 출력에는 다음 세션 시작 마커 명령 템플릿도 포함",
    "  --assert              # 수동 증거가 모두 충족되지 않으면 실패 코드로 종료",
    "  --notes=...",
    "  --startedAt=ISO --endedAt=ISO",
  ].join("\n");
}

function fail(message) {
  console.error(message);
  console.error("");
  console.error(usage());
  process.exit(1);
}

function readJson(path) {
  if (!existsSync(path)) return { sessions: [] };
  const raw = readFileSync(path, "utf8").trim();
  if (!raw) return { sessions: [] };
  const data = JSON.parse(raw);
  if (!Array.isArray(data.sessions)) data.sessions = [];
  if (!Array.isArray(data.pendingSessions)) data.pendingSessions = [];
  return data;
}

function asNumber(name) {
  if (args[name] === undefined) return undefined;
  const value = Number(args[name]);
  if (!Number.isFinite(value)) fail(`--${name} 값이 숫자가 아닙니다: ${args[name]}`);
  return value;
}

function requireNumber(name) {
  if (args[name] === undefined) fail(`--${name} 값이 필요합니다.`);
  return asNumber(name);
}

function optionalNumber(name, fallback) {
  const raw = args[name] ?? fallback;
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) fail(`--${name} 값이 숫자가 아닙니다: ${raw}`);
  return value;
}

function durationSeconds() {
  if (computedSeconds !== undefined) return computedSeconds;
  return minutes * 60;
}

function parseDate(name, value) {
  if (!value) return undefined;
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) fail(`--${name} 값이 ISO 날짜가 아닙니다: ${value}`);
  return date;
}

function sessionsTotalMinutes(log) {
  return log.sessions.reduce((sum, session) => {
    if (typeof session.minutes === "number") return sum + session.minutes;
    if (typeof session.seconds === "number") return sum + (session.seconds / 60);
    return sum;
  }, 0);
}

function coveredDifficulties(log) {
  return new Set(log.sessions.map((s) => s.difficulty).filter(Boolean));
}

function isLegendMetadataConsistent(maxGrade, legends) {
  const maxGradeIsLegendOrHidden = maxGrade === "legend" || maxGrade === "hidden";
  return maxGradeIsLegendOrHidden ? legends > 0 : legends === 0;
}

function isExampleManualLog(log) {
  return log?.example === true || log?.fixture === true;
}

function isExampleManualSession(session) {
  return session?.example === true || session?.fixture === true || session?.source === "example";
}

function sessionResult(session) {
  if (typeof session.result === "string") return session.result.toLowerCase();
  if (typeof session.cleared === "boolean") return session.cleared ? "clear" : "loss";
  return "";
}

function isClear(session) {
  return ["clear", "cleared", "win", "won", "victory"].includes(sessionResult(session));
}

function isLoss(session) {
  return ["loss", "lose", "lost", "fail", "failed", "defeat"].includes(sessionResult(session));
}

function sessionMinutes(session) {
  if (typeof session.minutes === "number") return session.minutes;
  if (typeof session.seconds === "number") return session.seconds / 60;
  return 0;
}

function reportedSessionSeconds(session) {
  if (typeof session.seconds === "number") return session.seconds;
  if (typeof session.minutes === "number") return session.minutes * 60;
  return 0;
}

function sessionTimeSpanSeconds(session) {
  if (!session.startedAt || !session.endedAt) return 0;
  const startedAt = new Date(String(session.startedAt)).getTime();
  const endedAt = new Date(String(session.endedAt)).getTime();
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt)) return 0;
  return (endedAt - startedAt) / 1000;
}

function hasValidManualTiming(session) {
  const reported = reportedSessionSeconds(session);
  const actual = sessionTimeSpanSeconds(session);
  if (reported <= 0 || actual <= 0) return false;
  const tolerance = Math.max(2, reported * 0.05);
  return Math.abs(actual - reported) <= tolerance;
}

function legendCount(session) {
  const value = Number(session.legends ?? session.legendOrBetter ?? session.legendOrBetterCount ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function hasCompleteManualMetadata(session) {
  const difficulty = String(session.difficulty ?? "");
  const result = sessionResult(session);
  const stageValue = Number(session.stage);
  const roundValue = Number(session.round);
  const legendsValue = legendCount(session);
  const maxGradeValue = String(session.maxGrade ?? "");
  const seedValue = String(session.seed ?? "");
  const dataVersionValue = String(session.dataVersion ?? "");
  const checksumValue = String(session.stateChecksum ?? "");
  return difficulties.includes(difficulty) &&
    ["clear", "cleared", "win", "won", "victory", "loss", "lose", "lost", "fail", "failed", "defeat", "quit"].includes(result) &&
    Number.isFinite(stageValue) && stageValue >= 1 &&
    Number.isFinite(roundValue) && roundValue >= 1 &&
    Number.isFinite(legendsValue) && legendsValue >= 0 &&
    grades.includes(maxGradeValue) &&
    isLegendMetadataConsistent(maxGradeValue, legendsValue) &&
    seedValue.length > 0 &&
    dataVersionValue.length > 0 &&
    /^[0-9a-f]{8}$/i.test(checksumValue);
}

function sessionValidationEntries(log) {
  if (!log || isExampleManualLog(log)) return [];
  const seenChecksums = new Set();
  return (log.sessions ?? [])
    .filter((session) => !isExampleManualSession(session))
    .map((session, index) => {
      const issues = [];
      if (!hasValidManualTiming(session)) {
        issues.push("startedAt/endedAt와 기록 시간이 맞지 않음");
      }
      if (!hasCompleteManualMetadata(session)) {
        issues.push("필수 결과 메타데이터 누락 또는 모순");
      }
      const checksum = String(session.stateChecksum ?? "").toLowerCase();
      if (issues.length === 0) {
        if (seenChecksums.has(checksum)) {
          issues.push("stateChecksum 중복");
        } else {
          seenChecksums.add(checksum);
        }
      }
      return { index, session, issues };
    });
}

function realManualSessions(log) {
  return sessionValidationEntries(log)
    .filter((entry) => entry.issues.length === 0)
    .map((entry) => entry.session);
}

function invalidManualSessions(log) {
  return sessionValidationEntries(log)
    .filter((entry) => entry.issues.length > 0)
    .map(({ index, session, issues }) => {
      const checksum = String(session.stateChecksum ?? "").slice(0, 8);
      return {
        index,
        difficulty: String(session.difficulty ?? ""),
        result: sessionResult(session) || "",
        round: Number(session.round ?? 0),
        seed: String(session.seed ?? ""),
        checksum,
        minutes: sessionMinutes(session),
        issues,
      };
    });
}

function reachedFinalRound(session) {
  return Number(session.round ?? 0) >= 40;
}

function isTargetLength(session) {
  return sessionMinutes(session) >= 12;
}

function hasTargetSession(sessions, difficulty, predicate) {
  return sessions.some((session) => session.difficulty === difficulty && predicate(session));
}

function targetEvidence(sessions, difficulty, predicate) {
  const matched = sessions.filter((session) => session.difficulty === difficulty && predicate(session));
  if (matched.length === 0) return "증거 없음";
  return matched.map((session) => {
    const checksumText = String(session.stateChecksum ?? "").slice(0, 8);
    return `${sessionResult(session)} ${session.round}R ${legendCount(session)}전설+ ${sessionMinutes(session).toFixed(1)}분 #${checksumText}`;
  }).join("; ");
}

function shellArg(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function outPathArg() {
  return outPath === DEFAULT_MANUAL_LOG_PATH ? "" : ` --out=${shellArg(outPath)}`;
}

function startCommandTemplate(step) {
  if (!step || step.kind === "total-minutes") return "";
  const difficulty = step.difficulty === "any" ? "novice" : step.difficulty;
  return [
    "yarn manual-playlog --start",
    `--difficulty=${difficulty}`,
    "--stage=1",
    "--seed=GAME_SEED_HERE",
    `--notes=${shellArg(step.label)}`,
  ].join(" ") + outPathArg();
}

const targetPlans = [
  {
    label: "입문자 무전설 40R 클리어",
    difficulty: "novice",
    minutes: 12,
    goal: "전설 없이 40R 최종 보스 클리어",
    logHint: "result=clear round=40 legends=0 maxGrade=hero 이하",
    predicate: (session) => isTargetLength(session) && isClear(session) && reachedFinalRound(session) && legendCount(session) === 0,
  },
  {
    label: "일반 1~2전설 40R 클리어",
    difficulty: "normal",
    minutes: 12,
    goal: "전설 1~2개로 40R 최종 보스 클리어",
    logHint: "result=clear round=40 legends=1~2 maxGrade=legend",
    predicate: (session) => isTargetLength(session) && isClear(session) && reachedFinalRound(session) && legendCount(session) >= 1 && legendCount(session) <= 2,
  },
  {
    label: "중급자 5전설 이상 40R 클리어",
    difficulty: "intermediate",
    minutes: 12,
    goal: "전설 5개 이상으로 40R 최종 보스 클리어",
    logHint: "result=clear round=40 legends>=5 maxGrade=legend|hidden",
    predicate: (session) => isTargetLength(session) && isClear(session) && reachedFinalRound(session) && legendCount(session) >= 5,
  },
  {
    label: "고수 5전설 이하 40R 실패",
    difficulty: "expert",
    minutes: 12,
    goal: "전설 5개 이하 조건으로 40R까지 버틴 뒤 실패",
    logHint: "result=loss round=40 legends<=5",
    predicate: (session) => isTargetLength(session) && isLoss(session) && reachedFinalRound(session) && legendCount(session) <= 5,
  },
  {
    label: "고수 6전설 이상 40R 클리어",
    difficulty: "expert",
    minutes: 12,
    goal: "전설 6개 이상 성장 조건으로 40R 최종 보스 클리어",
    logHint: "result=clear round=40 legends>=6 maxGrade=legend|hidden",
    predicate: (session) => isTargetLength(session) && isClear(session) && reachedFinalRound(session) && legendCount(session) >= 6,
  },
  {
    label: "초고수 실패 기록",
    difficulty: "master",
    minutes: 12,
    goal: "제한 없이 플레이하되 실패 결과 기록",
    logHint: "result=loss legends=최종값",
    predicate: (session) => isTargetLength(session) && isLoss(session),
  },
];

function buildSummary() {
  const log = existsSync(outPath) ? readJson(outPath) : { sessions: [] };
  const allSessions = isExampleManualLog(log) ? [] : (log.sessions ?? []).filter((session) => !isExampleManualSession(session));
  const pending = isExampleManualLog(log) ? [] : pendingSessions(log).map(pendingSessionWithCommands);
  const validSessions = realManualSessions(log);
  const invalidSessions = invalidManualSessions(log);
  const totalMinutes = validSessions.reduce((sum, session) => sum + sessionMinutes(session), 0);
  const minutesByDifficulty = new Map();
  for (const session of validSessions) {
    minutesByDifficulty.set(session.difficulty, (minutesByDifficulty.get(session.difficulty) ?? 0) + sessionMinutes(session));
  }

  const rows = [
    {
      label: "수동 로그 무효 세션 없음",
      pass: invalidSessions.length === 0,
      evidence: invalidSessions.length === 0 ? "무효 세션 없음" : `${invalidSessions.length}개 무효 세션`,
      next: "INVALID 목록의 시간/메타데이터/checksum을 고치거나 해당 세션을 제거하세요.",
    },
    {
      label: "사람이 직접 2시간 플레이",
      pass: totalMinutes >= 120 && difficulties.every((id) => (minutesByDifficulty.get(id) ?? 0) >= 12),
      evidence: `${validSessions.length}/${allSessions.length}세션, ${totalMinutes.toFixed(1)}/120.0분, ${difficulties.map((id) => `${id} ${(minutesByDifficulty.get(id) ?? 0).toFixed(1)}분`).join(", ")}`,
      next: "총 120분 이상과 각 난이도 12분 이상을 채우세요.",
    },
    {
      label: "입문자 무전설 40R 클리어",
      pass: hasTargetSession(validSessions, "novice", (session) => isTargetLength(session) && isClear(session) && reachedFinalRound(session) && legendCount(session) === 0),
      evidence: targetEvidence(validSessions, "novice", (session) => isTargetLength(session) && isClear(session) && reachedFinalRound(session) && legendCount(session) === 0),
      next: "novice clear 40R legends=0 maxGrade=hero 이하 세션 12분 이상",
    },
    {
      label: "일반 1~2전설 40R 클리어",
      pass: hasTargetSession(validSessions, "normal", (session) => isTargetLength(session) && isClear(session) && reachedFinalRound(session) && legendCount(session) >= 1 && legendCount(session) <= 2),
      evidence: targetEvidence(validSessions, "normal", (session) => isTargetLength(session) && isClear(session) && reachedFinalRound(session) && legendCount(session) >= 1 && legendCount(session) <= 2),
      next: "normal clear 40R legends=1~2 세션 12분 이상",
    },
    {
      label: "중급자 5전설 이상 40R 클리어",
      pass: hasTargetSession(validSessions, "intermediate", (session) => isTargetLength(session) && isClear(session) && reachedFinalRound(session) && legendCount(session) >= 5),
      evidence: targetEvidence(validSessions, "intermediate", (session) => isTargetLength(session) && isClear(session) && reachedFinalRound(session) && legendCount(session) >= 5),
      next: "intermediate clear 40R legends>=5 세션 12분 이상",
    },
    {
      label: "고수 5전설 이하 40R 실패",
      pass: hasTargetSession(validSessions, "expert", (session) => isTargetLength(session) && isLoss(session) && reachedFinalRound(session) && legendCount(session) <= 5),
      evidence: targetEvidence(validSessions, "expert", (session) => isTargetLength(session) && isLoss(session) && reachedFinalRound(session) && legendCount(session) <= 5),
      next: "expert loss 40R legends<=5 세션 12분 이상",
    },
    {
      label: "고수 6전설 이상 40R 클리어",
      pass: hasTargetSession(validSessions, "expert", (session) => isTargetLength(session) && isClear(session) && reachedFinalRound(session) && legendCount(session) >= 6),
      evidence: targetEvidence(validSessions, "expert", (session) => isTargetLength(session) && isClear(session) && reachedFinalRound(session) && legendCount(session) >= 6),
      next: "expert clear 40R legends>=6 세션 12분 이상",
    },
    {
      label: "초고수 실패 기록",
      pass: hasTargetSession(validSessions, "master", (session) => isTargetLength(session) && isLoss(session)),
      evidence: targetEvidence(validSessions, "master", (session) => isTargetLength(session) && isLoss(session)),
      next: "master loss 세션 12분 이상",
    },
  ];
  const targetRows = rows.filter((row) => targetPlans.some((target) => target.label === row.label));
  const targetRowsPassed = targetRows.filter((row) => row.pass).length;

  const summary = {
    schemaVersion: 1,
    logPath: outPath,
    logExists: existsSync(outPath),
    exampleExcluded: isExampleManualLog(log),
    nonExampleSessionCount: allSessions.length,
    validSessionCount: validSessions.length,
    invalidSessionCount: invalidSessions.length,
    invalidSessions,
    pendingCount: pending.length,
    pending,
    totalMinutes,
    requiredMinutes: 120,
    remainingMinutes: Math.max(0, 120 - totalMinutes),
    minutesByDifficulty: Object.fromEntries(difficulties.map((id) => [id, minutesByDifficulty.get(id) ?? 0])),
    targetRowsPassed,
    targetRowsTotal: targetRows.length,
    targetRowsRemaining: targetRows.length - targetRowsPassed,
    rows,
    passed: rows.every((row) => row.pass),
  };
  summary.next = buildNextFromSummary(summary).next;
  return summary;
}

function buildPlan() {
  return buildPlanFromSummary(buildSummary());
}

function buildPlanFromSummary(summary) {
  const missingTargets = targetPlans.filter((target) => {
    const row = summary.rows.find((item) => item.label === target.label);
    return !row?.pass;
  });
  const projectedMinutesByDifficulty = new Map(Object.entries(summary.minutesByDifficulty));
  let projectedTotalMinutes = summary.totalMinutes;
  for (const target of missingTargets) {
    projectedMinutesByDifficulty.set(
      target.difficulty,
      Number(projectedMinutesByDifficulty.get(target.difficulty) ?? 0) + target.minutes,
    );
    projectedTotalMinutes += target.minutes;
  }

  const difficultyTopUps = difficulties
    .map((difficulty) => ({
      difficulty,
      minutes: Math.max(0, 12 - Number(projectedMinutesByDifficulty.get(difficulty) ?? 0)),
    }))
    .filter((item) => item.minutes > 0);
  const projectedAfterDifficultyTopUps = projectedTotalMinutes +
    difficultyTopUps.reduce((sum, item) => sum + item.minutes, 0);
  const flexibleMinutes = Math.max(0, summary.requiredMinutes - projectedAfterDifficultyTopUps);

  return {
    schemaVersion: 1,
    logPath: summary.logPath,
    passed: summary.passed,
    current: {
      totalMinutes: summary.totalMinutes,
      requiredMinutes: summary.requiredMinutes,
      remainingMinutes: summary.remainingMinutes,
      minutesByDifficulty: summary.minutesByDifficulty,
      validSessionCount: summary.validSessionCount,
      invalidSessionCount: summary.invalidSessionCount,
      pendingCount: summary.pendingCount,
      targetRowsPassed: summary.targetRowsPassed,
      targetRowsTotal: summary.targetRowsTotal,
      targetRowsRemaining: summary.targetRowsRemaining,
    },
    steps: [
      ...missingTargets.map((target) => ({
        kind: "target-session",
        difficulty: target.difficulty,
        minutes: target.minutes,
        label: target.label,
        goal: target.goal,
        logHint: target.logHint,
        startCommandTemplate: startCommandTemplate(target),
        startNextCommandTemplate: startNextCommandTemplate(target),
        finishTemplate: finishTemplateForNext(target),
      })),
      ...difficultyTopUps.map((item) => ({
        kind: "difficulty-minimum",
        difficulty: item.difficulty,
        minutes: item.minutes,
        label: `${item.difficulty} 최소 시간 보충`,
        goal: `${item.difficulty} 난이도 유효 수동 플레이 ${item.minutes.toFixed(1)}분 추가`,
        logHint: "결과 화면의 yarn manual-playlog 명령 사용",
        startCommandTemplate: startCommandTemplate({
          difficulty: item.difficulty,
          label: `${item.difficulty} 최소 시간 보충`,
        }),
        startNextCommandTemplate: startNextCommandTemplate(item),
        finishTemplate: finishTemplateForNext(item),
      })),
      ...(flexibleMinutes > 0
        ? [{
          kind: "total-minutes",
          difficulty: "any",
          minutes: flexibleMinutes,
          label: "총 120분 보충",
          goal: `목표 세션 이후 남는 ${flexibleMinutes.toFixed(1)}분을 실제 플레이로 추가`,
          logHint: "요약 명령의 다음 필요 항목을 보며 어떤 난이도든 실제 결과 기록",
          startCommandTemplate: "",
          startNextCommandTemplate: startNextCommandTemplate({ difficulty: "any" }),
          finishTemplate: finishTemplateForNext(null),
        }]
        : []),
    ],
  };
}

function printSummary() {
  const summary = buildSummary();
  console.log("# 수동 플레이 로그 상태");
  console.log(`- 로그: ${summary.logPath}${summary.logExists ? "" : " (아직 없음)"}`);
  console.log(`- 예시 로그 제외: ${summary.exampleExcluded ? "예" : "아니오"}`);
  console.log(`- 무효 세션: ${summary.invalidSessionCount}개`);
  console.log(`- 시작 마커 대기: ${summary.pendingCount}개`);
  console.log(`- 유효 플레이 시간: ${summary.totalMinutes.toFixed(1)}/${summary.requiredMinutes.toFixed(1)}분, 남은 ${summary.remainingMinutes.toFixed(1)}분`);
  console.log(`- 목표 세션: ${summary.targetRowsPassed}/${summary.targetRowsTotal}개 완료, 남은 ${summary.targetRowsRemaining}개`);
  console.log("");
  if (summary.invalidSessionCount > 0) {
    console.log("INVALID 증거로 인정되지 않은 세션:");
    for (const session of summary.invalidSessions) {
      const label = [
        `#${session.index + 1}`,
        session.difficulty || "difficulty?",
        session.result || "result?",
        `${session.round || "?"}R`,
        session.seed ? `seed=${session.seed}` : "",
        session.checksum ? `#${session.checksum}` : "",
      ].filter(Boolean).join(" ");
      console.log(`  - ${label}: ${session.issues.join(", ")}`);
    }
    console.log("");
  }
  if (summary.pendingCount > 0) {
    console.log("PENDING 아직 finish되지 않은 시작 마커:");
    for (const session of summary.pending) {
      console.log(`  - ${session.id}: ${session.difficulty} stage=${session.stage} seed=${session.seed} startedAt=${session.startedAt}`);
      if (session.finishCommandTemplate) {
        console.log(`    마무리 템플릿: ${session.finishCommandTemplate}`);
      }
    }
    console.log("");
  }
  for (const row of summary.rows) {
    console.log(`${row.pass ? "PASS" : "MISSING"} ${row.label}: ${row.evidence}`);
    if (!row.pass) console.log(`  다음 필요: ${row.next}`);
  }
  const next = buildNext();
  if (next.next?.startNextCommandTemplate) {
    console.log("");
    console.log("추천 시작 마커:");
    console.log(next.next.startNextCommandTemplate);
    console.log("  GAME_SEED_HERE는 새 게임 시작 후 상단에 표시된 실제 시드로 바꾸세요.");
  }
  console.log("");
  console.log(`판정: ${summary.passed ? "수동 증거 충족" : "수동 증거 미충족"}`);
}

function printSummaryJson() {
  console.log(`${JSON.stringify(buildSummary(), null, 2)}`);
}

function printPlan() {
  const plan = buildPlan();
  console.log("# 수동 플레이 증거 수집 계획");
  console.log(`- 로그: ${plan.logPath}`);
  console.log(`- 현재: ${plan.current.validSessionCount}세션, ${plan.current.totalMinutes.toFixed(1)}/${plan.current.requiredMinutes.toFixed(1)}분`);
  console.log(`- 남은 유효 플레이 시간: ${plan.current.remainingMinutes.toFixed(1)}분`);
  console.log(`- 목표 세션: ${plan.current.targetRowsPassed}/${plan.current.targetRowsTotal}개 완료, 남은 ${plan.current.targetRowsRemaining}개`);
  console.log(`- 무효 세션: ${plan.current.invalidSessionCount}개`);
  console.log(`- 시작 마커 대기: ${plan.current.pendingCount}개`);
  console.log(`- 난이도별: ${difficulties.map((id) => `${id} ${Number(plan.current.minutesByDifficulty[id] ?? 0).toFixed(1)}분`).join(", ")}`);
  console.log("");
  if (plan.steps.length === 0) {
    console.log("PASS 수동 플레이 증거 계획상 남은 항목이 없습니다.");
  } else {
    plan.steps.forEach((step, index) => {
      console.log(`${index + 1}. ${step.label} (${step.minutes.toFixed(1)}분 이상)`);
      console.log(`   목표: ${step.goal}`);
      console.log(`   기록 힌트: ${step.logHint}`);
      if (step.finishTemplate) {
        console.log(`   마무리 조건: result=${step.finishTemplate.result} round=${step.finishTemplate.round} legends=${step.finishTemplate.legends} maxGrade=${step.finishTemplate.maxGrade}`);
      }
      if (step.startNextCommandTemplate) {
        console.log(`   추천 시작 마커: ${step.startNextCommandTemplate}`);
      }
      if (step.startCommandTemplate) {
        console.log(`   직접 시작 마커: ${step.startCommandTemplate}`);
      }
    });
  }
  console.log("");
  console.log(`판정: ${plan.passed ? "수동 증거 충족" : "수동 증거 미충족"}`);
}

function printPlanJson() {
  console.log(`${JSON.stringify(buildPlan(), null, 2)}`);
}

function buildNext() {
  return buildNextFromSummary(buildSummary());
}

function buildNextFromSummary(summary) {
  const plan = buildPlanFromSummary(summary);
  const nextStep = plan.steps[0] ?? null;
  return {
    schemaVersion: 1,
    logPath: plan.logPath,
    passed: plan.passed,
    current: plan.current,
    next: nextStep
      ? {
        ...nextStep,
        startNextCommandTemplate: startNextCommandTemplate(nextStep),
      }
      : null,
  };
}

function printNext() {
  const next = buildNext();
  console.log("# 다음 수동 플레이 세션");
  console.log(`- 로그: ${next.logPath}`);
  console.log(`- 현재: ${next.current.validSessionCount}세션, ${next.current.totalMinutes.toFixed(1)}/${next.current.requiredMinutes.toFixed(1)}분`);
  console.log("");
  if (!next.next) {
    console.log("PASS 다음에 필요한 수동 플레이 세션이 없습니다.");
  } else {
    console.log(`${next.next.label} (${next.next.minutes.toFixed(1)}분 이상)`);
    console.log(`목표: ${next.next.goal}`);
    console.log(`기록 힌트: ${next.next.logHint}`);
    if (next.next.finishTemplate) {
      console.log(`마무리 조건: result=${next.next.finishTemplate.result} round=${next.next.finishTemplate.round} legends=${next.next.finishTemplate.legends} maxGrade=${next.next.finishTemplate.maxGrade}`);
    }
    if (next.next.startNextCommandTemplate) {
      console.log("추천 시작 마커:");
      console.log(next.next.startNextCommandTemplate);
      console.log("  GAME_SEED_HERE는 새 게임 시작 후 상단에 표시된 실제 시드로 바꾸세요.");
    }
    if (next.next.startCommandTemplate) {
      console.log("직접 시작 마커:");
      console.log(next.next.startCommandTemplate);
      console.log("  GAME_SEED_HERE는 새 게임 시작 후 상단에 표시된 실제 시드로 바꾸세요.");
    }
  }
  console.log("");
  console.log(`판정: ${next.passed ? "수동 증거 충족" : "수동 증거 미충족"}`);
}

function printNextJson() {
  console.log(`${JSON.stringify(buildNext(), null, 2)}`);
}

function pendingSessions(log) {
  return (log.pendingSessions ?? []).filter((session) => !isExampleManualSession(session));
}

function targetPlanForPendingSession(session) {
  const notes = String(session?.notes ?? "");
  return targetPlans.find((target) => target.label === notes) ?? null;
}

function pendingSessionWithCommands(session) {
  const id = String(session.id ?? "");
  return {
    ...session,
    finishCommandTemplate: id
      ? finishCommandTemplate({ id, next: targetPlanForPendingSession(session) })
      : "",
  };
}

function latestPendingSession(log) {
  const pending = pendingSessions(log);
  return pending
    .slice()
    .sort((a, b) => {
      const aTime = new Date(String(a.startedAt ?? "")).getTime();
      const bTime = new Date(String(b.startedAt ?? "")).getTime();
      return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
    })[0] ?? null;
}

function findMatchingPendingSession(log, { difficulty, stage, seed, startedAt }) {
  if (!startedAt) return null;
  const startedAtMs = startedAt.getTime();
  const matches = pendingSessions(log).filter((session) => {
    const pendingStartedAtMs = new Date(String(session.startedAt ?? "")).getTime();
    return String(session.difficulty ?? "") === difficulty &&
      Number(session.stage) === Number(stage) &&
      String(session.seed ?? "") === seed &&
      Number.isFinite(pendingStartedAtMs) &&
      pendingStartedAtMs === startedAtMs;
  });
  return matches.length === 1 ? matches[0] : null;
}

function buildPending() {
  const log = readJson(outPath);
  const pending = pendingSessions(log).map(pendingSessionWithCommands);
  return {
    schemaVersion: 1,
    logPath: outPath,
    pendingCount: pending.length,
    pending,
  };
}

function printPending() {
  const pending = buildPending();
  console.log("# 수동 플레이 시작 마커");
  console.log(`- 로그: ${pending.logPath}`);
  console.log(`- 대기 중: ${pending.pendingCount}개`);
  console.log("");
  if (pending.pending.length === 0) {
    console.log("대기 중인 시작 마커가 없습니다.");
    return;
  }
  for (const session of pending.pending) {
    console.log(`- ${session.id}: ${session.difficulty} stage=${session.stage} seed=${session.seed} startedAt=${session.startedAt}`);
    if (session.finishCommandTemplate) {
      console.log(`  마무리 템플릿: ${session.finishCommandTemplate}`);
    }
  }
}

function printPendingJson() {
  console.log(`${JSON.stringify(buildPending(), null, 2)}`);
}

function assertManualProof() {
  const summary = buildSummary();
  if (summary.passed) {
    console.log("PASS 수동 플레이 증거 충족");
    return;
  }
  printSummary();
  const next = buildNext();
  if (next.next) {
    console.error("");
    console.error(`다음 필요 세션: ${next.next.label} (${next.next.minutes.toFixed(1)}분 이상)`);
    console.error(`목표: ${next.next.goal}`);
    if (next.next.startNextCommandTemplate) {
      console.error(`추천 시작 마커: ${next.next.startNextCommandTemplate}`);
    }
  }
  process.exit(1);
}

function makePendingId({ difficulty, stage, seed, startedAt }) {
  const suffix = String(startedAt).replace(/[^0-9A-Za-z]/g, "").slice(0, 20);
  return `${difficulty}-${stage}-${String(seed).replace(/[^0-9A-Za-z_-]/g, "")}-${suffix}`;
}

function finishTemplateForNext(step) {
  const base = {
    result: "loss",
    round: "ROUND_REACHED",
    legends: "FINAL_LEGENDS",
    maxGrade: "MAX_GRADE",
  };
  if (!step) return base;
  switch (step.label) {
    case "입문자 무전설 40R 클리어":
      return { result: "clear", round: "40", legends: "0", maxGrade: "hero" };
    case "일반 1~2전설 40R 클리어":
      return { result: "clear", round: "40", legends: "1", maxGrade: "legend" };
    case "중급자 5전설 이상 40R 클리어":
      return { result: "clear", round: "40", legends: "5", maxGrade: "legend" };
    case "고수 5전설 이하 40R 실패":
      return { result: "loss", round: "40", legends: "5", maxGrade: "legend" };
    case "고수 6전설 이상 40R 클리어":
      return { result: "clear", round: "40", legends: "6", maxGrade: "legend" };
    case "초고수 실패 기록":
      return { result: "loss", round: "ROUND_REACHED", legends: "FINAL_LEGENDS", maxGrade: "MAX_GRADE" };
    default:
      return base;
  }
}

function startNextCommandTemplate(step) {
  if (!step) return "";
  const difficultyArg = step.difficulty === "any" ? " --difficulty=DIFFICULTY" : "";
  return `yarn manual-playlog --start-next${difficultyArg} --seed=GAME_SEED_HERE${outPathArg()}`;
}

function finishCommandTemplate({ id, next }) {
  const template = finishTemplateForNext(next);
  return [
    `yarn manual-playlog --finish=${shellArg(id)}`,
    `--result=${template.result}`,
    `--round=${template.round}`,
    `--legends=${template.legends}`,
    `--maxGrade=${template.maxGrade}`,
    "--dataVersion=RESULT_DATA_VERSION",
    "--stateChecksum=RESULT_CHECKSUM",
    "--endedAt=RESULT_ENDED_AT",
  ].join(" ") + outPathArg();
}

function savePendingSession({ difficulty, stage, seed, startedAt, id, notes }) {
  const log = readJson(outPath);
  log.schemaVersion = 1;
  log.source = "manual-playlog";
  if ((log.pendingSessions ?? []).some((session) => String(session.id) === id)) {
    fail(`이미 같은 시작 마커가 있습니다: ${id}`);
  }
  log.pendingSessions = log.pendingSessions ?? [];
  log.pendingSessions.push({
    id,
    source: "human-playtest-start",
    difficulty,
    stage,
    seed,
    startedAt: startedAt.toISOString(),
    ...(notes ? { notes } : {}),
  });

  const dir = dirname(outPath);
  if (dir && dir !== ".") mkdirSync(dir, { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(log, null, 2)}\n`, "utf8");
}

function printStartSaved({ id, startedAt, next }) {
  console.log(`수동 플레이 시작 마커 저장: ${outPath}`);
  if (next?.label) {
    console.log(`- 목표: ${next.label}`);
    if (next.goal) console.log(`- 플레이 조건: ${next.goal}`);
    if (next.logHint) console.log(`- 기록 조건: ${next.logHint}`);
  }
  console.log(`- id: ${id}`);
  console.log(`- 시작: ${startedAt.toISOString()}`);
  console.log("");
  console.log("결과가 나오면 아래 형식으로 마무리하세요. RESULT_ENDED_AT은 결과 화면의 종료 시각을 사용하세요:");
  console.log(finishCommandTemplate({ id, next }));
}

function failIfPendingStartExists() {
  const pending = buildPending().pending;
  if (pending.length === 0) return;
  const first = pending[0];
  const lines = [
    `이미 finish되지 않은 수동 시작 마커가 ${pending.length}개 있습니다.`,
    "새 start-next를 만들기 전에 기존 시작 마커를 먼저 마무리하세요.",
  ];
  if (first?.finishCommandTemplate) {
    lines.push(`마무리 템플릿: ${first.finishCommandTemplate}`);
  }
  fail(lines.join("\n"));
}

function startManualSession() {
  const difficulty = String(args.difficulty ?? "");
  if (!difficulties.includes(difficulty)) {
    fail(`지원하지 않는 난이도입니다: ${difficulty || "(없음)"}`);
  }
  const stage = requireNumber("stage");
  const seed = String(args.seed ?? "");
  if (!seed) fail("--seed 값이 필요합니다.");
  const startedAt = parseDate("startedAt", args.startedAt) ?? new Date();
  const id = String(args.id ?? makePendingId({ difficulty, stage, seed, startedAt: startedAt.toISOString() }));
  if (!id.trim()) fail("--id 값이 비어 있습니다.");

  savePendingSession({
    id,
    difficulty,
    stage,
    seed,
    startedAt,
    notes: args.notes ? String(args.notes) : "",
  });

  printStartSaved({ id, startedAt });
}

function startNextManualSession() {
  failIfPendingStartExists();
  const next = buildNext().next;
  if (!next) {
    console.log("PASS 다음에 필요한 수동 플레이 세션이 없습니다.");
    return;
  }
  const requestedDifficulty = args.difficulty === undefined ? "" : String(args.difficulty);
  const difficulty = next.difficulty === "any"
    ? (requestedDifficulty || "novice")
    : (requestedDifficulty || next.difficulty);
  if (!difficulties.includes(difficulty)) {
    fail(`지원하지 않는 난이도입니다: ${difficulty || "(없음)"}`);
  }
  if (next.difficulty !== "any" && requestedDifficulty && requestedDifficulty !== next.difficulty) {
    fail(`다음 필요 세션은 ${next.difficulty} 난이도입니다. --difficulty=${requestedDifficulty}로 시작할 수 없습니다.`);
  }
  const stage = optionalNumber("stage", 1);
  const seed = String(args.seed ?? "");
  if (!seed) fail("--seed 값이 필요합니다.");
  const startedAt = parseDate("startedAt", args.startedAt) ?? new Date();
  const id = String(args.id ?? makePendingId({ difficulty, stage, seed, startedAt: startedAt.toISOString() }));
  if (!id.trim()) fail("--id 값이 비어 있습니다.");
  savePendingSession({
    id,
    difficulty,
    stage,
    seed,
    startedAt,
    notes: args.notes ? String(args.notes) : String(next.label),
  });
  printStartSaved({ id, startedAt, next });
}

if (args.summary === "true" || args.status === "true") {
  if (args.json === "true" || args["summary-json"] === "true") printSummaryJson();
  else printSummary();
  process.exit(0);
}

if (args.plan === "true") {
  if (args.json === "true" || args["plan-json"] === "true") printPlanJson();
  else printPlan();
  process.exit(0);
}

if (args.next === "true") {
  if (args.json === "true" || args["next-json"] === "true") printNextJson();
  else printNext();
  process.exit(0);
}

if (args.pending === "true") {
  if (args.json === "true" || args["pending-json"] === "true") printPendingJson();
  else printPending();
  process.exit(0);
}

if (args.assert === "true") {
  assertManualProof();
  process.exit(0);
}

if (args["summary-json"] === "true") {
  printSummaryJson();
  process.exit(0);
}

if (args["plan-json"] === "true") {
  printPlanJson();
  process.exit(0);
}

if (args["next-json"] === "true") {
  printNextJson();
  process.exit(0);
}

if (args["pending-json"] === "true") {
  printPendingJson();
  process.exit(0);
}

if (args["start-next"] === "true") {
  startNextManualSession();
  process.exit(0);
}

if (args.start === "true") {
  startManualSession();
  process.exit(0);
}

const explicitFinishId = typeof args.finish === "string" && args.finish !== "true" ? args.finish : "";
const finishLatest = args["finish-latest"] === "true" || args.finish === "true";
const finishLog = explicitFinishId || finishLatest ? readJson(outPath) : null;
const latestPending = finishLatest ? latestPendingSession(finishLog) : null;
const requestedFinishId = explicitFinishId || (latestPending ? String(latestPending.id) : "");
const requestedPendingFinish = requestedFinishId
  ? pendingSessions(finishLog).find((session) => String(session.id) === requestedFinishId)
  : null;
if (finishLatest && !latestPending) {
  fail("--finish-latest에 사용할 시작 마커가 없습니다.");
}
if (requestedFinishId && !requestedPendingFinish) {
  fail(`--finish 시작 마커를 찾을 수 없습니다: ${requestedFinishId}`);
}

const difficulty = args.difficulty ?? requestedPendingFinish?.difficulty;
if (!difficulties.includes(difficulty)) {
  fail(`지원하지 않는 난이도입니다: ${difficulty ?? "(없음)"}`);
}

const result = String(args.result ?? "").toLowerCase();
if (!results.includes(result)) {
  fail(`--result 값은 ${results.join("|")} 중 하나여야 합니다.`);
}

const stage = optionalNumber("stage", requestedPendingFinish?.stage);
if (stage === undefined) fail("--stage 값이 필요합니다.");
const round = requireNumber("round");
const legends = requireNumber("legends");
const seed = String(args.seed ?? requestedPendingFinish?.seed ?? "");
if (!seed) fail("--seed 값이 필요합니다.");

const maxGrade = String(args.maxGrade ?? "");
if (!grades.includes(maxGrade)) {
  fail(`--maxGrade 값은 ${grades.join("|")} 중 하나여야 합니다.`);
}
const dataVersion = String(args.dataVersion ?? "");
if (!dataVersion) fail("--dataVersion 값이 필요합니다.");
const stateChecksum = String(args.stateChecksum ?? "");
if (!/^[0-9a-f]{8}$/i.test(stateChecksum)) {
  fail("--stateChecksum 값은 결과 리포트의 8자리 16진 체크섬이어야 합니다.");
}
if (stage < 1 || round < 1 || legends < 0) {
  fail("--stage/--round는 1 이상, --legends는 0 이상이어야 합니다.");
}
if (!isLegendMetadataConsistent(maxGrade, legends)) {
  fail("--legends와 --maxGrade가 모순됩니다. 전설 이상 보유 수와 최고 등급을 결과 리포트 그대로 입력하세요.");
}

const minutes = asNumber("minutes");
const seconds = asNumber("seconds");
const now = new Date();
let endedAt = parseDate("endedAt", args.endedAt) ?? now;
let startedAt = parseDate("startedAt", args.startedAt ?? requestedPendingFinish?.startedAt);
let computedSeconds = seconds;
if (minutes === undefined && seconds === undefined && startedAt) {
  computedSeconds = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);
}
if (minutes === undefined && computedSeconds === undefined) {
  fail("--minutes 또는 --seconds 중 하나가 필요합니다.");
}
if ((minutes ?? 0) <= 0 && (computedSeconds ?? 0) <= 0) {
  fail("플레이 시간은 0보다 커야 합니다.");
}

const duration = durationSeconds();
if (!startedAt) {
  startedAt = new Date(endedAt.getTime() - (duration * 1000));
}
const actualDuration = (endedAt.getTime() - startedAt.getTime()) / 1000;
const tolerance = Math.max(2, duration * 0.05);
if (actualDuration <= 0) {
  fail("--endedAt은 --startedAt보다 늦어야 합니다.");
}
if (Math.abs(actualDuration - duration) > tolerance) {
  fail(`입력한 플레이 시간(${duration.toFixed(0)}초)과 startedAt/endedAt 차이(${actualDuration.toFixed(0)}초)가 맞지 않습니다.`);
}

const log = finishLog ?? readJson(outPath);
const autoPendingFinish = requestedFinishId
  ? null
  : findMatchingPendingSession(log, { difficulty, stage, seed, startedAt });
const finishId = requestedFinishId || (autoPendingFinish ? String(autoPendingFinish.id) : "");
const linkedPendingSession = requestedPendingFinish ?? autoPendingFinish;
const linkedTargetPlan = targetPlanForPendingSession(linkedPendingSession);

const session = {
  source: "human-playtest",
  difficulty,
  ...(minutes !== undefined ? { minutes } : { seconds: computedSeconds }),
  startedAt: startedAt.toISOString(),
  endedAt: endedAt.toISOString(),
  ...(finishId ? { pendingSessionId: finishId } : {}),
  result,
  stage,
  round,
  seed,
  legends,
  maxGrade,
  dataVersion,
  stateChecksum: stateChecksum.toLowerCase(),
  ...(args.notes ? { notes: String(args.notes) } : {}),
};

log.schemaVersion = 1;
log.source = "manual-playlog";
if (log.sessions.some((s) => String(s.stateChecksum ?? "").toLowerCase() === stateChecksum.toLowerCase())) {
  fail(`이미 같은 결과 체크섬이 기록되어 있습니다: ${stateChecksum.toLowerCase()}`);
}
log.sessions.push(session);
if (finishId) {
  log.pendingSessions = pendingSessions(log).filter((pending) => String(pending.id) !== finishId);
}
log.totalMinutes = sessionsTotalMinutes(log);

const dir = dirname(outPath);
if (dir && dir !== ".") mkdirSync(dir, { recursive: true });
writeFileSync(outPath, `${JSON.stringify(log, null, 2)}\n`, "utf8");

const total = log.totalMinutes;
const covered = coveredDifficulties(log);
const missing = difficulties.filter((d) => !covered.has(d));
const summaryAfterSave = buildSummary();

console.log(`수동 플레이 로그 저장: ${outPath}`);
console.log(`- 추가 세션: ${difficulty}, ${(minutes ?? computedSeconds / 60).toFixed(1)}분`);
if (autoPendingFinish) console.log(`- 연결된 시작 마커: ${finishId}`);
if (linkedTargetPlan) {
  const targetMet = linkedTargetPlan.predicate(session);
  console.log(`- 시작 마커 목표: ${linkedTargetPlan.label} ${targetMet ? "충족" : "미충족"}`);
  if (!targetMet) console.log("- 이 세션은 실제 플레이 시간으로 저장됐지만 목표 증거 행은 아직 남아 있습니다.");
}
console.log(`- 누적 시간: ${total.toFixed(1)}분 / 120.0분`);
console.log(`- 남은 유효 플레이 시간: ${summaryAfterSave.remainingMinutes.toFixed(1)}분`);
console.log(`- 목표 세션: ${summaryAfterSave.targetRowsPassed}/${summaryAfterSave.targetRowsTotal}개 완료, 남은 ${summaryAfterSave.targetRowsRemaining}개`);
console.log(`- 난이도 커버: ${[...covered].join(", ") || "없음"}`);
console.log(`- 남은 난이도: ${missing.join(", ") || "없음"}`);
console.log(`- 감사 통과 조건: ${summaryAfterSave.passed ? "충족" : "미충족"}`);

const nextAfterSave = buildNextFromSummary(summaryAfterSave).next;
console.log("");
if (nextAfterSave) {
  console.log(`다음 필요 세션: ${nextAfterSave.label} (${nextAfterSave.minutes.toFixed(1)}분 이상)`);
  console.log(`- 목표: ${nextAfterSave.goal}`);
  console.log(`- 추천 시작 마커: ${nextAfterSave.startNextCommandTemplate}`);
} else {
  console.log("PASS 다음에 필요한 수동 플레이 세션이 없습니다.");
}
