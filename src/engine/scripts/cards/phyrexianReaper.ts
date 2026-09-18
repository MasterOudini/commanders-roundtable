// `Phyrexian Reaper` - a becomesBlocked trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PHYREXIAN_REAPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PHYREXIAN_REAPER, "Whenever this creature becomes blocked by a green creature, destroy that creature. It can't be regenerated.");

const VOCAB_L0 = vocabularyEffects("Destroy target creature. It can't be regenerated.", PHYREXIAN_REAPER.name);
const VOCAB_T_L0 = vocabularyTargets("Destroy target creature. It can't be regenerated.");

export const PHYREXIAN_REAPER_SCRIPT: CardScript = {
  oracleId: PHYREXIAN_REAPER.oracleId,
  name: PHYREXIAN_REAPER.name,
  triggers: [
    {
      abilityId: 'becomesBlocked-0',
      text: PRINTED,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      perItem: (_ctx, self, ev) => (ev.t === 'BlockersDeclared' ? ev.blocks.filter((b) => b.attacker === self).map((b) => b.blocker) : []),
      matches: (ctx, self, ev) =>
        ev.t === 'BlockersDeclared' &&
        ev.blocks.some((b) => b.attacker === self && ctx.derive(b.blocker).typeLine.types.includes('Creature') && ctx.derive(b.blocker).colors.includes('G')),
      label: () => "Phyrexian Reaper - Destroy target creature. It can't be regenerated.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
