// `Seedpod Squire` — Flying is the engine's. Whenever it attacks, a creature
// I control WITHOUT flying gets +1/+1 until end of turn (Burrenton
// Shield-Bearers' self-attack trigger with D289's restriction).

import { SEEDPOD_SQUIRE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  SEEDPOD_SQUIRE,
  'Flying\nWhenever this creature attacks, target creature you control without flying gets +1/+1 until end of turn.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const SEEDPOD_SQUIRE_SCRIPT: CardScript = {
  oracleId: SEEDPOD_SQUIRE.oracleId,
  name: SEEDPOD_SQUIRE.name,
  triggers: [
    {
      abilityId: 'attacks',
      text: TEXT,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => 'Seedpod Squire — target creature you control without flying gets +1/+1 until end of turn',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 1, toughness: 1 }];
      },
    },
  ],
};
