// `Lord Dregg, Insect Invader` - a endStep trigger token, an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LORD_DREGG_INSECT_INVADER } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
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

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" - re-check before re-registering (D90).`);
  return ref;
}

const PRINTED = printed(LORD_DREGG_INSECT_INVADER, "Flying\nDisappear — At the beginning of your end step, if a permanent left the battlefield under your control this turn, create a 1/1 black Insect Warrior creature token with flying.\n{3}{G}, Sacrifice a token: Draw a card.");
const LINES = PRINTED.split('\n');
const TOKEN_L1 = tokenRef("Insect Warrior|1/1|B|Creature|flying");

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


export const LORD_DREGG_INSECT_INVADER_SCRIPT: CardScript = {
  oracleId: LORD_DREGG_INSECT_INVADER.oracleId,
  name: LORD_DREGG_INSECT_INVADER.name,
  activated: [
    {
      ref: `${LORD_DREGG_INSECT_INVADER.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'endStep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond1Of(ctx, self) &&
        (ev.t === 'StepBegan' && ev.step === 'end' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self)),
      label: () => "Lord Dregg, Insect Invader - token",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond1Of(ctx, self)) return [];
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_L1.oracleId,
          printingId: TOKEN_L1.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
};
