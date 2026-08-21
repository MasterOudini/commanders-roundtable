// `Rottenheart Ghoul` — "When this creature dies, target player discards
// a card." Ravenous Rats' targeted discard ask from the DIES side, CR
// 701.8a's choiceless branch included. D241.

import { ROTTENHEART_GHOUL } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(ROTTENHEART_GHOUL, 'When this creature dies, target player discards a card.');

export const ROTTENHEART_GHOUL_SCRIPT: CardScript = {
  oracleId: ROTTENHEART_GHOUL.oracleId,
  name: ROTTENHEART_GHOUL.name,
  triggers: [
    {
      abilityId: 'dies-discard',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      looksBack: true,
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard',
        ),
      label: () => 'Rottenheart Ghoul — target player discards a card',
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
