// `Yavimaya Elder` - a dies trigger vocab, an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { YAVIMAYA_ELDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(YAVIMAYA_ELDER, "When this creature dies, you may search your library for up to two basic land cards, reveal them, put them into your hand, then shuffle.\n{2}, Sacrifice this creature: Draw a card.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Search your library for up to two basic land cards, reveal them, put them into your hand, then shuffle.", YAVIMAYA_ELDER.name);
const VOCAB_T_L0 = vocabularyTargets("Search your library for up to two basic land cards, reveal them, put them into your hand, then shuffle.");

export const YAVIMAYA_ELDER_SCRIPT: CardScript = {
  oracleId: YAVIMAYA_ELDER.oracleId,
  name: YAVIMAYA_ELDER.name,
  activated: [
    {
      ref: `${YAVIMAYA_ELDER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'dies-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Yavimaya Elder - Search your library for up to two basic land cards, reveal them, put them into your hand, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
