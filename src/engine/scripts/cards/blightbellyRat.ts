// `Blightbelly Rat` - a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BLIGHTBELLY_RAT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BLIGHTBELLY_RAT, "Toxic 1 (Players dealt combat damage by this creature also get a poison counter.)\nWhen this creature dies, proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Proliferate.", BLIGHTBELLY_RAT.name);
const VOCAB_T_L1 = vocabularyTargets("Proliferate.");

export const BLIGHTBELLY_RAT_SCRIPT: CardScript = {
  oracleId: BLIGHTBELLY_RAT.oracleId,
  name: BLIGHTBELLY_RAT.name,
  triggers: [
    {
      abilityId: 'dies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Blightbelly Rat - Proliferate.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
