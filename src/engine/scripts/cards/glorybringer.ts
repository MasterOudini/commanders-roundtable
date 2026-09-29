// `Glorybringer` - a exertAttack trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GLORYBRINGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GLORYBRINGER, "Flying, haste\nYou may exert this creature as it attacks. When you do, it deals 4 damage to target non-Dragon creature an opponent controls. (An exerted creature won't untap during your next untap step.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("~ deals 4 damage to target non-Dragon creature an opponent controls.", GLORYBRINGER.name);
const VOCAB_T_L1 = vocabularyTargets("~ deals 4 damage to target non-Dragon creature an opponent controls.");

export const GLORYBRINGER_SCRIPT: CardScript = {
  oracleId: GLORYBRINGER.oracleId,
  name: GLORYBRINGER.name,
  triggers: [
    {
      abilityId: 'exertAttack-1',
      text: LINES[1] as string,
      event: 'Exerted',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) => ev.t === 'Exerted' && ev.card === self,
      label: () => "Glorybringer - ~ deals 4 damage to target non-Dragon creature an opponent controls.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
