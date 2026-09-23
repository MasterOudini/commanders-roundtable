// `Adder-Staff Boggart` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ADDER_STAFF_BOGGART } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ADDER_STAFF_BOGGART, "When this creature enters, clash with an opponent. If you win, put a +1/+1 counter on this creature. (Each clashing player reveals the top card of their library, then puts that card on their choice of the top or bottom. A player wins if their card had a greater mana value.)");

const VOCAB_L0 = vocabularyEffects("Clash with an opponent. If you win, put a +1/+1 counter on ~.", ADDER_STAFF_BOGGART.name);
const VOCAB_T_L0 = vocabularyTargets("Clash with an opponent. If you win, put a +1/+1 counter on ~.");

export const ADDER_STAFF_BOGGART_SCRIPT: CardScript = {
  oracleId: ADDER_STAFF_BOGGART.oracleId,
  name: ADDER_STAFF_BOGGART.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Adder-Staff Boggart - Clash with an opponent. If you win, put a +1/+1 counter on ~.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
