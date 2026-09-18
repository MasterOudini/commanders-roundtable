// `Arrogant Bloodlord` - a blocksOrBecomesBlockedBy trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ARROGANT_BLOODLORD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ARROGANT_BLOODLORD, "Whenever this creature blocks or becomes blocked by a creature with power 1 or less, destroy this creature at end of combat.");

const VOCAB_L0 = vocabularyEffects("Destroy ~ at end of combat.", ARROGANT_BLOODLORD.name);
const VOCAB_T_L0 = vocabularyTargets("Destroy ~ at end of combat.");

export const ARROGANT_BLOODLORD_SCRIPT: CardScript = {
  oracleId: ARROGANT_BLOODLORD.oracleId,
  name: ARROGANT_BLOODLORD.name,
  triggers: [
    {
      abilityId: 'blocksOrBecomesBlockedBy-0',
      text: PRINTED,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'BlockersDeclared' && ev.blocks.some((b) => (b.blocker === self && ctx.derive(b.attacker).typeLine.types.includes('Creature') && (ctx.derive(b.attacker).power ?? 0) <= 1) || (b.attacker === self && ctx.derive(b.blocker).typeLine.types.includes('Creature') && (ctx.derive(b.blocker).power ?? 0) <= 1)),
      label: () => "Arrogant Bloodlord - Destroy ~ at end of combat.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
