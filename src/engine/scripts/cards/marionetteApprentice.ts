// `Marionette Apprentice` - a cardPutIntoGraveyard trigger loseLifeOpponents
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MARIONETTE_APPRENTICE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MARIONETTE_APPRENTICE, "Fabricate 1 (When this creature enters, put a +1/+1 counter on it or create a 1/1 colorless Servo artifact creature token.)\nWhenever another creature or artifact you control is put into a graveyard from the battlefield, each opponent loses 1 life.");
const LINES = PRINTED.split('\n');

export const MARIONETTE_APPRENTICE_SCRIPT: CardScript = {
  oracleId: MARIONETTE_APPRENTICE.oracleId,
  name: MARIONETTE_APPRENTICE.name,
  triggers: [
    {
      abilityId: 'cardPutIntoGraveyard-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'graveyard' && m.from.kind === 'battlefield' && m.card !== self && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && (ctx.derive(m.card).typeLine.types.includes('Creature') || ctx.derive(m.card).typeLine.types.includes('Artifact')),
        ),
      label: () => "Marionette Apprentice - loseLifeOpponents",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const [pid, p] of Object.entries(ctx.state.players)) {
          if (pid === obj.controller) continue;
          out.push({ t: 'LifeChanged', player: pid, delta: -1, to: p.life - 1 });
        }
        return out;
      },
    },
  ],
};
