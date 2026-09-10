// `Gang of Elk` - a VARIABLE PUMP (D387): the delta is COUNTED at each derive
// (CR 613.4c), never stored. The count reads the PRINTED faces of the counted objects
// (D317) - deriving them from inside a derive is unbounded recursion.
// Generated from one table row.

import { GANG_OF_ELK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GANG_OF_ELK, "Whenever this creature becomes blocked, it gets +2/+2 until end of turn for each creature blocking it.");
const LINES = PRINTED.split(String.fromCharCode(10));

function countOf(ctx: ScriptCtx, self: InstanceId, applied: InstanceId): number {
  const me = ctx.state.cards[self];
  if (!me) return 0;
  let n = 0;
  n = (ctx.state.combat?.blockers ?? []).filter((b) => b.attackerOrder.includes(applied)).length;
  return n;
}

export const GANG_OF_ELK_SCRIPT: CardScript = {
  oracleId: GANG_OF_ELK.oracleId,
  name: GANG_OF_ELK.name,
  triggers: [
    {
      abilityId: 'pump-0',
      text: LINES[0] as string,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => {
        if (ev.t !== 'BlockersDeclared') return false;
        const who = self;
        if (who === null) return false;
        return ev.blocks.some((b) => b.attacker === who);
      },
      label: () => "Gang of Elk - blocked, it pumped until end of turn",
      resolve: (ctx, self): readonly EventBody[] => {
        const who = self;
        if (who === null) return [];
        const target = ctx.state.cards[who];
        if (!target || target.zone.kind !== 'battlefield') return [];
        const n = countOf(ctx, self, who);
        if (n === 0) return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: who, power: 2 * n, toughness: 2 * n }];
      },
    },
  ],
};
