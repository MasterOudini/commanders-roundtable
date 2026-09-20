// `Arboreal Grazer` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ARBOREAL_GRAZER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ARBOREAL_GRAZER, "Reach\nWhen this creature enters, you may put a land card from your hand onto the battlefield tapped.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put a land card from your hand onto the battlefield tapped.", ARBOREAL_GRAZER.name);
const VOCAB_T_L1 = vocabularyTargets("Put a land card from your hand onto the battlefield tapped.");

export const ARBOREAL_GRAZER_SCRIPT: CardScript = {
  oracleId: ARBOREAL_GRAZER.oracleId,
  name: ARBOREAL_GRAZER.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Arboreal Grazer - Put a land card from your hand onto the battlefield tapped.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
