// `Zeriam, Golden Wind` — flying plus "Whenever a Griffin you control deals
// combat damage to a player, create a 2/2 white Griffin creature token with
// flying." The FILTERED per-item fan-out (D265's Utvara Hellkite) over
// `CombatDamageDealt`: one firing per Griffin of mine that connects — and
// Zeriam IS a Griffin, so its own hit counts. D259's rule: the line says
// "combat damage", so ONE event kind, never a `DamageDealt` arm. The keyword
// line never counts, so the def's text is `split[1]`. The 2/2 Griffin is one
// of this batch's four NEW pins (ttsr 1). D271.

import { ZERIAM_GOLDEN_WIND } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
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

const PRINTED = printed(
  ZERIAM_GOLDEN_WIND,
  'Flying\nWhenever a Griffin you control deals combat damage to a player, create a 2/2 white Griffin creature token with flying.',
);
const TEXT = PRINTED.split('\n')[1] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const GRIFFIN = tokenRef('Griffin|2/2|W|Creature|flying');

/** The Griffins of MINE among the connecting sources, one id each. */
function connectingGriffins(
  ctx: ScriptCtx,
  self: InstanceId,
  damages: readonly { source: InstanceId; target: { kind: string }; amount: number }[],
): InstanceId[] {
  const mine = ctx.query.controllerOf(self);
  const seen = new Set<InstanceId>();
  for (const d of damages) {
    if (d.target.kind !== 'player' || d.amount <= 0) continue;
    const inst = ctx.state.cards[d.source];
    if (!inst || inst.controller !== mine) continue;
    if (!ctx.derive(d.source).typeLine.subtypes.includes('Griffin')) continue;
    seen.add(d.source);
  }
  return [...seen];
}

export const ZERIAM_GOLDEN_WIND_SCRIPT: CardScript = {
  oracleId: ZERIAM_GOLDEN_WIND.oracleId,
  name: ZERIAM_GOLDEN_WIND.name,
  triggers: [
    {
      abilityId: 'griffin-connects',
      text: TEXT,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' && connectingGriffins(ctx, self, ev.damages).length > 0,
      // One firing per connecting Griffin OF MINE.
      perItem: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' ? connectingGriffins(ctx, self, ev.damages) : [],
      label: () => 'Zeriam, Golden Wind — create a 2/2 Griffin with flying',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: GRIFFIN.oracleId,
          printingId: GRIFFIN.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
