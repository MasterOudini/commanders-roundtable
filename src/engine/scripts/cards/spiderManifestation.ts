// `Spider Manifestation` - a castSpell trigger untapSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPIDER_MANIFESTATION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPIDER_MANIFESTATION, "Reach\n{T}: Add {R} or {G}.\nWhenever you cast a spell with mana value 4 or greater, untap this creature.");
const LINES = PRINTED.split('\n');

export const SPIDER_MANIFESTATION_SCRIPT: CardScript = {
  oracleId: SPIDER_MANIFESTATION.oracleId,
  name: SPIDER_MANIFESTATION.name,
  triggers: [
    {
      abilityId: 'castSpell-2',
      text: LINES[2] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller === ctx.query.controllerOf(self) &&
        (ctx.derive(ev.obj.card).manaValue ?? 0) >= 4,
      label: () => "Spider Manifestation - untapSelf",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield' || !me.tapped) return [];
        return [{ t: 'PermanentsUntapped', cards: [self] }];
      },
    },
  ],
};
