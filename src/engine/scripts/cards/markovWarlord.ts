// `Markov Warlord` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MARKOV_WARLORD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MARKOV_WARLORD, "Haste (This creature can attack and {T} as soon as it comes under your control.)\nWhen this creature enters, up to two target creatures can't block this turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Up to two target creatures can't block this turn.", MARKOV_WARLORD.name);
const VOCAB_T_L1 = vocabularyTargets("Up to two target creatures can't block this turn.");

export const MARKOV_WARLORD_SCRIPT: CardScript = {
  oracleId: MARKOV_WARLORD.oracleId,
  name: MARKOV_WARLORD.name,
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
      label: () => "Markov Warlord - Up to two target creatures can't block this turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
