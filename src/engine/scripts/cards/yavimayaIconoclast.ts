// `Yavimaya Iconoclast` - a etb trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { YAVIMAYA_ICONOCLAST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(YAVIMAYA_ICONOCLAST, "Kicker {R} (You may pay an additional {R} as you cast this spell.)\nTrample\nWhen this creature enters, if it was kicked, it gets +1/+1 and gains haste until end of turn.");
const LINES = PRINTED.split('\n');

// "as long as it was kicked" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond2Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.cards[self]?.kicked ?? 0) > 0;
}


export const YAVIMAYA_ICONOCLAST_SCRIPT: CardScript = {
  oracleId: YAVIMAYA_ICONOCLAST.oracleId,
  name: YAVIMAYA_ICONOCLAST.name,
  triggers: [
    {
      abilityId: 'etb-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond2Of(ctx, self) &&
        (ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield')),
      label: () => "Yavimaya Iconoclast - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        if (!ifCond2Of(ctx, self)) return [];
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 1, keywords: ["haste"] }];
      },
    },
  ],
};
