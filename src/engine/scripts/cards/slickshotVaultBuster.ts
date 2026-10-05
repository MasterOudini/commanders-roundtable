// `Slickshot Vault-Buster` - a conditional static (as long as you've committed a crime this turn) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SLICKSHOT_VAULT_BUSTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SLICKSHOT_VAULT_BUSTER, "Vigilance\nThis creature gets +2/+0 as long as you've committed a crime this turn. (Targeting opponents, anything they control, and/or cards in their graveyards is a crime.)");
const LINES = PRINTED.split('\n');

// "as long as you've committed a crime this turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function cond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.turn.memory.crimes?.[me] ?? 0) > 0;
}


export const SLICKSHOT_VAULT_BUSTER_SCRIPT: CardScript = {
  oracleId: SLICKSHOT_VAULT_BUSTER.oracleId,
  name: SLICKSHOT_VAULT_BUSTER.name,
  statics: [
    {
      abilityId: 'threshold-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond1Of(ctx, self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 2;
        if (chars.toughness !== null) chars.toughness += 0;
      },
    },
  ],
};
