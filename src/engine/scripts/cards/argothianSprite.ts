// `Argothian Sprite` - a static cantBeBlockedBy, an activation selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ARGOTHIAN_SPRITE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ARGOTHIAN_SPRITE, "This creature can't be blocked by artifact creatures.\n{7}: Put two +1/+1 counters on this creature.");
const LINES = PRINTED.split('\n');

export const ARGOTHIAN_SPRITE_SCRIPT: CardScript = {
  oracleId: ARGOTHIAN_SPRITE.oracleId,
  name: ARGOTHIAN_SPRITE.name,
  activated: [
    {
      ref: `${ARGOTHIAN_SPRITE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 2 }] }];
      },
    },
  ],
  combat: [
    {
      abilityId: 'cantBeBlockedBy-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      canBlock: (ctx, self, blocker, attacker) => attacker !== self || !(ctx.derive(blocker).typeLine.types.includes('Artifact') && ctx.derive(blocker).typeLine.types.includes('Creature')),
    },
  ],
};
