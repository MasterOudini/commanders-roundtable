// `Franklin Richards, Ascendant` - a combatOnYourTurn trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FRANKLIN_RICHARDS_ASCENDANT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FRANKLIN_RICHARDS_ASCENDANT, "At the beginning of combat on your turn, if you've cast a noncreature spell this turn, discover 6. (Exile cards from the top of your library until you exile a nonland card with mana value 6 or less. Cast it without paying its mana cost or put it into your hand. Put the rest on the bottom in a random order.)");

const VOCAB_L0 = vocabularyEffects("Discover 6.", FRANKLIN_RICHARDS_ASCENDANT.name);
const VOCAB_T_L0 = vocabularyTargets("Discover 6.");

// "as long as you've cast a noncreature spell this turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  for (const id of ctx.state.turn.memory.cast[me] ?? []) {
    const inst = ctx.state.cards[id];
    const face = inst ? ctx.oracle.byPrinting(inst.printingId)?.faces[0] : undefined;
    if (face && (!face.typeLine.types.includes('Creature'))) return true;
  }
  return false;
}


export const FRANKLIN_RICHARDS_ASCENDANT_SCRIPT: CardScript = {
  oracleId: FRANKLIN_RICHARDS_ASCENDANT.oracleId,
  name: FRANKLIN_RICHARDS_ASCENDANT.name,
  triggers: [
    {
      abilityId: 'combatOnYourTurn-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond0Of(ctx, self) &&
        (ev.t === 'StepBegan' && ev.step === 'beginCombat' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self)),
      label: () => "Franklin Richards, Ascendant - Discover 6.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond0Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
