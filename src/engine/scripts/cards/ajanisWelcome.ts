// `Ajani's Welcome` — "Whenever a creature you control enters, you gain 1
// life." Soul Warden scoped to YOUR creatures: two defs (tokens are not
// moves), the controller check on the ENTERING creature rather than on
// "another". M6.4c, D160.

import { AJANI_S_WELCOME } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(AJANI_S_WELCOME, 'Whenever a creature you control enters, you gain 1 life.');

function gainOne(ctx: ScriptCtx, _self: InstanceId, obj: StackObject): readonly EventBody[] {
  const player = ctx.state.players[obj.controller];
  if (!player) return [];
  return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
}

export const AJANIS_WELCOME_SCRIPT: CardScript = {
  oracleId: AJANI_S_WELCOME.oracleId,
  name: AJANI_S_WELCOME.name,
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
            ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) &&
            ctx.derive(m.card).typeLine.types.includes('Creature'),
        ),
      label: () => "Ajani's Welcome — gain 1 life",
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
      label: () => "Ajani's Welcome — gain 1 life",
      resolve: gainOne,
    },
  ],
};
