// `Steelfin Whale` - a artifactEnters trigger untapSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STEELFIN_WHALE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STEELFIN_WHALE, "Affinity for artifacts (This spell costs {1} less to cast for each artifact you control.)\nWhenever an artifact you control enters, untap this creature.");
const LINES = PRINTED.split('\n');

export const STEELFIN_WHALE_SCRIPT: CardScript = {
  oracleId: STEELFIN_WHALE.oracleId,
  name: STEELFIN_WHALE.name,
  triggers: [
    {
      abilityId: 'artifactEnters-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Artifact'),
        ),
      label: () => "Steelfin Whale - untapSelf",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield' || !me.tapped) return [];
        return [{ t: 'PermanentsUntapped', cards: [self] }];
      },
    },
  ],
};
