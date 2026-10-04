// `Emeritus of Abundance // Regrowth` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EMERITUS_OF_ABUNDANCE_REGROWTH } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(EMERITUS_OF_ABUNDANCE_REGROWTH, "Vigilance\nThis creature enters prepared.\nWhenever this creature attacks, if you control eight or more lands, this creature becomes prepared.\nReturn target card from your graveyard to your hand.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("~ becomes prepared.", EMERITUS_OF_ABUNDANCE_REGROWTH.name);
const VOCAB_T_L2 = vocabularyTargets("~ becomes prepared.");

// "as long as you control eight or more lands" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function ifCond2Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  let n = 0;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield' || inst.phasedOut) continue;
    if (inst.controller !== me) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.typeLine.types.includes("Land")) continue;
    n++;
  }
  return n >= 8;
}


export const EMERITUS_OF_ABUNDANCE_REGROWTH_SCRIPT: CardScript = {
  oracleId: EMERITUS_OF_ABUNDANCE_REGROWTH.oracleId,
  name: EMERITUS_OF_ABUNDANCE_REGROWTH.name,
  triggers: [
    {
      abilityId: 'attacks-2', face: 0,
      text: LINES[2] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ifCond2Of(ctx, self) &&
        (ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self)),
      label: () => "Emeritus of Abundance // Regrowth - ~ becomes prepared.",
      resolve: (ctx, self, obj): readonly EventBody[] => {
        if (!ifCond2Of(ctx, self)) return [];
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
