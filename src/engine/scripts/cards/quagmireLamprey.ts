// `Quagmire Lamprey` - a becomesBlocked trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { QUAGMIRE_LAMPREY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(QUAGMIRE_LAMPREY, "Whenever this creature becomes blocked by a creature, put a -1/-1 counter on that creature.");

const VOCAB_L0 = vocabularyEffects("Put a -1/-1 counter on target creature.", QUAGMIRE_LAMPREY.name);
const VOCAB_T_L0 = vocabularyTargets("Put a -1/-1 counter on target creature.");

export const QUAGMIRE_LAMPREY_SCRIPT: CardScript = {
  oracleId: QUAGMIRE_LAMPREY.oracleId,
  name: QUAGMIRE_LAMPREY.name,
  triggers: [
    {
      abilityId: 'becomesBlocked-0',
      text: PRINTED,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      perItem: (_ctx, self, ev) => (ev.t === 'BlockersDeclared' ? ev.blocks.filter((b) => b.attacker === self).map((b) => b.blocker) : []),
      matches: (_ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => b.attacker === self),
      label: () => "Quagmire Lamprey - Put a -1/-1 counter on target creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
