// `Necrogoyf` - a static cdaPower, a eachUpkeep trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NECROGOYF } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NECROGOYF, "Necrogoyf's power is equal to the number of creature cards in all graveyards.\nAt the beginning of each player's upkeep, that player discards a card.\nMadness {1}{B}{B} (If you discard this card, discard it into exile. When you do, cast it for its madness cost or put it into your graveyard.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target player discards a card.", NECROGOYF.name);
const VOCAB_T_L1 = vocabularyTargets("Target player discards a card.");

// "creature cards in all graveyards", read off the printed faces (a count is not a characteristic, CR 604.3).
function countOf_0(ctx: ScriptCtx, self: InstanceId): number {
  const me = ctx.state.cards[self];
  if (!me) return 0;
  const cards = Object.values(ctx.state.zones.graveyard).flat();
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


export const NECROGOYF_SCRIPT: CardScript = {
  oracleId: NECROGOYF.oracleId,
  name: NECROGOYF.name,
  triggers: [
    {
      abilityId: 'eachUpkeep-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      playerOf: (ctx) => ctx.state.turn.activePlayer,
      matches: (_ctx, _self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep',
      label: () => "Necrogoyf - Target player discards a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: VOCAB_T_L1.map(() => ({ kind: 'player' as const, id: obj.player as string })) }, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
  statics: [
    {
      abilityId: 'cda-0',
      text: LINES[0] as string,
      layer: 'cda',
      activeZones: ['battlefield'],
      appliesTo: (_ctx, self, candidate) => candidate === self,
      modify: (chars, ctx, self) => {
        const n = countOf_0(ctx, self);
        chars.power = n;
      },
    },
  ],
};
