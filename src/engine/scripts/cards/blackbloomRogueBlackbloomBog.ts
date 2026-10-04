// `Blackbloom Rogue // Blackbloom Bog` - a conditional static (as long as an opponent has eight or more cards in their graveyard) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BLACKBLOOM_ROGUE_BLACKBLOOM_BOG } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { InstanceId } from '../../types/ids';

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

const PRINTED = printed(BLACKBLOOM_ROGUE_BLACKBLOOM_BOG, "Menace (This creature can't be blocked except by two or more creatures.)\nThis creature gets +3/+0 as long as an opponent has eight or more cards in their graveyard.\nThis land enters tapped.\n{T}: Add {B}.");
const LINES = PRINTED.split('\n');

// "as long as an opponent has eight or more cards in their graveyard" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function cond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return ctx.state.seating.filter((p) => p !== me).some((p) => (ctx.state.zones.graveyard[p] ?? []).length >= 8);
}


export const BLACKBLOOM_ROGUE_BLACKBLOOM_BOG_SCRIPT: CardScript = {
  oracleId: BLACKBLOOM_ROGUE_BLACKBLOOM_BOG.oracleId,
  name: BLACKBLOOM_ROGUE_BLACKBLOOM_BOG.name,
  statics: [
    {
      abilityId: 'threshold-pt-1', face: 0,
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond1Of(ctx, self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 3;
        if (chars.toughness !== null) chars.toughness += 0;
      },
    },
  ],
};
