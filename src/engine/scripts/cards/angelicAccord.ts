// `Angelic Accord` - a eachEndStep trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ANGELIC_ACCORD } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
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

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" - re-check before re-registering (D90).`);
  return ref;
}

const PRINTED = printed(ANGELIC_ACCORD, "At the beginning of each end step, if you gained 4 or more life this turn, create a 4/4 white Angel creature token with flying.");
const TOKEN_L0 = tokenRef("Angel|4/4|W|Creature|flying");

// "as long as you gained 4 or more life this turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.turn.memory.lifeGained[me] ?? 0) >= 4;
}


export const ANGELIC_ACCORD_SCRIPT: CardScript = {
  oracleId: ANGELIC_ACCORD.oracleId,
  name: ANGELIC_ACCORD.name,
  triggers: [
    {
      abilityId: 'eachEndStep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond0Of(ctx, self) &&
        (ev.t === 'StepBegan' && ev.step === 'end'),
      label: () => "Angelic Accord - token",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond0Of(ctx, self)) return [];
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_L0.oracleId,
          printingId: TOKEN_L0.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
};
