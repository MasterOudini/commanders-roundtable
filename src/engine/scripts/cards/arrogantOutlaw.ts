// `Arrogant Outlaw` - a etb trigger drain
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ARROGANT_OUTLAW } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ARROGANT_OUTLAW, "When this creature enters, if an opponent lost life this turn, each opponent loses 2 life and you gain 2 life.");

// "as long as an opponent lost life this turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return ctx.state.seating.some((p) => p !== me && ctx.state.turn.memory.lostLife[p] === true);
}


export const ARROGANT_OUTLAW_SCRIPT: CardScript = {
  oracleId: ARROGANT_OUTLAW.oracleId,
  name: ARROGANT_OUTLAW.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond0Of(ctx, self) &&
        (ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield')),
      label: () => "Arrogant Outlaw - drain",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond0Of(ctx, self)) return [];
        const out: EventBody[] = [];
        for (const [pid, p] of Object.entries(ctx.state.players)) {
          if (pid === obj.controller) continue;
          out.push({ t: 'LifeChanged', player: pid, delta: -2, to: p.life - 2 });
        }
        const me = ctx.state.players[obj.controller];
        if (me) out.push({ t: 'LifeChanged', player: obj.controller, delta: 2, to: me.life + 2 });
        return out;
      },
    },
  ],
};
