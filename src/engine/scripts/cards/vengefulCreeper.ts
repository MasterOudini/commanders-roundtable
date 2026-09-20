// `Vengeful Creeper` - a turnedFaceUp trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VENGEFUL_CREEPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VENGEFUL_CREEPER, "Disguise {5}{G} (You may cast this card face down for {3} as a 2/2 creature with ward {2}. Turn it face up any time for its disguise cost.)\nWhen this creature is turned face up, destroy target artifact or enchantment an opponent controls.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Destroy target artifact or enchantment an opponent controls.", VENGEFUL_CREEPER.name);
const VOCAB_T_L1 = vocabularyTargets("Destroy target artifact or enchantment an opponent controls.");

export const VENGEFUL_CREEPER_SCRIPT: CardScript = {
  oracleId: VENGEFUL_CREEPER.oracleId,
  name: VENGEFUL_CREEPER.name,
  triggers: [
    {
      abilityId: 'turnedFaceUp-1',
      text: LINES[1] as string,
      event: 'FaceDownSet',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) => ev.t === 'FaceDownSet' && ev.card === self && !ev.faceDown,
      label: () => "Vengeful Creeper - Destroy target artifact or enchantment an opponent controls.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
