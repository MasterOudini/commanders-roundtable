// `Séance Board` - a eachEndStep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { S_ANCE_BOARD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(S_ANCE_BOARD, "Morbid — At the beginning of each end step, if a creature died this turn, put a soul counter on this artifact.\n{T}: Add X mana of any one color, where X is the number of soul counters on this artifact. Spend this mana only to cast instant, sorcery, Demon, and Spirit spells.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Put a soul counter on this artifact.", S_ANCE_BOARD.name);
const VOCAB_T_L0 = vocabularyTargets("Put a soul counter on this artifact.");

// "as long as a creature died this turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return ctx.state.turn.memory.died.some((d) => { const inst = ctx.state.cards[d.card]; const face = inst ? ctx.oracle.byPrinting(inst.printingId)?.faces[0] : undefined; return !!face && face.typeLine.types.includes('Creature'); });
}


export const S_ANCE_BOARD_SCRIPT: CardScript = {
  oracleId: S_ANCE_BOARD.oracleId,
  name: S_ANCE_BOARD.name,
  triggers: [
    {
      abilityId: 'eachEndStep-0',
      text: LINES[0] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond0Of(ctx, self) &&
        (ev.t === 'StepBegan' && ev.step === 'end'),
      label: () => "Séance Board - Put a soul counter on this artifact.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond0Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
