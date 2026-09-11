// `Primary Research` - a etb trigger vocab, a endStep trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PRIMARY_RESEARCH } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(PRIMARY_RESEARCH, "When this enchantment enters, return target nonland permanent card with mana value 3 or less from your graveyard to the battlefield.\nAt the beginning of your end step, if a card left your graveyard this turn, draw a card.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Return target nonland permanent card with mana value 3 or less from your graveyard to the battlefield.", PRIMARY_RESEARCH.name);
const VOCAB_T_L0 = vocabularyTargets("Return target nonland permanent card with mana value 3 or less from your graveyard to the battlefield.");

// "as long as a card left your graveyard this turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.turn.memory.leftGraveyard[me] ?? 0) >= 1;
}


export const PRIMARY_RESEARCH_SCRIPT: CardScript = {
  oracleId: PRIMARY_RESEARCH.oracleId,
  name: PRIMARY_RESEARCH.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Primary Research - Return target nonland permanent card with mana value 3 or less from your graveyard to the battlefield.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'endStep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond1Of(ctx, self) &&
        (ev.t === 'StepBegan' && ev.step === 'end' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self)),
      label: () => "Primary Research - draw",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond1Of(ctx, self)) return [];
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
