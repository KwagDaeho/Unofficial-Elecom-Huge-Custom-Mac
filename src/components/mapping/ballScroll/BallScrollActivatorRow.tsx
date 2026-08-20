import { ballScrollActivatorForSlot } from "@/domain/profile";
import { formatActivator } from "@/i18n";
import { Button, Muted, Toggle } from "@/components/ui";
import type {
  BallScrollSlot,
  Dict,
  Lang,
  ResolvedBallScrollSettings,
} from "@/types";
import * as styles from "./BallScrollActivatorRow.css";

interface BallScrollActivatorRowProps {
  slot: BallScrollSlot;
  ball: ResolvedBallScrollSettings;
  lang: Lang;
  i18n: Dict;
  onOpenCapture: (slot: BallScrollSlot) => void;
  onEnableChange: (slot: BallScrollSlot, enabled: boolean) => void;
  onClear: (slot: BallScrollSlot) => void;
}

export const BallScrollActivatorRow = (props: BallScrollActivatorRowProps) => {
  const isToggle = props.slot === "toggle";
  const activator = ballScrollActivatorForSlot(props.ball, props.slot);
  const enabled = isToggle ? props.ball.toggleEnabled : props.ball.holdEnabled;
  const label = isToggle
    ? props.i18n.ballScrollToggle
    : props.i18n.ballScrollHold;
  const helpText = isToggle
    ? props.i18n.ballScrollToggleHelp
    : props.i18n.ballScrollHoldHelp;
  return (
    <div className={styles.row}>
      <span>{label}</span>
      <Toggle
        variant="flag"
        checked={enabled}
        onChange={(on) => props.onEnableChange(props.slot, on)}
      />
      <div className={styles.key}>
        <Button size="tiny" onClick={() => props.onOpenCapture(props.slot)}>
          {activator !== null
            ? formatActivator(activator, props.lang)
            : props.i18n.ballScrollKey}
        </Button>
        {activator !== null ? (
          <Button
            variant="ghost"
            size="tiny"
            onClick={() => props.onClear(props.slot)}
          >
            {props.i18n.clear}
          </Button>
        ) : null}
      </div>
      <Muted as="p" className={styles.help}>
        {helpText}
      </Muted>
    </div>
  );
};
