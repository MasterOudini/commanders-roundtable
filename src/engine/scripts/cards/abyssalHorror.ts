// `Abyssal Horror` — Flying is the engine's; the entry has the target player
// choose two cards of their hand to discard (`chooseFromZone`, the ask
// raised from a trigger resolve — D160's wall, fallen since D221).

import { ABYSSAL_HORROR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ABYSSAL_HORROR, 'Flying\nWhen this creature enters, target player discards two cards.');
const ENTERS = PRINTED.split('\n')[1] as string;

export const ABYSSAL_HORROR_SCRIPT: CardScript = {
  oracleId: ABYSSAL_HORROR.oracleId,
  name: ABYSSAL_HORROR.name,
  triggers: [
    {
      abilityId: 'enters-discard',
      text: ENTERS,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(ENTERS),
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Abyssal Horror — target player discards two cards',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'player') return [];
        const victim = ctx.state.players[target.id];
        if (!victim || victim.hasLost) return [];
        const hand = ctx.state.zones.hand[target.id] ?? [];
        const count = Math.min(2, hand.length);
        if (count === 0) return [];
        return [
          {
            t: 'AwaitingSet',
            awaiting: { kind: 'chooseFromZone', player: target.id, zone: 'hand', rest: null, count, label: obj.label },
          },
        ];
      },
    },
  ],
};
