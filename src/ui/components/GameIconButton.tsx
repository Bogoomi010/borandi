import { GameButton, type GameButtonProps } from "./GameButton";

type GameIconButtonProps = Omit<GameButtonProps, "label" | "subLabel"> & {
  label?: string;
};

export function GameIconButton({ label = "", ...props }: GameIconButtonProps) {
  return <GameButton {...props} label={label} />;
}
