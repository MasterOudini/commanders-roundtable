// `Metamorphic Wurm` - a static threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { METAMORPHIC_WURM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(METAMORPHIC_WURM, "Threshold — This creature gets +4/+4 as long as there are seven or more cards in your graveyard.");

// Threshold - seven or more cards in its controller's graveyard, read off the zones (a count is not a characteristic, CR 604.3).
function thresholdOf(ctx: ScriptCtx, self: InstanceId): boolean {
  const who = ctx.query.controllerOf(self);
  return who !== null && (ctx.state.zones.graveyard[who] ?? []).length >= 7;
}

export const METAMORPHIC_WURM_SCRIPT: CardScript = {
  oracleId: METAMORPHIC_WURM.oracleId,
  name: METAMORPHIC_WURM.name,
  statics: [
    {
      abilityId: 'threshold-pt-0',
      text: PRINTED,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && thresholdOf(ctx, self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 4;
        if (chars.toughness !== null) chars.toughness += 4;
      },
    },
  ],
};
