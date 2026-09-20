// `Village Bell-Ringer` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VILLAGE_BELL_RINGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VILLAGE_BELL_RINGER, "Flash (You may cast this spell any time you could cast an instant.)\nWhen this creature enters, untap all creatures you control.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Untap all creatures you control.", VILLAGE_BELL_RINGER.name);
const VOCAB_T_L1 = vocabularyTargets("Untap all creatures you control.");

export const VILLAGE_BELL_RINGER_SCRIPT: CardScript = {
  oracleId: VILLAGE_BELL_RINGER.oracleId,
  name: VILLAGE_BELL_RINGER.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Village Bell-Ringer - Untap all creatures you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
