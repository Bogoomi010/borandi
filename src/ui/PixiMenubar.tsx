import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Application, extend, type PixiReactElementProps } from "@pixi/react";
import { Container, Graphics, Text } from "pixi.js";
import type { MenuCommand, RuntimeSnapshot } from "../runtimeBridge";
import { getRuntimeControls } from "../runtimeBridge";
import { canOpenAppDataDir } from "../save/saveApi";
import { getLocale, onLocaleChange, t } from "../i18n";

extend({ Container, Graphics, Text });

type GraphicsDraw = NonNullable<PixiReactElementProps<typeof Graphics>["draw"]>;
type MenuEntry = MenuItem | "sep";

const MENUBAR_H = 22;
const DROP_W = 230;
const ROW_H = 26;
const SEP_H = 8;

interface PixiMenubarProps {
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
  items: MenuEntry[];
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

function useSurfaceSize(height: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1, height });

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    let raf = 0;
    let frames = 0;

    const resize = () => {
      const rect = element.getBoundingClientRect();
      setSize({
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      });
    };

    resize();
    const tick = () => {
      resize();
      frames += 1;
      if (frames < 60) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [height]);

  return { ref, size };
}

function menuButtonWidth(title: string) {
  return Math.max(54, Math.min(96, title.length * 12 + 26));
}

function dropHeight(items: MenuEntry[]) {
  return 8 + items.reduce((sum, item) => sum + (item === "sep" ? SEP_H : ROW_H), 0);
}

function PixiMenuBarStage({
  defs,
  onToggle,
  openIndex,
}: {
  defs: MenuDef[];
  onToggle: (index: number) => void;
  openIndex: number | null;
}) {
  let x = 0;

  return (
    <pixiContainer>
      {defs.map((menu, index) => {
        const width = menuButtonWidth(menu.title);
        const nextX = x;
        x += width + 2;
        return (
          <MenuTitle
            active={openIndex === index}
            key={menu.title}
            onPress={() => onToggle(index)}
            title={menu.title}
            width={width}
            x={nextX}
          />
        );
      })}
    </pixiContainer>
  );
}

function MenuTitle({
  active,
  onPress,
  title,
  width,
  x,
}: {
  active: boolean;
  onPress: () => void;
  title: string;
  width: number;
  x: number;
}) {
  const [hovered, setHovered] = useState(false);
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.rect(0, 0, width, MENUBAR_H).fill({ color: 0x000000, alpha: 0.001 });
    if (hovered || active) {
      g.roundRect(0, 1, width, MENUBAR_H - 2, 4).fill({ color: active ? 0x2a3544 : 0x232b36, alpha: 0.95 });
      g.roundRect(0, 1, width, MENUBAR_H - 2, 4).stroke({ color: active ? 0x4aa3ff : 0x384452, width: 1, alpha: 0.85 });
    }
  }, [active, hovered, width]);

  return (
    <pixiContainer
      cursor="pointer"
      eventMode="static"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerTap={onPress}
      x={x}
    >
      <pixiGraphics draw={draw} />
      <pixiText
        eventMode="none"
        text={title}
        x={10}
        y={4}
        style={{
          fill: active || hovered ? 0xeef3fa : 0x9fb2c7,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 12,
          fontWeight: "bold" as const,
        }}
      />
    </pixiContainer>
  );
}

function PixiMenuDropStage({
  menu,
  onCommand,
}: {
  menu: MenuDef;
  onCommand: (command: MenuCommand) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const height = dropHeight(menu.items);
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.roundRect(0, 0, DROP_W, height, 8).fill({ color: 0x141a22, alpha: 0.98 });
    g.roundRect(0, 0, DROP_W, height, 8).stroke({ color: 0x4aa3ff, width: 1, alpha: 0.65 });
  }, [height]);

  let y = 4;

  return (
    <pixiContainer>
      <pixiGraphics draw={draw} />
      {menu.items.map((entry, index) => {
        const nextY = y;
        y += entry === "sep" ? SEP_H : ROW_H;
        if (entry === "sep") return <MenuSep key={`sep-${index}`} y={nextY} />;
        return (
          <MenuRow
            item={entry}
            key={entry.command}
            onCommand={onCommand}
            onHover={() => setHovered(index)}
            onLeave={() => setHovered((current) => current === index ? null : current)}
            active={hovered === index}
            y={nextY}
          />
        );
      })}
    </pixiContainer>
  );
}

