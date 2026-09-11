// `Cliffrunner Behemoth` - a conditional static (as long as you control a red permanent) threshold, a conditional static (as long as you control a white permanent) threshold
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CLIFFRUNNER_BEHEMOTH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CLIFFRUNNER_BEHEMOTH, "This creature has haste as long as you control a red permanent.\nThis creature has lifelink as long as you control a white permanent.");
const LINES = PRINTED.split('\n');

// "as long as you control a red permanent" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function cond0Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  let n = 0;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield') continue;
    if (inst.controller !== me) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.colors.includes("R")) continue;
    n++;
  }
  return n >= 1;
}

// "as long as you control a white permanent" - read off the state, the PRINTED faces, the turn record, the life totals and the live combat; never derived (D317, D398).
function cond1Of(ctx: ScriptCtx, self: InstanceId): boolean {
  const me = ctx.query.controllerOf(self);
  if (me === null) return false;
  let n = 0;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield') continue;
    if (inst.controller !== me) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.colors.includes("W")) continue;
    n++;
  }
  return n >= 1;
}


export const CLIFFRUNNER_BEHEMOTH_SCRIPT: CardScript = {
  oracleId: CLIFFRUNNER_BEHEMOTH.oracleId,
  name: CLIFFRUNNER_BEHEMOTH.name,
  statics: [
    {
      abilityId: 'threshold-grant-0',
      text: LINES[0] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond0Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("haste");
      },
    },
    {
      abilityId: 'threshold-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => candidate === self && cond1Of(ctx, self),
      modify: (chars) => {
        chars.keywords.add("lifelink");
      },
    },
  ],
};
