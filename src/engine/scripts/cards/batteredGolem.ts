// `Battered Golem` - a static noUntap, a creatureEnters trigger untapSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BATTERED_GOLEM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BATTERED_GOLEM, "This creature doesn't untap during your untap step.\nWhenever an artifact enters, you may untap this creature.");
const LINES = PRINTED.split('\n');

export const BATTERED_GOLEM_SCRIPT: CardScript = {
  oracleId: BATTERED_GOLEM.oracleId,
  name: BATTERED_GOLEM.name,
  triggers: [
    {
      abilityId: 'creatureEnters-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, _self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.derive(m.card).typeLine.types.includes('Artifact'),
        ),
      label: () => "Battered Golem - untapSelf",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield' || !me.tapped) return [];
        return [{ t: 'PermanentsUntapped', cards: [self] }];
      },
    },
  ],
  replacements: [
    {
      abilityId: 'no-untap-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      // CR 614.1 - the untap step's untap is replaced for this one permanent (D371).
      applies: (ctx, self, ev) =>
        ev.t === 'PermanentsUntapped' && ctx.state.turn.step === 'untap' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self) && ev.cards.includes(self),
      replace: (_ctx, self, ev): readonly EventBody[] => {
        if (ev.t !== 'PermanentsUntapped') return [ev];
        const cards = ev.cards.filter((c) => c !== self);
        return cards.length ? [{ t: 'PermanentsUntapped', cards }] : [];
      },
    },
  ],
};