function MenuSep({ y }: { y: number }) {
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.rect(8, 3, DROP_W - 16, 1).fill({ color: 0x384452, alpha: 0.72 });
  }, []);
  return <pixiGraphics draw={draw} y={y} />;
}

function MenuRow({
  active,
  item,
  onCommand,
  onHover,
  onLeave,
  y,
}: {
  active: boolean;
  item: MenuItem;
  onCommand: (command: MenuCommand) => void;
  onHover: () => void;
  onLeave: () => void;
  y: number;
}) {
  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.rect(0, 0, DROP_W, ROW_H).fill({ color: 0x000000, alpha: 0.001 });
    if (active && !item.disabled) {
      g.roundRect(4, 2, DROP_W - 8, ROW_H - 4, 4).fill({ color: 0x245fbd, alpha: 0.92 });
    }
  }, [active, item.disabled]);

  return (
    <pixiContainer
      cursor={item.disabled ? "default" : "pointer"}
      eventMode={item.disabled ? "none" : "static"}
      onPointerEnter={onHover}
      onPointerLeave={onLeave}
      onPointerTap={() => {
        if (!item.disabled) onCommand(item.command);
      }}
      y={y}
    >
      <pixiGraphics draw={draw} />
      <pixiText
        eventMode="none"
        text={item.label}
        x={14}
        y={7}
        style={{
          fill: item.disabled ? 0x657180 : active ? 0xffffff : 0xdbe7f5,
          fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
          fontSize: 12,
        }}
      />
      {item.hint ? (
        <pixiText
          anchor={{ x: 1, y: 0 }}
          eventMode="none"
          text={item.hint}
          x={DROP_W - 14}
          y={7}
          style={{
            fill: item.disabled ? 0x657180 : 0x9fb2c7,
            fontFamily: "Segoe UI, Malgun Gothic, sans-serif",
            fontSize: 11,
          }}
        />
      ) : null}
    </pixiContainer>
  );
}

export function PixiMenubar({ runtime }: PixiMenubarProps) {
  useSyncExternalStore(onLocaleChange, getLocale, getLocale);
  const rootRef = useRef<HTMLDivElement>(null);
  const { ref: surfaceRef, size } = useSurfaceSize(MENUBAR_H);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const defs = menuDefs();
  const openMenu = openIndex === null ? null : defs[openIndex] ?? null;
  const openX = useMemo(() => {
    if (openIndex === null) return 0;
    let x = 0;
    for (let index = 0; index < openIndex; index += 1) {
      x += menuButtonWidth(defs[index].title) + 2;
    }
    return x;
  }, [defs, openIndex]);

  useEffect(() => {
    if (openIndex === null) return undefined;
    const close = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpenIndex(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [openIndex]);

  if (!runtime || runtime.scene !== "game") {
    return <div ref={rootRef} className="pixi-menubar-root"><div ref={surfaceRef} className="pixi-menubar-surface" /></div>;
  }

  return (
    <div ref={rootRef} className="pixi-menubar-root">
      <div ref={surfaceRef} className="pixi-menubar-surface">
        <Application key={`${size.width}x${size.height}`} width={size.width} height={size.height} backgroundAlpha={0} antialias>
          <PixiMenuBarStage
            defs={defs}
            onToggle={(index) => setOpenIndex((current) => current === index ? null : index)}
            openIndex={openIndex}
          />
        </Application>
      </div>
      {openMenu ? (
        <div className="pixi-menu-drop-surface" style={{ height: dropHeight(openMenu.items), left: openX, width: DROP_W }}>
          <Application key={`${openMenu.title}-${dropHeight(openMenu.items)}`} width={DROP_W} height={dropHeight(openMenu.items)} backgroundAlpha={0} antialias>
            <PixiMenuDropStage
              menu={openMenu}
              onCommand={(command) => {
                setOpenIndex(null);
                getRuntimeControls()?.menuCommand(command);
              }}
            />
          </Application>
        </div>
      ) : null}
    </div>
  );
}
