// `Red Cliffs Armada` - a static cantAttackUnless
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RED_CLIFFS_ARMADA } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { DefenderRef } from '../../types/state';

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

const PRINTED = printed(RED_CLIFFS_ARMADA, "This creature can't attack unless defending player controls an Island.");

// "Island" - the defending player's board, read off derived characteristics (D338).
function defenderControls_0(ctx: ScriptCtx, defender: DefenderRef): boolean {
  const who = defender.kind === 'player' ? defender.id : ctx.state.cards[defender.id]?.controller;
  if (!who) return false;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield' || inst.controller !== who) continue;
    if (ctx.derive(inst.id).typeLine.subtypes.includes('Island')) return true;
  }
  return false;
}


export const RED_CLIFFS_ARMADA_SCRIPT: CardScript = {
  oracleId: RED_CLIFFS_ARMADA.oracleId,
  name: RED_CLIFFS_ARMADA.name,
  combat: [
    {
      abilityId: 'cantAttackUnless-0',
      text: PRINTED,
      activeZones: ['battlefield'],
      canAttackDefender: (ctx, self, candidate, defender) => candidate !== self || defenderControls_0(ctx, defender),
    },
  ],
};
