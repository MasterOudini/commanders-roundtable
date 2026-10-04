// `Heir of the Wilds` - a attacks trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HEIR_OF_THE_WILDS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HEIR_OF_THE_WILDS, "Deathtouch\nFerocious — Whenever this creature attacks, if you control a creature with power 4 or greater, this creature gets +1/+1 until end of turn.");
const LINES = PRINTED.split('\n');

// "as long as you control a creature with power 4 or greater" - read off the DERIVED power of the controller's creatures (D621 - an intervening if and an activation only, never a static).
function ifCond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return ctx.state.zones.battlefield.some((id) => ctx.state.cards[id]?.controller === me && ctx.derive(id).isCreature && (ctx.derive(id).power ?? -1) >= 4);
}


export const HEIR_OF_THE_WILDS_SCRIPT: CardScript = {
  oracleId: HEIR_OF_THE_WILDS.oracleId,
  name: HEIR_OF_THE_WILDS.name,
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond1Of(ctx, self) &&
        (ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self)),
      label: () => "Heir of the Wilds - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        if (!ifCond1Of(ctx, self)) return [];
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 1 }];
      },
    },
  ],
};
