// `Silkweaver Elite` - a etb trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SILKWEAVER_ELITE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SILKWEAVER_ELITE, "Reach (This creature can block creatures with flying.)\nRevolt — When this creature enters, if a permanent left the battlefield under your control this turn, draw a card.");
const LINES = PRINTED.split('\n');

// "as long as a permanent left the battlefield under your control this turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  for (const e of ctx.state.turn.memory.left) {
    if (e.controller !== me) continue;
    return true;
  }
  return false;
}


export const SILKWEAVER_ELITE_SCRIPT: CardScript = {
  oracleId: SILKWEAVER_ELITE.oracleId,
  name: SILKWEAVER_ELITE.name,
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
      label: () => "Silkweaver Elite - draw",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond1Of(ctx, self)) return [];
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
