// `Cleric of Chill Depths` - a blocks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CLERIC_OF_CHILL_DEPTHS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CLERIC_OF_CHILL_DEPTHS, "Whenever this creature blocks a creature, that creature doesn't untap during its controller's next untap step.");

const VOCAB_L0 = vocabularyEffects("Target creature doesn't untap during its controller's next untap step.", CLERIC_OF_CHILL_DEPTHS.name);
const VOCAB_T_L0 = vocabularyTargets("Target creature doesn't untap during its controller's next untap step.");

export const CLERIC_OF_CHILL_DEPTHS_SCRIPT: CardScript = {
  oracleId: CLERIC_OF_CHILL_DEPTHS.oracleId,
  name: CLERIC_OF_CHILL_DEPTHS.name,
  triggers: [
    {
      abilityId: 'blocks-0',
      text: PRINTED,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      perItem: (_ctx, self, ev) => (ev.t === 'BlockersDeclared' ? ev.blocks.filter((b) => b.blocker === self).map((b) => b.attacker) : []),
      matches: (_ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => b.blocker === self),
      label: () => "Cleric of Chill Depths - Target creature doesn't untap during its controller's next untap step.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
