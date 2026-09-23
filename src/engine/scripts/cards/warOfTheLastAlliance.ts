// `War of the Last Alliance` - a chapter trigger vocab, a chapter trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WAR_OF_THE_LAST_ALLIANCE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WAR_OF_THE_LAST_ALLIANCE, "(As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.)\nI, II — Search your library for a legendary creature card, reveal it, put it into your hand, then shuffle.\nIII — Creatures you control gain double strike until end of turn. The Ring tempts you.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Search your library for a legendary creature card, reveal it, put it into your hand, then shuffle.", WAR_OF_THE_LAST_ALLIANCE.name);
const VOCAB_T_L1 = vocabularyTargets("Search your library for a legendary creature card, reveal it, put it into your hand, then shuffle.");
const VOCAB_L2 = vocabularyEffects("Creatures you control gain double strike until end of turn. The Ring tempts you.", WAR_OF_THE_LAST_ALLIANCE.name);
const VOCAB_T_L2 = vocabularyTargets("Creatures you control gain double strike until end of turn. The Ring tempts you.");

export const WAR_OF_THE_LAST_ALLIANCE_SCRIPT: CardScript = {
  oracleId: WAR_OF_THE_LAST_ALLIANCE.oracleId,
  name: WAR_OF_THE_LAST_ALLIANCE.name,
  triggers: [
    {
      abilityId: 'chapter-1',
      text: LINES[1] as string,
      event: 'CountersChanged',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'CountersChanged') return false;
        const after = ctx.state.cards[self]?.counters['lore'] ?? 0;
        return ev.changes.some((c) => c.card === self && c.kind === 'lore' && c.delta > 0 && [1,2].some((n) => n > after - c.delta && n <= after));
      },
      label: () => "War of the Last Alliance - Search your library for a legendary creature card, reveal it, put it into your hand, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
    {
      abilityId: 'chapter-2',
      text: LINES[2] as string,
      event: 'CountersChanged',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'CountersChanged') return false;
        const after = ctx.state.cards[self]?.counters['lore'] ?? 0;
        return ev.changes.some((c) => c.card === self && c.kind === 'lore' && c.delta > 0 && [3].some((n) => n > after - c.delta && n <= after));
      },
      label: () => "War of the Last Alliance - Creatures you control gain double strike until end of turn. The Ring tempts you.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
