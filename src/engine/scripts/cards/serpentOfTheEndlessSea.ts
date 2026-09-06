// `Serpent of the Endless Sea` - a static cdaCount, a static cantAttackUnless
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SERPENT_OF_THE_ENDLESS_SEA } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { InstanceId } from '../../types/ids';
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

const PRINTED = printed(SERPENT_OF_THE_ENDLESS_SEA, "Serpent of the Endless Sea's power and toughness are each equal to the number of Islands you control.\nThis creature can't attack unless defending player controls an Island.");
const LINES = PRINTED.split('\n');

// "Islands you control", read off the printed faces (a count is not a characteristic, CR 604.3).
function countOf_0(ctx: ScriptCtx, self: InstanceId): number {
  const me = ctx.state.cards[self];
  if (!me) return 0;
  let n = 0;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield') continue;
    if (inst.controller !== me.controller) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.typeLine.subtypes.includes('Island')) continue;
    n++;
  }
  return n;
}


// "Island" - the defending player's board, read off derived characteristics (D338).
function defenderControls_1(ctx: ScriptCtx, defender: DefenderRef): boolean {
  const who = defender.kind === 'player' ? defender.id : ctx.state.cards[defender.id]?.controller;
  if (!who) return false;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield' || inst.controller !== who) continue;
    if (ctx.derive(inst.id).typeLine.subtypes.includes('Island')) return true;
  }
  return false;
}


export const SERPENT_OF_THE_ENDLESS_SEA_SCRIPT: CardScript = {
  oracleId: SERPENT_OF_THE_ENDLESS_SEA.oracleId,
  name: SERPENT_OF_THE_ENDLESS_SEA.name,
  combat: [
    {
      abilityId: 'cantAttackUnless-1',
      text: LINES[1] as string,
      activeZones: ['battlefield'],
      canAttackDefender: (ctx, self, candidate, defender) => candidate !== self || defenderControls_1(ctx, defender),
    },
  ],
  statics: [
    {
      abilityId: 'cda-0',
      text: LINES[0] as string,
      layer: 'cda',
      activeZones: ['battlefield'],
      appliesTo: (_ctx, self, candidate) => candidate === self,
      modify: (chars, ctx, self) => {
        const n = countOf_0(ctx, self);
        chars.power = n;
        chars.toughness = n;
      },
    },
  ],
};
