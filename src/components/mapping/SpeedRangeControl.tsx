interface SpeedRangeControlProps {
  label: string;
  display: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}
export const SpeedRangeControl = (props: SpeedRangeControlProps) => {
  return (
    <label>
      {props.label} {props.display}
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(event) => props.onChange(Number(event.target.value))}
      />
    </label>
  );
};
