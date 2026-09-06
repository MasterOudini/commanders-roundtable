// `Mystic Zealot` - a static threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MYSTIC_ZEALOT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MYSTIC_ZEALOT, "Threshold — As long as there are seven or more cards in your graveyard, this creature gets +1/+1 and has flying.");

// Threshold - seven or more cards in its controller's graveyard, read off the zones (a count is not a characteristic, CR 604.3).
function thresholdOf(ctx: ScriptCtx, self: InstanceId): boolean {
  const who = ctx.query.controllerOf(self);
  return who !== null && (ctx.state.zones.graveyard[who] ?? []).length >= 7;
}

export const MYSTIC_ZEALOT_SCRIPT: CardScript = {
  oracleId: MYSTIC_ZEALOT.oracleId,
  name: MYSTIC_ZEALOT.name,
  statics: [
    {
      abilityId: 'threshold-pt-0',
      text: PRINTED,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && thresholdOf(ctx, self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
    {
      abilityId: 'threshold-grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && thresholdOf(ctx, self),
      modify: (chars) => {
        chars.keywords.add("flying");
      },
    },
  ],
};
