// `Rampaging Brontodon` - a VARIABLE PUMP (D386): the delta is COUNTED at each derive
// (CR 613.4c), never stored. The count reads the PRINTED faces of the counted objects
// (D317) - deriving them from inside a derive is unbounded recursion.
// Generated from one table row.

import { RAMPAGING_BRONTODON } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';
import type { CardScript, ScriptCtx } from '../api';

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

const PRINTED = printed(RAMPAGING_BRONTODON, "Trample\nWhenever this creature attacks, it gets +1/+1 until end of turn for each land you control.");
const LINES = PRINTED.split(String.fromCharCode(10));

function countOf(ctx: ScriptCtx, self: InstanceId, _applied: InstanceId): number {
  const me = ctx.state.cards[self];
  if (!me) return 0;
  let n = 0;
  for (const inst of Object.values(ctx.state.cards)) {
    if (inst.zone.kind !== 'battlefield') continue;
    if (inst.controller !== me.controller) continue;
    const face = ctx.oracle.byPrinting(inst.printingId)?.faces[0];
    if (!face) continue;
    if (!face.typeLine.types.includes("Land")) continue;
    n++;
  }
  return n;
}

export const RAMPAGING_BRONTODON_SCRIPT: CardScript = {
  oracleId: RAMPAGING_BRONTODON.oracleId,
  name: RAMPAGING_BRONTODON.name,
  triggers: [
    {
      abilityId: 'pump-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => {
        if (ev.t !== 'AttackersDeclared') return false;
        const who = self;
        if (who === null) return false;
        return ev.attackers.some((a) => a.card === who);
      },
      label: () => "Rampaging Brontodon - it pumped until end of turn",
      resolve: (ctx, self): readonly EventBody[] => {
        const who = self;
        if (who === null) return [];
        const target = ctx.state.cards[who];
        if (!target || target.zone.kind !== 'battlefield') return [];
        const n = countOf(ctx, self, who);
        if (n === 0) return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: who, power: 1 * n, toughness: 1 * n }];
      },
    },
  ],
};
