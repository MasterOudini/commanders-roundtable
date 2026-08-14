// `Healer of the Pride` — "Whenever another creature you control enters, you
// gain 2 life." Soul Warden's two-def token rule (a token enters via
// `TokenCreated`, never `CardsMoved`) narrowed to the CONTROLLER, with the
// self-exclusion the word "another" prints. M6.4w, D179.

import { HEALER_OF_THE_PRIDE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  HEALER_OF_THE_PRIDE,
  'Whenever another creature you control enters, you gain 2 life.',
);

/** "another creature you control" — asked of the DERIVED entrant. */
function qualifies(ctx: ScriptCtx, self: InstanceId, entrant: InstanceId): boolean {
  if (entrant === self) return false;
  const inst = ctx.state.cards[entrant];
  if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
  return ctx.derive(entrant).typeLine.types.includes('Creature');
}

export const HEALER_OF_THE_PRIDE_SCRIPT: CardScript = {
  oracleId: HEALER_OF_THE_PRIDE.oracleId,
  name: HEALER_OF_THE_PRIDE.name,
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
      label: () => 'Healer of the Pride — gain 2 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: player.life + 2 }];
      },
    },
    {
      abilityId: 'etb-token',
      text: TEXT,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'TokenCreated' && qualifies(ctx, self, ev.card),
      label: () => 'Healer of the Pride — gain 2 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: player.life + 2 }];
      },
    },
  ],
};
