// `Lurking Green Dragon` - a static cantAttackUnless
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LURKING_GREEN_DRAGON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LURKING_GREEN_DRAGON, "Flying\nThis creature can't attack unless defending player controls a creature with flying.");
const LINES = PRINTED.split('\n');

// "creature with flying" - the defending player's board, read off derived characteristics (D338).
function defenderControls_1(ctx: ScriptCtx, defender: DefenderRef): boolean {
  const who = defender.kind === 'player' ? defender.id : ctx.state.cards[defender.id]?.controller;
  if (!who) return false;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield' || inst.controller !== who) continue;
    const d = ctx.derive(inst.id);
    if (d.typeLine.types.includes('Creature') && d.keywords.has('flying')) return true;
  }
  return false;
}


export const LURKING_GREEN_DRAGON_SCRIPT: CardScript = {
  oracleId: LURKING_GREEN_DRAGON.oracleId,
  name: LURKING_GREEN_DRAGON.name,
  combat: [
    {
      abilityId: 'cantAttackUnless-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canAttackDefender: (ctx, self, candidate, defender) => candidate !== self || defenderControls_1(ctx, defender),
    },
  ],
};
