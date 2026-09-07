// `Giant-Sized Flying Ant` - a etb trigger vocab, a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GIANT_SIZED_FLYING_ANT } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import { modesInOrder } from '../../modes';
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

const PRINTED = printed(GIANT_SIZED_FLYING_ANT, "Flash\nFlying\nWhen this creature enters, choose one —\n• Tap target nonland permanent.\n• Untap target nonland permanent.");
const LINES = PRINTED.split('\n');

const MODES_L2 = [
  { text: "Tap target nonland permanent.", targets: vocabularyTargets("Tap target nonland permanent.") },
  { text: "Untap target nonland permanent.", targets: vocabularyTargets("Untap target nonland permanent.") },
];

const VOCAB_L2_m0 = vocabularyEffects("Tap target nonland permanent.", GIANT_SIZED_FLYING_ANT.name);
const VOCAB_T_L2_m0 = vocabularyTargets("Tap target nonland permanent.");
const VOCAB_L2_m1 = vocabularyEffects("Untap target nonland permanent.", GIANT_SIZED_FLYING_ANT.name);
const VOCAB_T_L2_m1 = vocabularyTargets("Untap target nonland permanent.");

export const GIANT_SIZED_FLYING_ANT_SCRIPT: CardScript = {
  oracleId: GIANT_SIZED_FLYING_ANT.oracleId,
  name: GIANT_SIZED_FLYING_ANT.name,
  triggers: [
    {
      abilityId: 'etb-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      modes: MODES_L2,
      modeChoice: { min: 1, max: 1 },
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Giant-Sized Flying Ant - choose one",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D345 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          return ctx.vocabulary(obj, VOCAB_L2_m0, VOCAB_T_L2_m0);
        }
        if (chosen === 1) {
          return ctx.vocabulary(obj, VOCAB_L2_m1, VOCAB_T_L2_m1);
        }
        return [];
      },
    },
  ],
};
