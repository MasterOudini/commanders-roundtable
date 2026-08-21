// `Ravenous Rats` — "When this creature enters, target opponent discards
// a card." The targeted entry raising D137's ask at the TARGET — a hand
// of one goes choicelessly (CR 701.8a). D237.

import { RAVENOUS_RATS } from '../../../data/fixtures/engineCards';
import { parseTargetClauses } from '../../../data/targetParse';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

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

const TEXT = printed(RAVENOUS_RATS, 'When this creature enters, target opponent discards a card.');

export const RAVENOUS_RATS_SCRIPT: CardScript = {
  oracleId: RAVENOUS_RATS.oracleId,
  name: RAVENOUS_RATS.name,
  triggers: [
    {
      abilityId: 'etb-discard',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Ravenous Rats — target opponent discards a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'player') return [];
        const player = ctx.state.players[target.id];
        if (!player || player.hasLost) return [];
        const hand = ctx.state.zones.hand[target.id] ?? [];
        if (hand.length === 0) return [];
        if (hand.length <= 1) {
          const only = hand[0] as string;
          return [
            {
              t: 'CardsMoved',
              moves: [
                {
                  card: only,
                  from: { kind: 'hand', player: target.id },
                  to: { kind: 'graveyard', player: ctx.state.cards[only]?.owner ?? target.id },
                },
              ],
            },
          ];
        }
        return [
          {
            t: 'AwaitingSet',
            awaiting: {
              kind: 'chooseFromZone',
              player: target.id,
              zone: 'hand',
              rest: null,
              count: 1,
              label: obj.label,
            },
          },
        ];
      },
    },
  ],
};
