// `Dazzling Angel` — "Flying\nWhenever another creature you control enters,
// you gain 1 life." Soul Warden's two-def shape narrowed to the OWN side,
// with Boltwing Marauder's "another" exclusion. M6.4m, D170.

import { DAZZLING_ANGEL } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import type { ScriptCtx } from '../api';
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
  DAZZLING_ANGEL,
  'Flying\nWhenever another creature you control enters, you gain 1 life.',
);
const TEXT = PRINTED.split('\n')[1] as string;

/** "another creature you control" — asked of the DERIVED entrant. */
function qualifies(ctx: ScriptCtx, self: InstanceId, entrant: InstanceId): boolean {
  if (entrant === self) return false;
  const inst = ctx.state.cards[entrant];
  if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
  return ctx.derive(entrant).typeLine.types.includes('Creature');
}

function gainOne(ctx: ScriptCtx, obj: { readonly controller: string }): readonly EventBody[] {
  const player = ctx.state.players[obj.controller];
  if (!player) return [];
  return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
}

export const DAZZLING_ANGEL_SCRIPT: CardScript = {
  oracleId: DAZZLING_ANGEL.oracleId,
  name: DAZZLING_ANGEL.name,
  triggers: [
    {
      abilityId: 'etb-card',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) =>
            m.to.kind === 'battlefield' &&
            m.from.kind !== 'battlefield' &&
            qualifies(ctx, self, m.card),
        ),
      label: () => 'Dazzling Angel — you gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => gainOne(ctx, obj),
    },
    {
      abilityId: 'etb-token',
      text: TEXT,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'TokenCreated' && qualifies(ctx, self, ev.card),
      label: () => 'Dazzling Angel — you gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => gainOne(ctx, obj),
    },
  ],
};
