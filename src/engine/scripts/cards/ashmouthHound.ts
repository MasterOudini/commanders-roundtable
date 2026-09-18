// `Ashmouth Hound` - a blocksOrBecomesBlocked trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ASHMOUTH_HOUND } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ASHMOUTH_HOUND, "Whenever this creature blocks or becomes blocked by a creature, this creature deals 1 damage to that creature.");

const VOCAB_L0 = vocabularyEffects("~ deals 1 damage to target creature.", ASHMOUTH_HOUND.name);
const VOCAB_T_L0 = vocabularyTargets("~ deals 1 damage to target creature.");

export const ASHMOUTH_HOUND_SCRIPT: CardScript = {
  oracleId: ASHMOUTH_HOUND.oracleId,
  name: ASHMOUTH_HOUND.name,
  triggers: [
    {
      abilityId: 'blocksOrBecomesBlocked-0',
      text: PRINTED,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      perItem: (_ctx, self, ev) => (ev.t === 'BlockersDeclared' ? ev.blocks.filter((b) => b.blocker === self || b.attacker === self).map((b) => (b.blocker === self ? b.attacker : b.blocker)) : []),
      matches: (_ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => b.blocker === self || b.attacker === self),
      label: () => "Ashmouth Hound - ~ deals 1 damage to target creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
