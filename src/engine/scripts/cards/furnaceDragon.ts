// `Furnace Dragon` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FURNACE_DRAGON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FURNACE_DRAGON, "Affinity for artifacts (This spell costs {1} less to cast for each artifact you control.)\nFlying\nWhen this creature enters, if you cast it from your hand, exile all artifacts.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Exile all artifacts.", FURNACE_DRAGON.name);
const VOCAB_T_L2 = vocabularyTargets("Exile all artifacts.");

// "as long as you cast it from your hand" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond2Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return ctx.state.cards[self]?.castFromZone === 'hand';
}


export const FURNACE_DRAGON_SCRIPT: CardScript = {
  oracleId: FURNACE_DRAGON.oracleId,
  name: FURNACE_DRAGON.name,
  triggers: [
    {
      abilityId: 'etb-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond2Of(ctx, self) &&
        (ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield')),
      label: () => "Furnace Dragon - Exile all artifacts.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond2Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
