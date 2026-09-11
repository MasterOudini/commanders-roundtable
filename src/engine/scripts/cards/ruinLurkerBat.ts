// `Ruin-Lurker Bat` - a endStep trigger scry
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RUIN_LURKER_BAT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RUIN_LURKER_BAT, "Flying, lifelink\nAt the beginning of your end step, if you descended this turn, scry 1. (You descended if a permanent card was put into your graveyard from anywhere.)");
const LINES = PRINTED.split('\n');

// "as long as you descended this turn" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  return (ctx.state.turn.memory.toGraveyard[me] ?? []).some((id) => {
    const inst = ctx.state.cards[id];
    const face = inst ? ctx.oracle.byPrinting(inst.printingId)?.faces[0] : undefined;
    return !!face && face.typeLine.types.some((t) => ['Artifact', 'Creature', 'Enchantment', 'Land', 'Planeswalker', 'Battle'].includes(t));
  });
}


export const RUIN_LURKER_BAT_SCRIPT: CardScript = {
  oracleId: RUIN_LURKER_BAT.oracleId,
  name: RUIN_LURKER_BAT.name,
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
      label: () => "Ruin-Lurker Bat - scry",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond1Of(ctx, self)) return [];
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(1, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count: n, toGraveyard: false, thenDraw: 0, label: "Ruin-Lurker Bat - scry 1" } },
        ];
      },
    },
  ],
};
