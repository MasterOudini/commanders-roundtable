// `Splinterfright` - a static cdaCount, a upkeep trigger mill
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPLINTERFRIGHT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPLINTERFRIGHT, "Trample\nSplinterfright's power and toughness are each equal to the number of creature cards in your graveyard.\nAt the beginning of your upkeep, mill two cards. (Put the top two cards of your library into your graveyard.)");
const LINES = PRINTED.split('\n');

// "creature cards in your graveyard", read off the printed faces (a count is not a characteristic, CR 604.3).
function countOf_1(ctx: ScriptCtx, self: InstanceId): number {
  const me = ctx.state.cards[self];
  if (!me) return 0;
  const cards = ctx.state.zones.graveyard[me.controller] ?? [];
  let n = 0;
  for (const id of cards) {
    const inst = ctx.state.cards[id];
    if (!inst) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.typeLine.types.includes('Creature')) continue;
    n++;
  }
  return n;
}


export const SPLINTERFRIGHT_SCRIPT: CardScript = {
  oracleId: SPLINTERFRIGHT.oracleId,
  name: SPLINTERFRIGHT.name,
  triggers: [
    {
      abilityId: 'upkeep-2',
      text: LINES[2] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Splinterfright - mill",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // The top of a library is the END of the array (drawFromTop).
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const top = library.slice(Math.max(0, library.length - 2));
        if (top.length === 0) return [];
        return [{ t: 'CardsMoved', moves: top.map((card) => ({ card, from: { kind: 'library' as const, player: obj.controller }, to: { kind: 'graveyard' as const, player: obj.controller } })) }];
      },
    },
  ],
  statics: [
    {
      abilityId: 'cda-1',
      text: LINES[1] as string,
      layer: 'cda',
      activeZones: ['battlefield'],
      appliesTo: (_ctx, self, candidate) => candidate === self,
      modify: (chars, ctx, self) => {
        const n = countOf_1(ctx, self);
        chars.power = n;
        chars.toughness = n;
      },
    },
  ],
};
