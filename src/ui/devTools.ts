// ⚠ DEV전용 — 원하는 유닛을 즉시 생성하는 테스트 팝업. 출시 전 제거 예정.
// 제거 방법: 이 파일 삭제 + main.ts의 백틱(`) 키 핸들러 + engine "devSpawn" 케이스 + types의 "devSpawn" 제거.

import type { AppCtx } from "./ctx";
import { openModal, el, toast } from "./widgets";
import { UNITS } from "../data/units";
import { GRADE_ORDER, GRADE_LABEL, FAMILY_LABEL } from "../core/types";

export function openDevSpawnModal(ctx: AppCtx) {
  openModal((body, close) => {
    body.appendChild(el("h2", "", "🛠 DEV — 유닛 즉시 생성"));
    body.appendChild(el("div", "meta", "테스트용. 클릭하면 보유칸/골드 무시하고 즉시 생성됩니다."));

    for (const grade of GRADE_ORDER) {
      const units = UNITS.filter((u) => u.grade === grade);
      if (units.length === 0) continue;
      body.appendChild(el("h3", "", GRADE_LABEL[grade]));
      const grid = el("div", "choice-grid");
      for (const u of units) {
        const b = el("button", "choice-btn") as HTMLButtonElement;
        b.appendChild(el("span", "cname", u.name));
        b.appendChild(el("span", "cdesc", `${FAMILY_LABEL[u.family]} · ATK ${u.attack}`));
        b.onclick = () => {
          if (ctx.act("devSpawn", { defId: u.id })) {
            toast(`생성: ${u.name}`, "ok", 1200);
            ctx.refresh();
          }
        };
        grid.appendChild(b);
      }
      body.appendChild(grid);
    }

    const row = el("div", "row-btns");
    const closeBtn = el("button", "", "닫기");
    closeBtn.onclick = close;
    row.appendChild(closeBtn);
    body.appendChild(row);
  });
}
