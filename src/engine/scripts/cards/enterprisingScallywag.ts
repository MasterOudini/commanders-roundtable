// `Enterprising Scallywag` - a endStep trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ENTERPRISING_SCALLYWAG } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ENTERPRISING_SCALLYWAG, "At the beginning of your end step, if you descended this turn, create a Treasure token. (You descended if a permanent card was put into your graveyard from anywhere.)");
const TOKEN_L0 = tokenRef("Treasure|/||Artifact|");

// "as long as you descended this turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.turn.memory.toGraveyard[me] ?? []).some((id) => {
    const inst = ctx.state.cards[id];
    const face = inst ? ctx.oracle.byPrinting(inst.printingId)?.faces[0] : undefined;
    return !!face && face.typeLine.types.some((t) => ['Artifact', 'Creature', 'Enchantment', 'Land', 'Planeswalker', 'Battle'].includes(t));
  });
}


export const ENTERPRISING_SCALLYWAG_SCRIPT: CardScript = {
  oracleId: ENTERPRISING_SCALLYWAG.oracleId,
  name: ENTERPRISING_SCALLYWAG.name,
  triggers: [
    {
      abilityId: 'endStep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond0Of(ctx, self) &&
        (ev.t === 'StepBegan' && ev.step === 'end' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self)),
      label: () => "Enterprising Scallywag - token",
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
