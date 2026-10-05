// `Bandit's Haul` - a youCommitCrime trigger vocab, an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BANDIT_S_HAUL } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(BANDIT_S_HAUL, "Whenever you commit a crime, put a loot counter on this artifact. This ability triggers only once each turn. (Targeting opponents, anything they control, and/or cards in their graveyards is a crime.)\n{T}: Add one mana of any color.\n{2}, {T}, Remove two loot counters from this artifact: Draw a card.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Put a loot counter on this artifact.", BANDIT_S_HAUL.name);
const VOCAB_T_L0 = vocabularyTargets("Put a loot counter on this artifact.");

export const BANDITS_HAUL_SCRIPT: CardScript = {
  oracleId: BANDIT_S_HAUL.oracleId,
  name: BANDIT_S_HAUL.name,
  activated: [
    {
      ref: `${BANDIT_S_HAUL.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'youCommitCrime-0',
      text: LINES[0] as string,
      event: 'CrimeCommitted',
      activeZones: ['battlefield'],
      optional: false,
      oncePerTurn: true,
      matches: (ctx, self, ev) => ev.t === 'CrimeCommitted' && ev.player === ctx.query.controllerOf(self),
      label: () => "Bandit's Haul - Put a loot counter on this artifact.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
