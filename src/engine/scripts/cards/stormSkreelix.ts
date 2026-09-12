// `Storm Skreelix` - a castInstantSorcery trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STORM_SKREELIX } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STORM_SKREELIX, "Flying\nInstant and sorcery spells you cast cost {1} less to cast.\nWhenever you cast an instant or sorcery spell, this creature gets +2/+0 until end of turn.");
const LINES = PRINTED.split('\n');

export const STORM_SKREELIX_SCRIPT: CardScript = {
  oracleId: STORM_SKREELIX.oracleId,
  name: STORM_SKREELIX.name,
  triggers: [
    {
      abilityId: 'castInstantSorcery-2',
      text: LINES[2] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.some((t) => t === 'Instant' || t === 'Sorcery'),
      label: () => "Storm Skreelix - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: 0 }];
      },
    },
  ],
};
