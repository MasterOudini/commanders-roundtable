// `Team Transmitter` — "Whenever a Hero you control enters, you gain 1 life."
// The controlled-entry PAIR filtered on the HERO subtype (Genghis Frog's
// shape, D176, on an artifact), and the second printed line is the engine's
// own any-colour mana ability. D257.

import { TEAM_TRANSMITTER } from '../../../data/fixtures/engineCards';
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
  TEAM_TRANSMITTER,
  'Whenever a Hero you control enters, you gain 1 life.\n{T}: Add one mana of any color.',
);
const TEXT = PRINTED.split('\n')[0] as string;

/** "a Hero you control" — asked of the DERIVED entrant. */
function qualifies(ctx: ScriptCtx, self: InstanceId, entrant: InstanceId): boolean {
  const inst = ctx.state.cards[entrant];
  if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
  return ctx.derive(entrant).typeLine.subtypes.includes('Hero');
}

function gain(ctx: ScriptCtx, obj: { controller: string }): readonly EventBody[] {
  const player = ctx.state.players[obj.controller];
  if (!player || player.hasLost) return [];
  return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
}

export const TEAM_TRANSMITTER_SCRIPT: CardScript = {
  oracleId: TEAM_TRANSMITTER.oracleId,
  name: TEAM_TRANSMITTER.name,
  triggers: [
    {
      abilityId: 'hero-etb-card',
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
      label: () => 'Team Transmitter — you gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => gain(ctx, obj),
    },
    {
      abilityId: 'hero-etb-token',
      text: TEXT,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'TokenCreated' && qualifies(ctx, self, ev.card),
      label: () => 'Team Transmitter — you gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => gain(ctx, obj),
    },
  ],
};
