// `Needletooth Pack` - a endStep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NEEDLETOOTH_PACK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NEEDLETOOTH_PACK, "Morbid — At the beginning of your end step, if a creature died this turn, put two +1/+1 counters on target creature you control.");

const VOCAB_L0 = vocabularyEffects("Put two +1/+1 counters on target creature you control.", NEEDLETOOTH_PACK.name);
const VOCAB_T_L0 = vocabularyTargets("Put two +1/+1 counters on target creature you control.");

// "as long as a creature died this turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return ctx.state.turn.memory.died.some((d) => { const inst = ctx.state.cards[d.card]; const face = inst ? ctx.oracle.byPrinting(inst.printingId)?.faces[0] : undefined; return !!face && face.typeLine.types.includes('Creature'); });
}


export const NEEDLETOOTH_PACK_SCRIPT: CardScript = {
  oracleId: NEEDLETOOTH_PACK.oracleId,
  name: NEEDLETOOTH_PACK.name,
  triggers: [
    {
      abilityId: 'endStep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) =>
        ifCond0Of(ctx, self) &&
        (ev.t === 'StepBegan' && ev.step === 'end' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self)),
      label: () => "Needletooth Pack - Put two +1/+1 counters on target creature you control.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond0Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
