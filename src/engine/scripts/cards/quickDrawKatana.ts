// `Quick-Draw Katana` - a conditional static (as long as it's your turn) attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { QUICK_DRAW_KATANA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(QUICK_DRAW_KATANA, "During your turn, equipped creature gets +2/+0 and has first strike. (It deals combat damage before creatures without first strike.)\nEquip {2} ({2}: Attach to target creature you control. Equip only as a sorcery.)");
const LINES = PRINTED.split('\n');

// "as long as it's your turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function cond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return ctx.state.turn.activePlayer === me;
}


export const QUICK_DRAW_KATANA_SCRIPT: CardScript = {
  oracleId: QUICK_DRAW_KATANA.oracleId,
  name: QUICK_DRAW_KATANA.name,
  statics: [
    {
      abilityId: 'attached-pt-0',
      text: LINES[0] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate && cond0Of(ctx, self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 2;
        if (chars.toughness !== null) chars.toughness += 0;
      },
    },
    {
      abilityId: 'attached-grant-0',
      text: LINES[0] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate && cond0Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("firstStrike");
      },
    },
  ],
};
