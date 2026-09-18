// `Kolaghan Aspirant` - a becomesBlocked trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KOLAGHAN_ASPIRANT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KOLAGHAN_ASPIRANT, "Whenever this creature becomes blocked by a creature, this creature deals 1 damage to that creature.");

const VOCAB_L0 = vocabularyEffects("~ deals 1 damage to target creature.", KOLAGHAN_ASPIRANT.name);
const VOCAB_T_L0 = vocabularyTargets("~ deals 1 damage to target creature.");

export const KOLAGHAN_ASPIRANT_SCRIPT: CardScript = {
  oracleId: KOLAGHAN_ASPIRANT.oracleId,
  name: KOLAGHAN_ASPIRANT.name,
  triggers: [
    {
      abilityId: 'becomesBlocked-0',
      text: PRINTED,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      perItem: (_ctx, self, ev) => (ev.t === 'BlockersDeclared' ? ev.blocks.filter((b) => b.attacker === self).map((b) => b.blocker) : []),
      matches: (_ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => b.attacker === self),
      label: () => "Kolaghan Aspirant - ~ deals 1 damage to target creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
