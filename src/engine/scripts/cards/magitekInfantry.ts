// `Magitek Infantry` - a conditional static (as long as you control another artifact) threshold, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MAGITEK_INFANTRY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MAGITEK_INFANTRY, "This creature gets +1/+0 as long as you control another artifact.\n{2}{W}: Search your library for a card named Magitek Infantry, put it onto the battlefield tapped, then shuffle.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Search your library for a card named ~, put it onto the battlefield tapped, then shuffle.", MAGITEK_INFANTRY.name);
const VOCAB_T_A0 = vocabularyTargets("Search your library for a card named ~, put it onto the battlefield tapped, then shuffle.");

// "as long as you control another artifact" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function cond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  let n = 0;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield') continue;
    if (inst.controller !== me) continue;
    if (inst.id === self) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.typeLine.types.includes("Artifact")) continue;
    n++;
  }
  return n >= 1;
}


export const MAGITEK_INFANTRY_SCRIPT: CardScript = {
  oracleId: MAGITEK_INFANTRY.oracleId,
  name: MAGITEK_INFANTRY.name,
  activated: [
    {
      ref: `${MAGITEK_INFANTRY.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  statics: [
    {
      abilityId: 'threshold-pt-0',
      text: LINES[0] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond0Of(ctx, self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 0;
      },
    },
  ],
};
