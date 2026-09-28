// `Hookhand Mariner // Riphook Raider` - a static cantBeBlockedByPower
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HOOKHAND_MARINER_RIPHOOK_RAIDER } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(HOOKHAND_MARINER_RIPHOOK_RAIDER, "Daybound (If a player casts no spells during their own turn, it becomes night next turn.)\nThis creature can't be blocked by creatures with power 2 or less.\nNightbound (If a player casts at least two spells during their own turn, it becomes day next turn.)");
const LINES = PRINTED.split('\n');

export const HOOKHAND_MARINER_RIPHOOK_RAIDER_SCRIPT: CardScript = {
  oracleId: HOOKHAND_MARINER_RIPHOOK_RAIDER.oracleId,
  name: HOOKHAND_MARINER_RIPHOOK_RAIDER.name,
  combat: [
    {
      abilityId: 'cantBeBlockedByPower-1', face: 1,
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => attacker !== self || (ctx.derive(blocker).power ?? 0) > 2,
    },
  ],
};
