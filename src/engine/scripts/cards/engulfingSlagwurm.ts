// `Engulfing Slagwurm` - a blocksOrBecomesBlocked trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ENGULFING_SLAGWURM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ENGULFING_SLAGWURM, "Whenever this creature blocks or becomes blocked by a creature, destroy that creature. You gain life equal to that creature's toughness.");

const VOCAB_L0 = vocabularyEffects("Destroy target creature. You gain life equal to that creature's toughness.", ENGULFING_SLAGWURM.name);
const VOCAB_T_L0 = vocabularyTargets("Destroy target creature. You gain life equal to that creature's toughness.");

export const ENGULFING_SLAGWURM_SCRIPT: CardScript = {
  oracleId: ENGULFING_SLAGWURM.oracleId,
  name: ENGULFING_SLAGWURM.name,
  triggers: [
    {
      abilityId: 'blocksOrBecomesBlocked-0',
      text: PRINTED,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      perItem: (_ctx, self, ev) => (ev.t === 'BlockersDeclared' ? ev.blocks.filter((b) => b.blocker === self || b.attacker === self).map((b) => (b.blocker === self ? b.attacker : b.blocker)) : []),
      matches: (_ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => b.blocker === self || b.attacker === self),
      label: () => "Engulfing Slagwurm - Destroy target creature. You gain life equal to that creature's toughness.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
