// `Rathi Fiend` - a etb trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RATHI_FIEND } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RATHI_FIEND, "When this creature enters, each player loses 3 life.\n{3}, {T}: Search your library for a Mercenary permanent card with mana value 3 or less, put it onto the battlefield, then shuffle.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Each player loses 3 life.", RATHI_FIEND.name);
const VOCAB_T_L0 = vocabularyTargets("Each player loses 3 life.");
const VOCAB_A0 = vocabularyEffects("Search your library for a Mercenary permanent card with mana value 3 or less, put it onto the battlefield, then shuffle.", RATHI_FIEND.name);
const VOCAB_T_A0 = vocabularyTargets("Search your library for a Mercenary permanent card with mana value 3 or less, put it onto the battlefield, then shuffle.");

export const RATHI_FIEND_SCRIPT: CardScript = {
  oracleId: RATHI_FIEND.oracleId,
  name: RATHI_FIEND.name,
  activated: [
    {
      ref: `${RATHI_FIEND.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Rathi Fiend - Each player loses 3 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
