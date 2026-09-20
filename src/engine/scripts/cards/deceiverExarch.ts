// `Deceiver Exarch` - a etb trigger vocab, a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DECEIVER_EXARCH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DECEIVER_EXARCH, "Flash (You may cast this spell any time you could cast an instant.)\nWhen this creature enters, choose one —\n• Untap target permanent you control.\n• Tap target permanent an opponent controls.");
const LINES = PRINTED.split('\n');

const MODES_L1 = [
  { text: "Untap target permanent you control.", targets: vocabularyTargets("Untap target permanent you control.") },
  { text: "Tap target permanent an opponent controls.", targets: vocabularyTargets("Tap target permanent an opponent controls.") },
];

const VOCAB_L1_m0 = vocabularyEffects("Untap target permanent you control.", DECEIVER_EXARCH.name);
const VOCAB_T_L1_m0 = vocabularyTargets("Untap target permanent you control.");
const VOCAB_L1_m1 = vocabularyEffects("Tap target permanent an opponent controls.", DECEIVER_EXARCH.name);
const VOCAB_T_L1_m1 = vocabularyTargets("Tap target permanent an opponent controls.");

export const DECEIVER_EXARCH_SCRIPT: CardScript = {
  oracleId: DECEIVER_EXARCH.oracleId,
  name: DECEIVER_EXARCH.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      modes: MODES_L1,
      modeChoice: { min: 1, max: 1 },
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Deceiver Exarch - choose one",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D371 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
          return ctx.vocabulary(obj, VOCAB_L1_m0, VOCAB_T_L1_m0);
        }
        if (chosen === 1) {
          return ctx.vocabulary(obj, VOCAB_L1_m1, VOCAB_T_L1_m1);
        }
        return [];
      },
    },
  ],
};
