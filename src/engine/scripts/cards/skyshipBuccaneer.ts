// `Skyship Buccaneer` - a raidEtb trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SKYSHIP_BUCCANEER } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(SKYSHIP_BUCCANEER, "Flying\nRaid — When this creature enters, if you attacked this turn, draw a card.");
const LINES = PRINTED.split('\n');

export const SKYSHIP_BUCCANEER_SCRIPT: CardScript = {
  oracleId: SKYSHIP_BUCCANEER.oracleId,
  name: SKYSHIP_BUCCANEER.name,
  triggers: [
    {
      abilityId: 'raidEtb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' && ctx.state.turn.attacked && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Skyship Buccaneer - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
