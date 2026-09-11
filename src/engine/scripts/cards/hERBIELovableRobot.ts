// `H.E.R.B.I.E., Lovable Robot` - a combatOnYourTurn trigger scry
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { H_E_R_B_I_E_LOVABLE_ROBOT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(H_E_R_B_I_E_LOVABLE_ROBOT, "Flying\nAt the beginning of combat on your turn, if you've cast a noncreature spell this turn, surveil 1.\n{T}: Add {C}.\n{1}, {T}: Add one mana of any color.");
const LINES = PRINTED.split('\n');

// "as long as you've cast a noncreature spell this turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  for (const id of ctx.state.turn.memory.cast[me] ?? []) {
    const inst = ctx.state.cards[id];
    const face = inst ? ctx.oracle.byPrinting(inst.printingId)?.faces[0] : undefined;
    if (face && (!face.typeLine.types.includes('Creature'))) return true;
  }
  return false;
}


export const H_ERBIELOVABLE_ROBOT_SCRIPT: CardScript = {
  oracleId: H_E_R_B_I_E_LOVABLE_ROBOT.oracleId,
  name: H_E_R_B_I_E_LOVABLE_ROBOT.name,
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
      label: () => "H.E.R.B.I.E., Lovable Robot - scry",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond1Of(ctx, self)) return [];
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(1, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count: n, toGraveyard: true, thenDraw: 0, label: "H.E.R.B.I.E., Lovable Robot - surveil 1" } },
        ];
      },
    },
  ],
};
