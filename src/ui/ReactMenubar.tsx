import { useState, useSyncExternalStore } from "react";
import type { RuntimeSnapshot } from "../runtimeBridge";
import { getRuntimeControls, type MenuCommand } from "../runtimeBridge";
import { canOpenAppDataDir } from "../save/saveApi";
import { getLocale, onLocaleChange, t } from "../i18n";

interface ReactMenubarProps {
  runtime: RuntimeSnapshot | null;
}

interface MenuItem {
  label: string;
  hint?: string;
  command: MenuCommand;
  disabled?: boolean;
}

interface MenuDef {
  title: string;
  items: Array<MenuItem | "sep">;
}

function menuDefs(): MenuDef[] {
  return [
    {
      title: t("menu.game"),
      items: [
        { label: t("menu.newRun"), command: "newRun" },
        { label: t("menu.restartSeed"), command: "restartSeed" },
        "sep",
        { label: t("menu.save"), hint: t("menu.save.hint"), command: "save" },
        { label: t("menu.load"), command: "load" },
        "sep",
        { label: t("menu.exportReport"), command: "exportReport" },
        "sep",
        { label: t("menu.toTitle"), command: "toTitle" },
        { label: t("menu.quit"), command: "quit" },
      ],
    },
    {
      title: t("menu.view"),
      items: [
        { label: t("menu.toggleRightPanel"), command: "toggleRightPanel" },
        "sep",
        { label: t("menu.fullscreen"), hint: "F11", command: "fullscreen" },
      ],
    },
    {
      title: t("menu.tools"),
      items: [
        { label: t("menu.sim100"), command: "sim100" },
        { label: t("menu.balanceGate"), command: "balanceGate" },
        { label: t("menu.manualProof"), command: "manualProof" },
        "sep",
        { label: t("menu.openDataDir"), command: "openDataDir", disabled: !canOpenAppDataDir() },
      ],
    },
    {
      title: t("menu.help"),
      items: [
        { label: t("menu.shortcuts"), command: "shortcuts" },
        { label: t("menu.collection"), command: "collection" },
        { label: t("menu.options"), hint: "Esc", command: "options" },
        { label: t("menu.about"), command: "about" },
      ],
    },
  ];
}

export function ReactMenubar({ runtime }: ReactMenubarProps) {
  useSyncExternalStore(onLocaleChange, getLocale, getLocale);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const controls = getRuntimeControls();
  const defs = menuDefs();

  if (!runtime || runtime.scene !== "game") return null;

  return (
    <div className="react-menubar">
      {openIndex !== null ? (
        <button
          aria-label="Close menu"
          className="menu-backdrop"
          onClick={() => setOpenIndex(null)}
          type="button"
        />
      ) : null}
      {defs.map((menu, index) => (
        <div className={`menu-item${openIndex === index ? " open" : ""}`} key={menu.title}>
          <button
            onClick={(event) => {
              event.stopPropagation();
              setOpenIndex((current) => current === index ? null : index);
            }}
            type="button"
          >
            {menu.title}
          </button>
          {openIndex === index ? (
            <div className="menu-drop">
              {menu.items.map((item, itemIndex) => {
                if (item === "sep") return <div className="sep" key={`sep-${itemIndex}`} />;
                return (
                  <button
                    disabled={item.disabled}
                    key={item.command}
                    onClick={() => {
                      setOpenIndex(null);
                      controls?.menuCommand(item.command);
                    }}
                    type="button"
                  >
                    <span>{item.label}</span>
                    {item.hint ? <span className="hint">{item.hint}</span> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
