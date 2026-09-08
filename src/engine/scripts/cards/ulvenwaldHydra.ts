// `Ulvenwald Hydra` - a static cdaCount, a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ULVENWALD_HYDRA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ULVENWALD_HYDRA, "Reach\nUlvenwald Hydra's power and toughness are each equal to the number of lands you control.\nWhen this creature enters, you may search your library for a land card, put it onto the battlefield tapped, then shuffle.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Search your library for a land card, put it onto the battlefield tapped, then shuffle.", ULVENWALD_HYDRA.name);
const VOCAB_T_L2 = vocabularyTargets("Search your library for a land card, put it onto the battlefield tapped, then shuffle.");

// "lands you control", read off the printed faces (a count is not a characteristic, CR 604.3).
function countOf_1(ctx: ScriptCtx, self: InstanceId): number {
  const me = ctx.state.cards[self];
  if (!me) return 0;
  let n = 0;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield') continue;
    if (inst.controller !== me.controller) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.typeLine.types.includes('Land')) continue;
    n++;
  }
  return n;
}


export const ULVENWALD_HYDRA_SCRIPT: CardScript = {
  oracleId: ULVENWALD_HYDRA.oracleId,
  name: ULVENWALD_HYDRA.name,
  triggers: [
    {
      abilityId: 'etb-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Ulvenwald Hydra - Search your library for a land card, put it onto the battlefield tapped, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
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
