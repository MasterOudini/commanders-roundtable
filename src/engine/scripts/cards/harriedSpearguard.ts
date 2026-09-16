// `Harried Spearguard` - a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HARRIED_SPEARGUARD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HARRIED_SPEARGUARD, "Haste\nWhen this creature dies, create a 1/1 black Rat creature token with \"This token can't block.\"");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Create a 1/1 black Rat creature token with \"This token can't block.\"", HARRIED_SPEARGUARD.name);
const VOCAB_T_L1 = vocabularyTargets("Create a 1/1 black Rat creature token with \"This token can't block.\"");

export const HARRIED_SPEARGUARD_SCRIPT: CardScript = {
  oracleId: HARRIED_SPEARGUARD.oracleId,
  name: HARRIED_SPEARGUARD.name,
  triggers: [
    {
      abilityId: 'dies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Harried Spearguard - Create a 1/1 black Rat creature token with \"This token can't block.\"",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
