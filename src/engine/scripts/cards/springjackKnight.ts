// `Springjack Knight` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPRINGJACK_KNIGHT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPRINGJACK_KNIGHT, "Whenever this creature attacks, clash with an opponent. If you win, target creature gains double strike until end of turn. (Each clashing player reveals the top card of their library, then puts that card on their choice of the top or bottom. A player wins if their card had a greater mana value.)");

const VOCAB_L0 = vocabularyEffects("Clash with an opponent. If you win, target creature gains double strike until end of turn.", SPRINGJACK_KNIGHT.name);
const VOCAB_T_L0 = vocabularyTargets("Clash with an opponent. If you win, target creature gains double strike until end of turn.");

export const SPRINGJACK_KNIGHT_SCRIPT: CardScript = {
  oracleId: SPRINGJACK_KNIGHT.oracleId,
  name: SPRINGJACK_KNIGHT.name,
  triggers: [
    {
      abilityId: 'attacks-0',
      text: PRINTED,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Springjack Knight - Clash with an opponent. If you win, target creature gains double strike until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
