// `Tegwyll, Duke of Splendor` - a static anthem, a anotherCreatureDies trigger drawLose
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TEGWYLL_DUKE_OF_SPLENDOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TEGWYLL_DUKE_OF_SPLENDOR, "Flying, deathtouch\nOther Faeries you control get +1/+1.\nWhenever another Faerie you control dies, you draw a card and you lose 1 life.");
const LINES = PRINTED.split('\n');

export const TEGWYLL_DUKE_OF_SPLENDOR_SCRIPT: CardScript = {
  oracleId: TEGWYLL_DUKE_OF_SPLENDOR.oracleId,
  name: TEGWYLL_DUKE_OF_SPLENDOR.name,
  triggers: [
    {
      abilityId: 'anotherCreatureDies-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card !== self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.subtypes.includes('Faerie'),
        ),
      label: () => "Tegwyll, Duke of Splendor - drawLose",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [...drawEvents(ctx.state, obj.controller, 1), { t: 'LifeChanged', player: obj.controller, delta: -1, to: me.life - 1 }];
      },
    },
  ],
  statics: [
    {
      abilityId: 'anthem-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Faerie") && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
  ],
};
