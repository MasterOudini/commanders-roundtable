// `Githzerai Monk` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GITHZERAI_MONK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GITHZERAI_MONK, "Flash\nFlying\nPsychic Defense — When this creature enters, tap all creatures you don't control.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Tap all creatures you don't control.", GITHZERAI_MONK.name);
const VOCAB_T_L2 = vocabularyTargets("Tap all creatures you don't control.");

export const GITHZERAI_MONK_SCRIPT: CardScript = {
  oracleId: GITHZERAI_MONK.oracleId,
  name: GITHZERAI_MONK.name,
  triggers: [
    {
      abilityId: 'etb-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Githzerai Monk - Tap all creatures you don't control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
