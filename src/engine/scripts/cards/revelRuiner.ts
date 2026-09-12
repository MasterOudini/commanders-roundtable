// `Revel Ruiner` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { REVEL_RUINER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(REVEL_RUINER, "Menace (This creature can't be blocked except by two or more creatures.)\nWhen this creature enters, it connives. (Draw a card, then discard a card. If you discarded a nonland card, put a +1/+1 counter on this creature.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("~ connives.", REVEL_RUINER.name);
const VOCAB_T_L1 = vocabularyTargets("~ connives.");

export const REVEL_RUINER_SCRIPT: CardScript = {
  oracleId: REVEL_RUINER.oracleId,
  name: REVEL_RUINER.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Revel Ruiner - ~ connives.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
