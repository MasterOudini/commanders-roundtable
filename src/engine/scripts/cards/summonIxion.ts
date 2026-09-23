// `Summon: Ixion` - a chapter trigger vocab, a chapter trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SUMMON_IXION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SUMMON_IXION, "(As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.)\nI — Aerospark — Exile target creature an opponent controls until this Saga leaves the battlefield.\nII, III — Put a +1/+1 counter on each of up to two target creatures you control. You gain 2 life.\nFirst strike");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Exile target creature an opponent controls until ~ leaves the battlefield.", SUMMON_IXION.name);
const VOCAB_T_L1 = vocabularyTargets("Exile target creature an opponent controls until ~ leaves the battlefield.");
const VOCAB_L2 = vocabularyEffects("Put a +1/+1 counter on each of up to two target creatures you control. You gain 2 life.", SUMMON_IXION.name);
const VOCAB_T_L2 = vocabularyTargets("Put a +1/+1 counter on each of up to two target creatures you control. You gain 2 life.");

export const SUMMON_IXION_SCRIPT: CardScript = {
  oracleId: SUMMON_IXION.oracleId,
  name: SUMMON_IXION.name,
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
      label: () => "Summon: Ixion - Exile target creature an opponent controls until ~ leaves the battlefield.",
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
        return ev.changes.some((c) => c.card === self && c.kind === 'lore' && c.delta > 0 && [2,3].some((n) => n > after - c.delta && n <= after));
      },
      label: () => "Summon: Ixion - Put a +1/+1 counter on each of up to two target creatures you control. You gain 2 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
