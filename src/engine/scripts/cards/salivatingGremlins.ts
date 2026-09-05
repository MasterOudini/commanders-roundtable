// `Salivating Gremlins` - a artifactEnters trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SALIVATING_GREMLINS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SALIVATING_GREMLINS, "Whenever an artifact you control enters, this creature gets +2/+0 and gains trample until end of turn.");

export const SALIVATING_GREMLINS_SCRIPT: CardScript = {
  oracleId: SALIVATING_GREMLINS.oracleId,
  name: SALIVATING_GREMLINS.name,
  triggers: [
    {
      abilityId: 'artifactEnters-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Artifact'),
        ),
      label: () => "Salivating Gremlins - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: 0, keywords: ["trample"] }];
      },
    },
  ],
};
