// `Skyhunter Strike Force` - a conditional static (as long as you control your commander) anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SKYHUNTER_STRIKE_FORCE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SKYHUNTER_STRIKE_FORCE, "Flying\nMelee (Whenever this creature attacks, it gets +1/+1 until end of turn for each opponent you attacked this combat.)\nLieutenant — As long as you control your commander, other creatures you control have melee.");
const LINES = PRINTED.split('\n');

// "as long as you control your commander" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D388).
function cond2Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.players[me]?.commanderIds ?? []).some((id) => ctx.state.cards[id]?.zone.kind === 'battlefield' && ctx.state.cards[id]?.controller === me);
}


export const SKYHUNTER_STRIKE_FORCE_SCRIPT: CardScript = {
  oracleId: SKYHUNTER_STRIKE_FORCE.oracleId,
  name: SKYHUNTER_STRIKE_FORCE.name,
  statics: [
    {
      abilityId: 'anthem-grant-2',
      text: LINES[2] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self) && cond2Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("melee");
      },
    },
  ],
};
