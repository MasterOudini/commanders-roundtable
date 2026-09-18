// `Abomination` - a blocksOrBecomesBlockedBy trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ABOMINATION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ABOMINATION, "Whenever this creature blocks or becomes blocked by a green or white creature, destroy that creature at end of combat.");

const VOCAB_L0 = vocabularyEffects("Destroy target creature at end of combat.", ABOMINATION.name);
const VOCAB_T_L0 = vocabularyTargets("Destroy target creature at end of combat.");

export const ABOMINATION_SCRIPT: CardScript = {
  oracleId: ABOMINATION.oracleId,
  name: ABOMINATION.name,
  triggers: [
    {
      abilityId: 'blocksOrBecomesBlockedBy-0',
      text: PRINTED,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      perItem: (_ctx, self, ev) => (ev.t === 'BlockersDeclared' ? ev.blocks.filter((b) => b.blocker === self || b.attacker === self).map((b) => (b.blocker === self ? b.attacker : b.blocker)) : []),
      matches: (ctx, self, ev) =>
        ev.t === 'BlockersDeclared' && ev.blocks.some((b) => (b.blocker === self && ctx.derive(b.attacker).colors.some((c) => ["G","W"].includes(c))) || (b.attacker === self && ctx.derive(b.blocker).colors.some((c) => ["G","W"].includes(c)))),
      label: () => "Abomination - Destroy target creature at end of combat.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
