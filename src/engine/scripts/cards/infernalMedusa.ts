// `Infernal Medusa` - a blocks trigger vocab, a becomesBlocked trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { INFERNAL_MEDUSA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(INFERNAL_MEDUSA, "Whenever this creature blocks a creature, destroy that creature at end of combat.\nWhenever this creature becomes blocked by a non-Wall creature, destroy that creature at end of combat.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Destroy target creature at end of combat.", INFERNAL_MEDUSA.name);
const VOCAB_T_L0 = vocabularyTargets("Destroy target creature at end of combat.");
const VOCAB_L1 = vocabularyEffects("Destroy target creature at end of combat.", INFERNAL_MEDUSA.name);
const VOCAB_T_L1 = vocabularyTargets("Destroy target creature at end of combat.");

export const INFERNAL_MEDUSA_SCRIPT: CardScript = {
  oracleId: INFERNAL_MEDUSA.oracleId,
  name: INFERNAL_MEDUSA.name,
  triggers: [
    {
      abilityId: 'blocks-0',
      text: LINES[0] as string,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      perItem: (_ctx, self, ev) => (ev.t === 'BlockersDeclared' ? ev.blocks.filter((b) => b.blocker === self).map((b) => b.attacker) : []),
      matches: (_ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => b.blocker === self),
      label: () => "Infernal Medusa - Destroy target creature at end of combat.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'becomesBlocked-1',
      text: LINES[1] as string,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      perItem: (_ctx, self, ev) => (ev.t === 'BlockersDeclared' ? ev.blocks.filter((b) => b.attacker === self).map((b) => b.blocker) : []),
      matches: (ctx, self, ev) =>
        ev.t === 'BlockersDeclared' &&
        ev.blocks.some((b) => b.attacker === self && ctx.derive(b.blocker).typeLine.types.includes('Creature') && !ctx.derive(b.blocker).typeLine.subtypes.includes('Wall')),
      label: () => "Infernal Medusa - Destroy target creature at end of combat.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
