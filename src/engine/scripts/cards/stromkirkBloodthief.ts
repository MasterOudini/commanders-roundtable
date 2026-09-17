// `Stromkirk Bloodthief` - a endStep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STROMKIRK_BLOODTHIEF } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STROMKIRK_BLOODTHIEF, "At the beginning of your end step, if an opponent lost life this turn, put a +1/+1 counter on target Vampire you control.");

const VOCAB_L0 = vocabularyEffects("Put a +1/+1 counter on target Vampire you control.", STROMKIRK_BLOODTHIEF.name);
const VOCAB_T_L0 = vocabularyTargets("Put a +1/+1 counter on target Vampire you control.");

// "as long as an opponent lost life this turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return ctx.state.seating.some((p) => p !== me && ctx.state.turn.memory.lostLife[p] === true);
}


export const STROMKIRK_BLOODTHIEF_SCRIPT: CardScript = {
  oracleId: STROMKIRK_BLOODTHIEF.oracleId,
  name: STROMKIRK_BLOODTHIEF.name,
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
      label: () => "Stromkirk Bloodthief - Put a +1/+1 counter on target Vampire you control.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond0Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
