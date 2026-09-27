// `The Witch's Vanity` - a chapter trigger vocab, a chapter trigger token, a chapter trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THE_WITCH_S_VANITY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(THE_WITCH_S_VANITY, "(As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.)\nI — Destroy target creature an opponent controls with mana value 2 or less.\nII — Create a Food token. (It's an artifact with \"{2}, {T}, Sacrifice this token: You gain 3 life.\")\nIII — Create a Wicked Role token attached to target creature you control.");
const LINES = PRINTED.split('\n');
const TOKEN_L2 = tokenRef("Food|/||Artifact|");

const VOCAB_L1 = vocabularyEffects("Destroy target creature an opponent controls with mana value 2 or less.", THE_WITCH_S_VANITY.name);
const VOCAB_T_L1 = vocabularyTargets("Destroy target creature an opponent controls with mana value 2 or less.");
const VOCAB_L3 = vocabularyEffects("Create a Wicked Role token attached to target creature you control.", THE_WITCH_S_VANITY.name);
const VOCAB_T_L3 = vocabularyTargets("Create a Wicked Role token attached to target creature you control.");

export const THE_WITCHS_VANITY_SCRIPT: CardScript = {
  oracleId: THE_WITCH_S_VANITY.oracleId,
  name: THE_WITCH_S_VANITY.name,
  triggers: [
    {
      abilityId: 'chapter-1',
      text: LINES[1] as string,
      event: 'CountersChanged',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'CountersChanged') return false;
        const after = ctx.state.cards[self]?.counters['lore'] ?? 0;
        return ev.changes.some((c) => c.card === self && c.kind === 'lore' && c.delta > 0 && [1].some((n) => n > after - c.delta && n <= after));
      },
      label: () => "The Witch's Vanity - Destroy target creature an opponent controls with mana value 2 or less.",
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
        return ev.changes.some((c) => c.card === self && c.kind === 'lore' && c.delta > 0 && [2].some((n) => n > after - c.delta && n <= after));
      },
      label: () => "The Witch's Vanity - token",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_L2.oracleId,
          printingId: TOKEN_L2.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
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
      label: () => "The Witch's Vanity - Create a Wicked Role token attached to target creature you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L3, VOCAB_T_L3);
      },
    },
  ],
};
