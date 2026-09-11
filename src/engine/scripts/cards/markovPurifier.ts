// `Markov Purifier` - a endStep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MARKOV_PURIFIER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MARKOV_PURIFIER, "Lifelink\nAt the beginning of your end step, if you gained life this turn, you may pay {2}. If you do, draw a card.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You may pay {2}. If you do, draw a card.", MARKOV_PURIFIER.name);
const VOCAB_T_L1 = vocabularyTargets("You may pay {2}. If you do, draw a card.");

// "as long as you gained life this turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return ctx.state.turn.memory.gainedLife[me] === true;
}


export const MARKOV_PURIFIER_SCRIPT: CardScript = {
  oracleId: MARKOV_PURIFIER.oracleId,
  name: MARKOV_PURIFIER.name,
  triggers: [
    {
      abilityId: 'endStep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond1Of(ctx, self) &&
        (ev.t === 'StepBegan' && ev.step === 'end' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self)),
      label: () => "Markov Purifier - You may pay {2}. If you do, draw a card.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond1Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
