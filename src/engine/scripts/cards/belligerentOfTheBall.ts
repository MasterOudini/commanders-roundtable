// `Belligerent of the Ball` - a combatOnYourTurn trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BELLIGERENT_OF_THE_BALL } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(BELLIGERENT_OF_THE_BALL, "Celebration — At the beginning of combat on your turn, if two or more nonland permanents entered the battlefield under your control this turn, target creature you control gets +1/+0 and gains menace until end of turn. (It can't be blocked except by two or more creatures.)");

const VOCAB_L0 = vocabularyEffects("Target creature you control gets +1/+0 and gains menace until end of turn.", BELLIGERENT_OF_THE_BALL.name);
const VOCAB_T_L0 = vocabularyTargets("Target creature you control gets +1/+0 and gains menace until end of turn.");

// "as long as two or more nonland permanents entered the battlefield under your control this turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  let n = 0;
  for (const id of ctx.state.turn.memory.entered[me] ?? []) {
    const inst = ctx.state.cards[id];
    const face = inst ? ctx.oracle.byPrinting(inst.printingId)?.faces[0] : undefined;
    if (face && (!face.typeLine.types.includes('Land'))) n++;
  }
  return n >= 2;
}


export const BELLIGERENT_OF_THE_BALL_SCRIPT: CardScript = {
  oracleId: BELLIGERENT_OF_THE_BALL.oracleId,
  name: BELLIGERENT_OF_THE_BALL.name,
  triggers: [
    {
      abilityId: 'combatOnYourTurn-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) =>
        ifCond0Of(ctx, self) &&
        (ev.t === 'StepBegan' && ev.step === 'beginCombat' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self)),
      label: () => "Belligerent of the Ball - Target creature you control gets +1/+0 and gains menace until end of turn.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond0Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
