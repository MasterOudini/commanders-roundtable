// `Abomination of Gudul` - a combatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ABOMINATION_OF_GUDUL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ABOMINATION_OF_GUDUL, "Flying\nWhenever this creature deals combat damage to a player, you may draw a card. If you do, discard a card.\nMorph {2}{B}{G}{U} (You may cast this card face down as a 2/2 creature for {3}. Turn it face up any time for its morph cost.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Draw a card. If you do, discard a card.", ABOMINATION_OF_GUDUL.name);
const VOCAB_T_L1 = vocabularyTargets("Draw a card. If you do, discard a card.");

export const ABOMINATION_OF_GUDUL_SCRIPT: CardScript = {
  oracleId: ABOMINATION_OF_GUDUL.oracleId,
  name: ABOMINATION_OF_GUDUL.name,
  triggers: [
    {
      abilityId: 'combatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: true,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Abomination of Gudul - Draw a card. If you do, discard a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
