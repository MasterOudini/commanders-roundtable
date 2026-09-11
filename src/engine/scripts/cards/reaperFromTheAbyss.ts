// `Reaper from the Abyss` - a eachEndStep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { REAPER_FROM_THE_ABYSS } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(REAPER_FROM_THE_ABYSS, "Flying\nMorbid — At the beginning of each end step, if a creature died this turn, destroy target non-Demon creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Destroy target non-Demon creature.", REAPER_FROM_THE_ABYSS.name);
const VOCAB_T_L1 = vocabularyTargets("Destroy target non-Demon creature.");

// "as long as a creature died this turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return ctx.state.turn.memory.died.some((d) => { const inst = ctx.state.cards[d.card]; const face = inst ? ctx.oracle.byPrinting(inst.printingId)?.faces[0] : undefined; return !!face && face.typeLine.types.includes('Creature'); });
}


export const REAPER_FROM_THE_ABYSS_SCRIPT: CardScript = {
  oracleId: REAPER_FROM_THE_ABYSS.oracleId,
  name: REAPER_FROM_THE_ABYSS.name,
  triggers: [
    {
      abilityId: 'eachEndStep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (ctx, self, ev) =>
        ifCond1Of(ctx, self) &&
        (ev.t === 'StepBegan' && ev.step === 'end'),
      label: () => "Reaper from the Abyss - Destroy target non-Demon creature.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond1Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
