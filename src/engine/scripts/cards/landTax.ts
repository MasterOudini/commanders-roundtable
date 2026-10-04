// `Land Tax` - a upkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LAND_TAX } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LAND_TAX, "At the beginning of your upkeep, if an opponent controls more lands than you, you may search your library for up to three basic land cards, reveal them, put them into your hand, then shuffle.");

const VOCAB_L0 = vocabularyEffects("Search your library for up to three basic land cards, reveal them, put them into your hand, then shuffle.", LAND_TAX.name);
const VOCAB_T_L0 = vocabularyTargets("Search your library for up to three basic land cards, reveal them, put them into your hand, then shuffle.");

// "as long as an opponent controls more lands than you" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  const lands = (p: typeof me): number => ctx.state.zones.battlefield.filter((id) => { const inst = ctx.state.cards[id]; return inst?.controller === p && (ctx.oracle.byPrinting(inst.printingId)?.faces[inst.faceIndex ?? 0]?.typeLine.types.includes('Land') ?? false); }).length;
  return ctx.state.seating.some((p) => p !== me && lands(p) > lands(me));
}


export const LAND_TAX_SCRIPT: CardScript = {
  oracleId: LAND_TAX.oracleId,
  name: LAND_TAX.name,
  triggers: [
    {
      abilityId: 'upkeep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) =>
        ifCond0Of(ctx, self) &&
        (ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self)),
      label: () => "Land Tax - Search your library for up to three basic land cards, reveal them, put them into your hand, then shuffle.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond0Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
