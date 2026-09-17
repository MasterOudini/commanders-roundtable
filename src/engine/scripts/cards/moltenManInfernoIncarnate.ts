// `Molten Man, Inferno Incarnate` - a etb trigger vocab, a static pumpPer, a leavesBattlefield trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MOLTEN_MAN_INFERNO_INCARNATE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MOLTEN_MAN_INFERNO_INCARNATE, "When Molten Man enters, search your library for a basic Mountain card, put it onto the battlefield tapped, then shuffle.\nMolten Man gets +1/+1 for each Mountain you control.\nWhen Molten Man leaves the battlefield, sacrifice a land.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Search your library for a basic Mountain card, put it onto the battlefield tapped, then shuffle.", MOLTEN_MAN_INFERNO_INCARNATE.name);
const VOCAB_T_L0 = vocabularyTargets("Search your library for a basic Mountain card, put it onto the battlefield tapped, then shuffle.");
const VOCAB_L2 = vocabularyEffects("Sacrifice a land.", MOLTEN_MAN_INFERNO_INCARNATE.name);
const VOCAB_T_L2 = vocabularyTargets("Sacrifice a land.");

// "Mountain you control", read off the printed faces (a count is not a characteristic, CR 604.3).
function countOf_1(ctx: ScriptCtx, self: InstanceId): number {
  const me = ctx.state.cards[self];
  if (!me) return 0;
  let n = 0;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield') continue;
    if (inst.controller !== me.controller) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.typeLine.subtypes.includes('Mountain')) continue;
    n++;
  }
  return n;
}


export const MOLTEN_MAN_INFERNO_INCARNATE_SCRIPT: CardScript = {
  oracleId: MOLTEN_MAN_INFERNO_INCARNATE.oracleId,
  name: MOLTEN_MAN_INFERNO_INCARNATE.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Molten Man, Inferno Incarnate - Search your library for a basic Mountain card, put it onto the battlefield tapped, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'leavesBattlefield-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind !== 'battlefield'),
      label: () => "Molten Man, Inferno Incarnate - Sacrifice a land.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
  statics: [
    {
      abilityId: 'pump-per-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (_ctx, self, candidate) => candidate === self,
      modify: (chars, ctx, self) => {
        const n = countOf_1(ctx, self);
        if (chars.power !== null) chars.power += n * 1;
        if (chars.toughness !== null) chars.toughness += n * 1;
      },
    },
  ],
};
