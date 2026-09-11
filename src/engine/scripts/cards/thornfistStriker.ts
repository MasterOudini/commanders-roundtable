// `Thornfist Striker` - a conditional static (as long as you gained life this turn) anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THORNFIST_STRIKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(THORNFIST_STRIKER, "Ward {1} (Whenever this creature becomes the target of a spell or ability an opponent controls, counter it unless that player pays {1}.)\nInfusion — Creatures you control get +1/+0 and have trample as long as you gained life this turn.");
const LINES = PRINTED.split('\n');

// "as long as you gained life this turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function cond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return ctx.state.turn.memory.gainedLife[me] === true;
}


export const THORNFIST_STRIKER_SCRIPT: CardScript = {
  oracleId: THORNFIST_STRIKER.oracleId,
  name: THORNFIST_STRIKER.name,
  statics: [
    {
      abilityId: 'anthem-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self) && cond1Of(ctx, self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 0;
      },
    },
    {
      abilityId: 'anthem-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self) && cond1Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("trample");
      },
    },
  ],
};
