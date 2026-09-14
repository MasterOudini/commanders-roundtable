// `Loyal Drake` - a combatOnYourTurn trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LOYAL_DRAKE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LOYAL_DRAKE, "Flying\nLieutenant — At the beginning of combat on your turn, if you control your commander, draw a card.");
const LINES = PRINTED.split('\n');

// "as long as you control your commander" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.players[me]?.commanderIds ?? []).some((id) => ctx.state.cards[id]?.zone.kind === 'battlefield' && ctx.state.cards[id]?.controller === me);
}


export const LOYAL_DRAKE_SCRIPT: CardScript = {
  oracleId: LOYAL_DRAKE.oracleId,
  name: LOYAL_DRAKE.name,
  triggers: [
    {
      abilityId: 'combatOnYourTurn-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond1Of(ctx, self) &&
        (ev.t === 'StepBegan' && ev.step === 'beginCombat' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self)),
      label: () => "Loyal Drake - draw",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond1Of(ctx, self)) return [];
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
