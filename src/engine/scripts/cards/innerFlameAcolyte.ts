// `Inner-Flame Acolyte` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { INNER_FLAME_ACOLYTE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(INNER_FLAME_ACOLYTE, "When this creature enters, target creature gets +2/+0 and gains haste until end of turn.\nEvoke {R} (You may cast this spell for its evoke cost. If you do, it's sacrificed when it enters.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Target creature gets +2/+0 and gains haste until end of turn.", INNER_FLAME_ACOLYTE.name);
const VOCAB_T_L0 = vocabularyTargets("Target creature gets +2/+0 and gains haste until end of turn.");

export const INNER_FLAME_ACOLYTE_SCRIPT: CardScript = {
  oracleId: INNER_FLAME_ACOLYTE.oracleId,
  name: INNER_FLAME_ACOLYTE.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Inner-Flame Acolyte - Target creature gets +2/+0 and gains haste until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
