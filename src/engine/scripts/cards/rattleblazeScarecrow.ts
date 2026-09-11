// `Rattleblaze Scarecrow` - a conditional static (as long as you control a black creature) threshold, a conditional static (as long as you control a red creature) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RATTLEBLAZE_SCARECROW } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
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

const PRINTED = printed(RATTLEBLAZE_SCARECROW, "This creature has persist as long as you control a black creature. (When this creature dies, if it had no -1/-1 counters on it, return it to the battlefield under its owner's control with a -1/-1 counter on it.)\nThis creature has haste as long as you control a red creature.");
const LINES = PRINTED.split('\n');

// "as long as you control a black creature" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function cond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  let n = 0;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield') continue;
    if (inst.controller !== me) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.typeLine.types.includes("Creature")) continue;
    if (!face.colors.includes("B")) continue;
    n++;
  }
  return n >= 1;
}

// "as long as you control a red creature" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function cond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  let n = 0;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield') continue;
    if (inst.controller !== me) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.typeLine.types.includes("Creature")) continue;
    if (!face.colors.includes("R")) continue;
    n++;
  }
  return n >= 1;
}


export const RATTLEBLAZE_SCARECROW_SCRIPT: CardScript = {
  oracleId: RATTLEBLAZE_SCARECROW.oracleId,
  name: RATTLEBLAZE_SCARECROW.name,
  statics: [
    {
      abilityId: 'threshold-grant-0',
      text: LINES[0] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond0Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("persist");
      },
    },
    {
      abilityId: 'threshold-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond1Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("haste");
      },
    },
  ],
};
