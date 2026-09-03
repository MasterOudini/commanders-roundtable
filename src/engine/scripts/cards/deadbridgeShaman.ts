// `Deadbridge Shaman` — when it dies, the target opponent chooses a card of
// their hand to discard (a looks-back trigger, the target asked as it goes
// on the stack).

import { DEADBRIDGE_SHAMAN } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(DEADBRIDGE_SHAMAN, 'When this creature dies, target opponent discards a card.');

export const DEADBRIDGE_SHAMAN_SCRIPT: CardScript = {
  oracleId: DEADBRIDGE_SHAMAN.oracleId,
  name: DEADBRIDGE_SHAMAN.name,
  triggers: [
    {
      abilityId: 'dies-discard',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      targets: parseTargetClauses(TEXT),
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => 'Deadbridge Shaman — target opponent discards a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'player') return [];
        const victim = ctx.state.players[target.id];
        if (!victim || victim.hasLost) return [];
        const hand = ctx.state.zones.hand[target.id] ?? [];
        if (hand.length === 0) return [];
        return [
          {
            t: 'AwaitingSet',
            awaiting: { kind: 'chooseFromZone', player: target.id, zone: 'hand', rest: null, count: 1, label: obj.label },
          },
        ];
      },
    },
  ],
};
