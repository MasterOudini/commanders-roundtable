// `Summon: Primal Garuda` - a chapter trigger vocab, a chapter trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SUMMON_PRIMAL_GARUDA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SUMMON_PRIMAL_GARUDA, "(As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.)\nI — Aerial Blast — This creature deals 4 damage to target tapped creature an opponent controls.\nII, III — Slipstream — Another target creature you control gets +1/+0 and gains flying until end of turn.\nFlying");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("~ deals 4 damage to target tapped creature an opponent controls.", SUMMON_PRIMAL_GARUDA.name);
const VOCAB_T_L1 = vocabularyTargets("~ deals 4 damage to target tapped creature an opponent controls.");
const VOCAB_L2 = vocabularyEffects("Another target creature you control gets +1/+0 and gains flying until end of turn.", SUMMON_PRIMAL_GARUDA.name);
const VOCAB_T_L2 = vocabularyTargets("Another target creature you control gets +1/+0 and gains flying until end of turn.");

export const SUMMON_PRIMAL_GARUDA_SCRIPT: CardScript = {
  oracleId: SUMMON_PRIMAL_GARUDA.oracleId,
  name: SUMMON_PRIMAL_GARUDA.name,
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
      label: () => "Summon: Primal Garuda - ~ deals 4 damage to target tapped creature an opponent controls.",
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
      label: () => "Summon: Primal Garuda - Another target creature you control gets +1/+0 and gains flying until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
