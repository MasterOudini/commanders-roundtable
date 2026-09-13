// `Indulging Patrician` - a endStep trigger loseLifeOpponents
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { INDULGING_PATRICIAN } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

function printed(card: CardData, expected: string): string {
  const actual = card.faces[0]?.oracleText;
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(INDULGING_PATRICIAN, "Flying\nLifelink (Damage dealt by this creature also causes you to gain that much life.)\nAt the beginning of your end step, if you gained 3 or more life this turn, each opponent loses 3 life.");
const LINES = PRINTED.split('\n');

// "as long as you gained 3 or more life this turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond2Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.turn.memory.lifeGained[me] ?? 0) >= 3;
}


export const INDULGING_PATRICIAN_SCRIPT: CardScript = {
  oracleId: INDULGING_PATRICIAN.oracleId,
  name: INDULGING_PATRICIAN.name,
  triggers: [
    {
      abilityId: 'endStep-2',
      text: LINES[2] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond2Of(ctx, self) &&
        (ev.t === 'StepBegan' && ev.step === 'end' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self)),
      label: () => "Indulging Patrician - loseLifeOpponents",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond2Of(ctx, self)) return [];
        const out: EventBody[] = [];
        for (const [pid, p] of Object.entries(ctx.state.players)) {
          if (pid === obj.controller) continue;
          out.push({ t: 'LifeChanged', player: pid, delta: -3, to: p.life - 3 });
        }
        return out;
      },
    },
  ],
};
