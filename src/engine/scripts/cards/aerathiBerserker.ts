// `Aerathi Berserker` - a becomesBlocked trigger rampage
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AERATHI_BERSERKER } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
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

const PRINTED = printed(AERATHI_BERSERKER, "Rampage 3 (Whenever this creature becomes blocked, it gets +3/+3 until end of turn for each creature blocking it beyond the first.)");

export const AERATHI_BERSERKER_SCRIPT: CardScript = {
  oracleId: AERATHI_BERSERKER.oracleId,
  name: AERATHI_BERSERKER.name,
  triggers: [
    {
      abilityId: 'becomesBlocked-0',
      text: PRINTED,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => b.attacker === self),
      label: () => "Aerathi Berserker - rampage",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        // Rampage 3 (CR 702.23): +N/+N for each creature blocking it beyond the first.
        const k = ctx.state.combat?.blockers.filter((b) => b.attackerOrder.includes(self)).length ?? 0;
        const n = 3 * Math.max(0, k - 1);
        return n > 0 ? [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: n, toughness: n }] : [];
      },
    },
  ],
};
