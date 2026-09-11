// `Rakdos Pit Dragon` - an activation pumping itself, an activation pumping itself, a conditional static (as long as you have no cards in hand) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RAKDOS_PIT_DRAGON } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
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

const PRINTED = printed(RAKDOS_PIT_DRAGON, "{R}{R}: This creature gains flying until end of turn.\n{R}: This creature gets +1/+0 until end of turn.\nHellbent — This creature has double strike as long as you have no cards in hand.");
const LINES = PRINTED.split('\n');

// "as long as you have no cards in hand" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function cond2Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.zones.hand[me] ?? []).length <= 0;
}


export const RAKDOS_PIT_DRAGON_SCRIPT: CardScript = {
  oracleId: RAKDOS_PIT_DRAGON.oracleId,
  name: RAKDOS_PIT_DRAGON.name,
  activated: [
    {
      ref: `${RAKDOS_PIT_DRAGON.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["flying"] }];
      },
    },
    {
      ref: `${RAKDOS_PIT_DRAGON.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0 }];
      },
    },
  ],
  statics: [
    {
      abilityId: 'threshold-grant-2',
      text: LINES[2] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond2Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("doubleStrike");
      },
    },
  ],
};
