// `Wylie Duke, Atiin Hero` - a becomesTapped trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WYLIE_DUKE_ATIIN_HERO } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WYLIE_DUKE_ATIIN_HERO, "Vigilance\nWhenever Wylie Duke becomes tapped, you gain 1 life and draw a card.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You gain 1 life and draw a card.", WYLIE_DUKE_ATIIN_HERO.name);
const VOCAB_T_L1 = vocabularyTargets("You gain 1 life and draw a card.");

export const WYLIE_DUKE_ATIIN_HERO_SCRIPT: CardScript = {
  oracleId: WYLIE_DUKE_ATIIN_HERO.oracleId,
  name: WYLIE_DUKE_ATIIN_HERO.name,
  triggers: [
    {
      abilityId: 'becomesTapped-1',
      text: LINES[1] as string,
      event: 'PermanentsTapped',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'PermanentsTapped' && ev.cards.includes(self),
      label: () => "Wylie Duke, Atiin Hero - You gain 1 life and draw a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
