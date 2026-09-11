// `Citanul Woodreaders` - a etb trigger drawN
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CITANUL_WOODREADERS } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(CITANUL_WOODREADERS, "Kicker {2}{G} (You may pay an additional {2}{G} as you cast this spell.)\nWhen this creature enters, if it was kicked, draw two cards.");
const LINES = PRINTED.split('\n');

// "as long as it was kicked" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.cards[self]?.kicked ?? 0) > 0;
}


export const CITANUL_WOODREADERS_SCRIPT: CardScript = {
  oracleId: CITANUL_WOODREADERS.oracleId,
  name: CITANUL_WOODREADERS.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond1Of(ctx, self) &&
        (ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield')),
      label: () => "Citanul Woodreaders - drawN",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond1Of(ctx, self)) return [];
        return drawEvents(ctx.state, obj.controller, 2);
      },
    },
  ],
};
