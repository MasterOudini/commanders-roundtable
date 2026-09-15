// `Shriekmaw` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SHRIEKMAW } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SHRIEKMAW, "Fear (This creature can't be blocked except by artifact creatures and/or black creatures.)\nWhen this creature enters, destroy target nonartifact, nonblack creature.\nEvoke {1}{B} (You may cast this spell for its evoke cost. If you do, it's sacrificed when it enters.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Destroy target nonartifact, nonblack creature.", SHRIEKMAW.name);
const VOCAB_T_L1 = vocabularyTargets("Destroy target nonartifact, nonblack creature.");

export const SHRIEKMAW_SCRIPT: CardScript = {
  oracleId: SHRIEKMAW.oracleId,
  name: SHRIEKMAW.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Shriekmaw - Destroy target nonartifact, nonblack creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
