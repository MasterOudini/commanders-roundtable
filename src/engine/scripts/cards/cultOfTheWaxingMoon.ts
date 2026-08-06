// `Cult of the Waxing Moon` — "Whenever a permanent you control transforms
// into a non-Human creature, create a 2/2 green Wolf creature token." The
// FIRST transform-watcher (D170): the bus dispatches on `FaceIndexSet` — the
// event D108's Tier-3 Transform button and every future transform emits —
// and the filter asks the DERIVED post-flip characteristics, so a card that
// becomes a non-Human creature through the layers counts exactly as the
// printed face would. Flipping BACK is a transform too (CR 701.28) and
// triggers when the front face qualifies — the rule, not an accident.

import { CULT_OF_THE_WAXING_MOON } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
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

const TEXT = printed(
  CULT_OF_THE_WAXING_MOON,
  'Whenever a permanent you control transforms into a non-Human creature, create a 2/2 green Wolf creature token.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const WOLF = tokenRef('Wolf|2/2|G|Creature|');

export const CULT_OF_THE_WAXING_MOON_SCRIPT: CardScript = {
  oracleId: CULT_OF_THE_WAXING_MOON.oracleId,
  name: CULT_OF_THE_WAXING_MOON.name,
  triggers: [
    {
      abilityId: 'transform',
      text: TEXT,
      event: 'FaceIndexSet',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'FaceIndexSet') return false;
        const inst = ctx.state.cards[ev.card];
        if (!inst || inst.zone.kind !== 'battlefield') return false;
        if (inst.controller !== ctx.query.controllerOf(self)) return false;
        // The DERIVED post-flip object: `matches` runs on the state after the
        // flip applied, so this is what the permanent transformed INTO.
        const d = ctx.derive(ev.card);
        return d.typeLine.types.includes('Creature') && !d.typeLine.subtypes.includes('Human');
      },
      label: () => 'Cult of the Waxing Moon — create a 2/2 Wolf',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: WOLF.oracleId,
          printingId: WOLF.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
