// `Corrupt Court Official` — the entry has the target opponent choose a card
// of their hand to discard.

import { CORRUPT_COURT_OFFICIAL } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(CORRUPT_COURT_OFFICIAL, 'When this creature enters, target opponent discards a card.');

export const CORRUPT_COURT_OFFICIAL_SCRIPT: CardScript = {
  oracleId: CORRUPT_COURT_OFFICIAL.oracleId,
  name: CORRUPT_COURT_OFFICIAL.name,
  triggers: [
    {
      abilityId: 'enters-discard',
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
      label: () => 'Corrupt Court Official — target opponent discards a card',
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
