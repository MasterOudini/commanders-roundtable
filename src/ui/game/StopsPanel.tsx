import { useTable } from '../../store/tableStore';
import * as session from '../../game/session';
import { BTN_GHOST_SMALL, PANEL } from './styles';
import type { Step, StopPolicy } from '../../engine/types/state';

// The stops policy. This is the difference between "correct" and "playable":
// with it off you click Pass forty times a turn cycle, and with it wrong you
// miss the one window you cared about.
//
// ⚠️ The grid is `[my turn | others' turns] × [step]`, which is how a player
// thinks about it ("stop me at my own upkeep, never at anyone else's untap").
// The engine's `alwaysStop` is per-step; the "my turn" column is expressed by
// `stopOnMyUpkeep` plus the fact that most steps only matter on your own turn.

const STEPS: readonly { readonly step: Step; readonly label: string }[] = [
  { step: 'upkeep', label: 'Upkeep' },
  { step: 'draw', label: 'Draw' },
  { step: 'precombatMain', label: 'Main 1' },
  { step: 'beginCombat', label: 'Begin combat' },
  { step: 'declareAttackers', label: 'Attackers' },
  { step: 'declareBlockers', label: 'Blockers' },
  { step: 'firstStrikeDamage', label: 'First strike' },
  { step: 'combatDamage', label: 'Combat damage' },
  { step: 'endCombat', label: 'End of combat' },
  { step: 'postcombatMain', label: 'Main 2' },
  { step: 'end', label: 'End step' },
];

function Toggle({
  checked,
  onChange,
  label,
  name,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  name: string;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-crt-dim">
      <input
        type="checkbox"
        checked={checked}
        data-stop={name}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

export function StopsPanel({ stops }: { stops: StopPolicy | null }) {
  const open = useTable((s) => s.stopsOpen);
  const setOpen = useTable((s) => s.setStopsOpen);
  const viewer = useTable((s) => s.viewer);
  if (!open || !stops) return null;

  const update = (patch: Partial<StopPolicy>): void => {
    session.submit({ t: 'SetStops', player: viewer, stops: { ...stops, ...patch } });
  };

  return (
    <div
      className={`absolute right-2 top-10 z-[970] w-[260px] ${PANEL}`}
      data-stops-panel=""
    >
      <div className="flex items-center justify-between">
        <h2 className="font-sc text-xs tracking-wider text-crt-text">Stops</h2>
        <button type="button" className={BTN_GHOST_SMALL} onClick={() => setOpen(false)}>
          Close
        </button>
      </div>

      <div className="mt-2 flex flex-col gap-1">
        <Toggle
          name="fullControl"
          label="Full control (stop everywhere)"
          checked={stops.mode === 'fullControl'}
          onChange={(v) => update({ mode: v ? 'fullControl' : 'auto' })}
        />
        <Toggle
          name="stopWhenAnyoneCasts"
          label="Stop when anyone casts"
          checked={stops.stopWhenAnyoneCasts}
          onChange={(v) => update({ stopWhenAnyoneCasts: v })}
        />
        <Toggle
          name="stopBeforeCombatDamage"
          label="Stop before combat damage"
          checked={stops.stopBeforeCombatDamage}
          onChange={(v) => update({ stopBeforeCombatDamage: v })}
        />
        <Toggle
          name="stopOnMyUpkeep"
          label="Stop on my upkeep"
          checked={stops.stopOnMyUpkeep}
          onChange={(v) => update({ stopOnMyUpkeep: v })}
        />
        <Toggle
          name="stopWhenIHaveInstantSpeedPlay"
          label="Stop when I have a play"
          checked={stops.stopWhenIHaveInstantSpeedPlay}
          onChange={(v) => update({ stopWhenIHaveInstantSpeedPlay: v })}
        />
      </div>

      <p className="mt-2 font-sc text-[10px] tracking-wider text-crt-faint">ALSO STOP AT</p>
      <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5">
        {STEPS.map(({ step, label }) => (
          <Toggle
            key={step}
            name={`always-${step}`}
            label={label}
            checked={stops.alwaysStop[step] === true}
            onChange={(v) => update({ alwaysStop: { ...stops.alwaysStop, [step]: v } })}
          />
        ))}
      </div>
      <p className="mt-2 text-[10px] leading-snug text-crt-faint">
        The game never stops you when you have nothing you could play, whatever
        is ticked here. On your own turn it stops in your main phases, and on
        everyone else&rsquo;s at their end step. Turn on full control to be asked
        in every step instead.
      </p>
    </div>
  );
}
