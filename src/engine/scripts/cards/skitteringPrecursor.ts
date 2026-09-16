// `Skittering Precursor` - a youSacrifice trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SKITTERING_PRECURSOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SKITTERING_PRECURSOR, "Devoid (This card has no color.)\nMenace\nWhenever you sacrifice a nontoken permanent, create a 0/1 colorless Eldrazi Spawn creature token with \"Sacrifice this token: Add {C}.\"");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Create a 0/1 colorless Eldrazi Spawn creature token with \"Sacrifice this token: Add {C}.\"", SKITTERING_PRECURSOR.name);
const VOCAB_T_L2 = vocabularyTargets("Create a 0/1 colorless Eldrazi Spawn creature token with \"Sacrifice this token: Add {C}.\"");

export const SKITTERING_PRECURSOR_SCRIPT: CardScript = {
  oracleId: SKITTERING_PRECURSOR.oracleId,
  name: SKITTERING_PRECURSOR.name,
  triggers: [
    {
      abilityId: 'youSacrifice-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.reason === 'sacrifice' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && !ctx.state.cards[m.card]?.isToken,
        ),
      label: () => "Skittering Precursor - Create a 0/1 colorless Eldrazi Spawn creature token with \"Sacrifice this token: Add {C}.\"",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
