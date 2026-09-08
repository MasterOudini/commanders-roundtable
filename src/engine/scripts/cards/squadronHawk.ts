// `Squadron Hawk` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SQUADRON_HAWK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SQUADRON_HAWK, "Flying\nWhen this creature enters, you may search your library for up to three cards named Squadron Hawk, reveal them, put them into your hand, then shuffle.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Search your library for up to three cards named ~, reveal them, put them into your hand, then shuffle.", SQUADRON_HAWK.name);
const VOCAB_T_L1 = vocabularyTargets("Search your library for up to three cards named ~, reveal them, put them into your hand, then shuffle.");

export const SQUADRON_HAWK_SCRIPT: CardScript = {
  oracleId: SQUADRON_HAWK.oracleId,
  name: SQUADRON_HAWK.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Squadron Hawk - Search your library for up to three cards named ~, reveal them, put them into your hand, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
