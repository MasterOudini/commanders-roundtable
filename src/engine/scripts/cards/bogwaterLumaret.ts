// `Bogwater Lumaret` — "Whenever this creature or another creature you
// control enters, you gain 1 life." Soul Warden's two-defs-one-line rule
// scoped to the controller — and SELF included: its own entry pays too, so
// there is deliberately no `m.card !== self` exclusion. M6.4h, D165.

import { BOGWATER_LUMARET } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { StackObject } from '../../types/state';
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

const TEXT = printed(
  BOGWATER_LUMARET,
  'Whenever this creature or another creature you control enters, you gain 1 life.',
);

function gainOne(ctx: ScriptCtx, _self: InstanceId, obj: StackObject): readonly EventBody[] {
  const player = ctx.state.players[obj.controller];
  if (!player) return [];
  return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
}

export const BOGWATER_LUMARET_SCRIPT: CardScript = {
  oracleId: BOGWATER_LUMARET.oracleId,
  name: BOGWATER_LUMARET.name,
  triggers: [
    {
      abilityId: 'etb-card',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'CardsMoved') return false;
        const mine = ctx.query.controllerOf(self);
        return ev.moves.some((m) => {
          if (m.to.kind !== 'battlefield' || m.from.kind === 'battlefield') return false;
          const card = ctx.state.cards[m.card];
          if (!card || card.controller !== mine) return false;
          return ctx.derive(m.card).typeLine.types.includes('Creature');
        });
      },
      label: () => 'Bogwater Lumaret — gain 1 life',
      resolve: gainOne,
    },
    {
      abilityId: 'etb-token',
      text: TEXT,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'TokenCreated' &&
        ev.controller === ctx.query.controllerOf(self) &&
        ctx.derive(ev.card).typeLine.types.includes('Creature'),
      label: () => 'Bogwater Lumaret — gain 1 life',
      resolve: gainOne,
    },
  ],
};
