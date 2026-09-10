// `Spectral Cloak` - a conditional static (as long as it's untapped) attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPECTRAL_CLOAK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPECTRAL_CLOAK, "Enchant creature\nEnchanted creature has shroud as long as it's untapped. (It can't be the target of spells or abilities.)");
const LINES = PRINTED.split('\n');

// "as long as it's untapped" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D388).
function cond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.cards[self]?.tapped ?? false) === false;
}


export const SPECTRAL_CLOAK_SCRIPT: CardScript = {
  oracleId: SPECTRAL_CLOAK.oracleId,
  name: SPECTRAL_CLOAK.name,
  statics: [
    {
      abilityId: 'attached-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate && cond1Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("shroud");
      },
    },
  ],
};
