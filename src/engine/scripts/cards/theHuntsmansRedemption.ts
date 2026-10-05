// `The Huntsman's Redemption` - a chapter trigger token, a chapter trigger vocab, a chapter trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THE_HUNTSMAN_S_REDEMPTION } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
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

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" - re-check before re-registering (D90).`);
  return ref;
}

const PRINTED = printed(THE_HUNTSMAN_S_REDEMPTION, "(As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.)\nI — Create a 3/3 green Beast creature token.\nII — You may sacrifice a creature. If you do, search your library for a creature or basic land card, reveal it, put it into your hand, then shuffle.\nIII — Up to two target creatures each get +2/+2 and gain trample until end of turn.");
const LINES = PRINTED.split('\n');
const TOKEN_L1 = tokenRef("Beast|3/3|G|Creature|");

const VOCAB_L2 = vocabularyEffects("You may sacrifice a creature. If you do, search your library for a creature or basic land card, reveal it, put it into your hand, then shuffle.", THE_HUNTSMAN_S_REDEMPTION.name);
const VOCAB_T_L2 = vocabularyTargets("You may sacrifice a creature. If you do, search your library for a creature or basic land card, reveal it, put it into your hand, then shuffle.");
const VOCAB_L3 = vocabularyEffects("Up to two target creatures each get +2/+2 and gain trample until end of turn.", THE_HUNTSMAN_S_REDEMPTION.name);
const VOCAB_T_L3 = vocabularyTargets("Up to two target creatures each get +2/+2 and gain trample until end of turn.");

export const THE_HUNTSMANS_REDEMPTION_SCRIPT: CardScript = {
  oracleId: THE_HUNTSMAN_S_REDEMPTION.oracleId,
  name: THE_HUNTSMAN_S_REDEMPTION.name,
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
        return ev.changes.some((c) => c.card === self && c.kind === 'lore' && c.delta > 0 && [1].some((n) => n > after - c.delta && n <= after));
      },
      label: () => "The Huntsman's Redemption - token",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_L1.oracleId,
          printingId: TOKEN_L1.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
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
        return ev.changes.some((c) => c.card === self && c.kind === 'lore' && c.delta > 0 && [2].some((n) => n > after - c.delta && n <= after));
      },
      label: () => "The Huntsman's Redemption - You may sacrifice a creature. If you do, search your library for a creature or basic land card, reveal it, put it into your hand, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
    {
      abilityId: 'chapter-3',
      text: LINES[3] as string,
      event: 'CountersChanged',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L3,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'CountersChanged') return false;
        const after = ctx.state.cards[self]?.counters['lore'] ?? 0;
        return ev.changes.some((c) => c.card === self && c.kind === 'lore' && c.delta > 0 && [3].some((n) => n > after - c.delta && n <= after));
      },
      label: () => "The Huntsman's Redemption - Up to two target creatures each get +2/+2 and gain trample until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L3, VOCAB_T_L3);
      },
    },
  ],
};
