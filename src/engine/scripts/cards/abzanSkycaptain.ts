// `Abzan Skycaptain` - a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ABZAN_SKYCAPTAIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ABZAN_SKYCAPTAIN, "Flying\nWhen this creature dies, bolster 2. (Choose a creature with the least toughness among creatures you control and put two +1/+1 counters on it.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Bolster 2.", ABZAN_SKYCAPTAIN.name);
const VOCAB_T_L1 = vocabularyTargets("Bolster 2.");

export const ABZAN_SKYCAPTAIN_SCRIPT: CardScript = {
  oracleId: ABZAN_SKYCAPTAIN.oracleId,
  name: ABZAN_SKYCAPTAIN.name,
  triggers: [
    {
      abilityId: 'dies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Abzan Skycaptain - Bolster 2.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
