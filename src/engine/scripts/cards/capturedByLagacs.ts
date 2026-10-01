// `Captured by Lagacs` - a static attachedCombat, a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CAPTURED_BY_LAGACS } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

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

const PRINTED = printed(CAPTURED_BY_LAGACS, "Enchant creature\nEnchanted creature can't attack or block.\nWhen this Aura enters, support 2. (Put a +1/+1 counter on each of up to two target creatures.)");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Support 2.", CAPTURED_BY_LAGACS.name);
const VOCAB_T_L2 = vocabularyTargets("Support 2.");

export const CAPTURED_BY_LAGACS_SCRIPT: CardScript = {
  oracleId: CAPTURED_BY_LAGACS.oracleId,
  name: CAPTURED_BY_LAGACS.name,
  triggers: [
    {
      abilityId: 'etb-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Captured by Lagacs - Support 2.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
  combat: [
    {
      abilityId: 'attached-combat-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canAttack: (ctx, self, candidate) => ctx.state.cards[self]?.attachedTo !== candidate,
      canBlock: (ctx, self, blocker) => ctx.state.cards[self]?.attachedTo !== blocker,
    },
  ],
};
