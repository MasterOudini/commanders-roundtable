// `Summon: Anima` - a chapter trigger drawLose, a chapter trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SUMMON_ANIMA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SUMMON_ANIMA, "(As this Saga enters and after your draw step, add a lore counter. Sacrifice after IV.)\nI, II, III — Pain — You draw a card and you lose 1 life.\nIV — Oblivion — Each opponent sacrifices a creature of their choice and loses 3 life.\nMenace");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Each opponent sacrifices a creature of their choice and loses 3 life.", SUMMON_ANIMA.name);
const VOCAB_T_L2 = vocabularyTargets("Each opponent sacrifices a creature of their choice and loses 3 life.");

export const SUMMON_ANIMA_SCRIPT: CardScript = {
  oracleId: SUMMON_ANIMA.oracleId,
  name: SUMMON_ANIMA.name,
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
        return ev.changes.some((c) => c.card === self && c.kind === 'lore' && c.delta > 0 && [1,2,3].some((n) => n > after - c.delta && n <= after));
      },
      label: () => "Summon: Anima - drawLose",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [...drawEvents(ctx.state, obj.controller, 1), { t: 'LifeChanged', player: obj.controller, delta: -1, to: me.life - 1 }];
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
        return ev.changes.some((c) => c.card === self && c.kind === 'lore' && c.delta > 0 && [4].some((n) => n > after - c.delta && n <= after));
      },
      label: () => "Summon: Anima - Each opponent sacrifices a creature of their choice and loses 3 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
