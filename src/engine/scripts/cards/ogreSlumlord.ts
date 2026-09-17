// `Ogre Slumlord` - a anotherCreatureDies trigger token, a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { OGRE_SLUMLORD } from '../../../data/fixtures/engineCards';
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

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" - re-check before re-registering (D90).`);
  return ref;
}

const PRINTED = printed(OGRE_SLUMLORD, "Whenever another nontoken creature dies, you may create a 1/1 black Rat creature token.\nRats you control have deathtouch.");
const LINES = PRINTED.split('\n');
const TOKEN_L0 = tokenRef("Rat|1/1|B|Creature|");

export const OGRE_SLUMLORD_SCRIPT: CardScript = {
  oracleId: OGRE_SLUMLORD.oracleId,
  name: OGRE_SLUMLORD.name,
  triggers: [
    {
      abilityId: 'anotherCreatureDies-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card !== self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.derive(m.card).typeLine.types.includes('Creature') && !ctx.state.cards[m.card]?.isToken,
        ),
      label: () => "Ogre Slumlord - token",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_L0.oracleId,
          printingId: TOKEN_L0.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
  statics: [
    {
      abilityId: 'anthem-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Rat") && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("deathtouch");
      },
    },
  ],
};
