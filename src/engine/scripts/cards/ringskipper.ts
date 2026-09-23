// `Ringskipper` - a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RINGSKIPPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RINGSKIPPER, "Flying\nWhen this creature dies, clash with an opponent. If you win, return this card to its owner's hand. (Each clashing player reveals the top card of their library, then puts that card on their choice of the top or bottom. A player wins if their card had a greater mana value.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Clash with an opponent. If you win, return this card to its owner's hand.", RINGSKIPPER.name);
const VOCAB_T_L1 = vocabularyTargets("Clash with an opponent. If you win, return this card to its owner's hand.");

export const RINGSKIPPER_SCRIPT: CardScript = {
  oracleId: RINGSKIPPER.oracleId,
  name: RINGSKIPPER.name,
  triggers: [
    {
      abilityId: 'dies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Ringskipper - Clash with an opponent. If you win, return this card to its owner's hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
