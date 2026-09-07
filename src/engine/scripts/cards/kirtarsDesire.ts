// `Kirtar's Desire` - a static attachedCombat, a static attachedCombat
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KIRTAR_S_DESIRE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { InstanceId } from '../../types/ids';

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

const PRINTED = printed(KIRTAR_S_DESIRE, "Enchant creature\nEnchanted creature can't attack.\nThreshold — Enchanted creature can't block as long as there are seven or more cards in your graveyard.");
const LINES = PRINTED.split('\n');

// Threshold - seven or more cards in its controller's graveyard, read off the zones (a count is not a characteristic, CR 604.3).
function thresholdOf(ctx: ScriptCtx, self: InstanceId): boolean {
  const who = ctx.query.controllerOf(self);
  return who !== null && (ctx.state.zones.graveyard[who] ?? []).length >= 7;
}

export const KIRTARS_DESIRE_SCRIPT: CardScript = {
  oracleId: KIRTAR_S_DESIRE.oracleId,
  name: KIRTAR_S_DESIRE.name,
  combat: [
    {
      abilityId: 'attached-combat-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canAttack: (ctx, self, candidate) => ctx.state.cards[self]?.attachedTo !== candidate,
    },
    {
      abilityId: 'attached-combat-2',
      text: LINES[2] as string,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker) => !thresholdOf(ctx, self) || ctx.state.cards[self]?.attachedTo !== blocker,
    },
  ],
};
