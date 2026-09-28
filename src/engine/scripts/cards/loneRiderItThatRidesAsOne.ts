// `Lone Rider // It That Rides as One` - a eachEndStep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LONE_RIDER_IT_THAT_RIDES_AS_ONE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { transformFrom, vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(LONE_RIDER_IT_THAT_RIDES_AS_ONE, "First strike, lifelink\nAt the beginning of the end step, if you gained 3 or more life this turn, transform this creature.\nFirst strike, trample, lifelink");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = transformFrom(vocabularyEffects("Transform this creature.", LONE_RIDER_IT_THAT_RIDES_AS_ONE.name), 0);
const VOCAB_T_L1 = vocabularyTargets("Transform this creature.");

// "as long as you gained 3 or more life this turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.turn.memory.lifeGained[me] ?? 0) >= 3;
}


export const LONE_RIDER_IT_THAT_RIDES_AS_ONE_SCRIPT: CardScript = {
  oracleId: LONE_RIDER_IT_THAT_RIDES_AS_ONE.oracleId,
  name: LONE_RIDER_IT_THAT_RIDES_AS_ONE.name,
  triggers: [
    {
      abilityId: 'eachEndStep-1', face: 0,
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond1Of(ctx, self) &&
        (ev.t === 'StepBegan' && ev.step === 'end'),
      label: () => "Lone Rider // It That Rides as One - Transform this creature.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond1Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
