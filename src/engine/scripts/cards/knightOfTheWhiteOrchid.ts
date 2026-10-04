// `Knight of the White Orchid` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KNIGHT_OF_THE_WHITE_ORCHID } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KNIGHT_OF_THE_WHITE_ORCHID, "First strike\nWhen this creature enters, if an opponent controls more lands than you, you may search your library for a Plains card, put it onto the battlefield, then shuffle.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Search your library for a Plains card, put it onto the battlefield, then shuffle.", KNIGHT_OF_THE_WHITE_ORCHID.name);
const VOCAB_T_L1 = vocabularyTargets("Search your library for a Plains card, put it onto the battlefield, then shuffle.");

// "as long as an opponent controls more lands than you" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  const lands = (p: typeof me): number => ctx.state.zones.battlefield.filter((id) => { const inst = ctx.state.cards[id]; return inst?.controller === p && (ctx.oracle.byPrinting(inst.printingId)?.faces[inst.faceIndex ?? 0]?.typeLine.types.includes('Land') ?? false); }).length;
  return ctx.state.seating.some((p) => p !== me && lands(p) > lands(me));
}


export const KNIGHT_OF_THE_WHITE_ORCHID_SCRIPT: CardScript = {
  oracleId: KNIGHT_OF_THE_WHITE_ORCHID.oracleId,
  name: KNIGHT_OF_THE_WHITE_ORCHID.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) =>
        ifCond1Of(ctx, self) &&
        (ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield')),
      label: () => "Knight of the White Orchid - Search your library for a Plains card, put it onto the battlefield, then shuffle.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond1Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
