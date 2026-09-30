// `Hoverguard Sweepers` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HOVERGUARD_SWEEPERS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HOVERGUARD_SWEEPERS, "Flying\nWhen this creature enters, you may return up to two target creatures to their owners' hands.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Return up to two target creatures to their owners' hands.", HOVERGUARD_SWEEPERS.name);
const VOCAB_T_L1 = vocabularyTargets("Return up to two target creatures to their owners' hands.");

export const HOVERGUARD_SWEEPERS_SCRIPT: CardScript = {
  oracleId: HOVERGUARD_SWEEPERS.oracleId,
  name: HOVERGUARD_SWEEPERS.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Hoverguard Sweepers - Return up to two target creatures to their owners' hands.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
