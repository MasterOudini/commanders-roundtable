// `Elspeth's Nightmare` - a chapter trigger vocab, a chapter trigger vocab, a chapter trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ELSPETH_S_NIGHTMARE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ELSPETH_S_NIGHTMARE, "(As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.)\nI — Destroy target creature an opponent controls with power 2 or less.\nII — Target opponent reveals their hand. You choose a noncreature, nonland card from it. That player discards that card.\nIII — Exile target opponent's graveyard.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Destroy target creature an opponent controls with power 2 or less.", ELSPETH_S_NIGHTMARE.name);
const VOCAB_T_L1 = vocabularyTargets("Destroy target creature an opponent controls with power 2 or less.");
const VOCAB_L2 = vocabularyEffects("Target opponent reveals their hand. You choose a noncreature, nonland card from it. That player discards that card.", ELSPETH_S_NIGHTMARE.name);
const VOCAB_T_L2 = vocabularyTargets("Target opponent reveals their hand. You choose a noncreature, nonland card from it. That player discards that card.");
const VOCAB_L3 = vocabularyEffects("Exile target opponent's graveyard.", ELSPETH_S_NIGHTMARE.name);
const VOCAB_T_L3 = vocabularyTargets("Exile target opponent's graveyard.");

export const ELSPETHS_NIGHTMARE_SCRIPT: CardScript = {
  oracleId: ELSPETH_S_NIGHTMARE.oracleId,
  name: ELSPETH_S_NIGHTMARE.name,
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
      label: () => "Elspeth's Nightmare - Destroy target creature an opponent controls with power 2 or less.",
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
      targets: VOCAB_T_L2,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'CountersChanged') return false;
        const after = ctx.state.cards[self]?.counters['lore'] ?? 0;
        return ev.changes.some((c) => c.card === self && c.kind === 'lore' && c.delta > 0 && [2].some((n) => n > after - c.delta && n <= after));
      },
      label: () => "Elspeth's Nightmare - Target opponent reveals their hand. You choose a noncreature, nonland card from it. That player discards that card.",
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
      label: () => "Elspeth's Nightmare - Exile target opponent's graveyard.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L3, VOCAB_T_L3);
      },
    },
  ],
};
