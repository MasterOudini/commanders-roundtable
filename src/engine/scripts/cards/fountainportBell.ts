// `Fountainport Bell` - a etb trigger vocab, an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FOUNTAINPORT_BELL } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(FOUNTAINPORT_BELL, "When this artifact enters, you may search your library for a basic land card, reveal it, then shuffle and put that card on top.\n{1}, Sacrifice this artifact: Draw a card.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Search your library for a basic land card, reveal it, then shuffle and put that card on top.", FOUNTAINPORT_BELL.name);
const VOCAB_T_L0 = vocabularyTargets("Search your library for a basic land card, reveal it, then shuffle and put that card on top.");

export const FOUNTAINPORT_BELL_SCRIPT: CardScript = {
  oracleId: FOUNTAINPORT_BELL.oracleId,
  name: FOUNTAINPORT_BELL.name,
  activated: [
    {
      ref: `${FOUNTAINPORT_BELL.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Fountainport Bell - Search your library for a basic land card, reveal it, then shuffle and put that card on top.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
