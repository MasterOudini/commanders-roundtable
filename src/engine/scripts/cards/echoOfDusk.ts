// `Echo of Dusk` - a conditional static (as long as there are four or more permanent cards in your graveyard) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ECHO_OF_DUSK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ECHO_OF_DUSK, "Descend 4 — As long as there are four or more permanent cards in your graveyard, this creature gets +1/+1 and has lifelink.");

// "as long as there are four or more permanent cards in your graveyard" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function cond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  let n = 0;
  for (const id of ctx.state.zones.graveyard[me] ?? []) {
    const inst = ctx.state.cards[id];
    const face = inst ? ctx.oracle.byPrinting(inst.printingId)?.faces[0] : undefined;
    if (face && (['Artifact', 'Creature', 'Enchantment', 'Land', 'Planeswalker', 'Battle'].some((t) => face.typeLine.types.includes(t)))) n++;
  }
  return n >= 4;
}


export const ECHO_OF_DUSK_SCRIPT: CardScript = {
  oracleId: ECHO_OF_DUSK.oracleId,
  name: ECHO_OF_DUSK.name,
  statics: [
    {
      abilityId: 'threshold-pt-0',
      text: PRINTED,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond0Of(ctx, self),
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
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond0Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("lifelink");
      },
    },
  ],
};
