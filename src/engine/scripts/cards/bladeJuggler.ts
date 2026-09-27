// `Blade Juggler` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BLADE_JUGGLER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BLADE_JUGGLER, "Spectacle {2}{B} (You may cast this spell for its spectacle cost rather than its mana cost if an opponent lost life this turn.)\nWhen this creature enters, it deals 1 damage to you and you draw a card.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("~ deals 1 damage to you and you draw a card.", BLADE_JUGGLER.name);
const VOCAB_T_L1 = vocabularyTargets("~ deals 1 damage to you and you draw a card.");

export const BLADE_JUGGLER_SCRIPT: CardScript = {
  oracleId: BLADE_JUGGLER.oracleId,
  name: BLADE_JUGGLER.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Blade Juggler - ~ deals 1 damage to you and you draw a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
