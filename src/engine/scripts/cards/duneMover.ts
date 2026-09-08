// `Dune Mover` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DUNE_MOVER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DUNE_MOVER, "Toxic 1 (Players dealt combat damage by this creature also get a poison counter.)\nWhen this creature enters, you may search your library for a basic land card, reveal it, then shuffle and put that card on top.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Search your library for a basic land card, reveal it, then shuffle and put that card on top.", DUNE_MOVER.name);
const VOCAB_T_L1 = vocabularyTargets("Search your library for a basic land card, reveal it, then shuffle and put that card on top.");

export const DUNE_MOVER_SCRIPT: CardScript = {
  oracleId: DUNE_MOVER.oracleId,
  name: DUNE_MOVER.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Dune Mover - Search your library for a basic land card, reveal it, then shuffle and put that card on top.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
