// `Aboshan's Desire` - a static attachedStatic, a static attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ABOSHAN_S_DESIRE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ABOSHAN_S_DESIRE, "Enchant creature\nEnchanted creature has flying.\nThreshold — Enchanted creature has shroud as long as there are seven or more cards in your graveyard. (It can't be the target of spells or abilities.)");
const LINES = PRINTED.split('\n');

// Threshold - seven or more cards in its controller's graveyard, read off the zones (a count is not a characteristic, CR 604.3).
function thresholdOf(ctx: ScriptCtx, self: InstanceId): boolean {
  const who = ctx.query.controllerOf(self);
  return who !== null && (ctx.state.zones.graveyard[who] ?? []).length >= 7;
}

export const ABOSHANS_DESIRE_SCRIPT: CardScript = {
  oracleId: ABOSHAN_S_DESIRE.oracleId,
  name: ABOSHAN_S_DESIRE.name,
  statics: [
    {
      abilityId: 'attached-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("flying");
      },
    },
    {
      abilityId: 'attached-grant-2',
      text: LINES[2] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate && thresholdOf(ctx, self),
      modify: (chars) => {
        chars.keywords.add("shroud");
      },
    },
  ],
};
