// `Sethron, Hurloon General` - a etb trigger token, a anotherCreatureEnters trigger token, an activation pumping its controller's creatures
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SETHRON_HURLOON_GENERAL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SETHRON_HURLOON_GENERAL, "Whenever Sethron or another nontoken Minotaur you control enters, create a 2/3 red Minotaur creature token.\n{2}{B/R}: Minotaurs you control get +1/+0 and gain menace and haste until end of turn. ({B/R} can be paid with either {B} or {R}.)");
const LINES = PRINTED.split('\n');
const TOKEN_L0 = tokenRef("Minotaur|2/3|R|Creature|");

export const SETHRON_HURLOON_GENERAL_SCRIPT: CardScript = {
  oracleId: SETHRON_HURLOON_GENERAL.oracleId,
  name: SETHRON_HURLOON_GENERAL.name,
  activated: [
    {
      ref: `${SETHRON_HURLOON_GENERAL.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const inst of Object.values(ctx.state.cards)) {
          if (inst.zone.kind !== 'battlefield' || inst.controller !== obj.controller) continue;
          if (!ctx.derive(inst.id).typeLine.types.includes('Creature')) continue;
          if (!ctx.derive(inst.id).typeLine.subtypes.includes("Minotaur")) continue;
          out.push({ t: 'PtModifiedUntilEndOfTurn', card: inst.id, power: 1, toughness: 0, keywords: ["menace", "haste"] });
        }
        return out;
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Sethron, Hurloon General - token",
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
    {
      abilityId: 'anotherCreatureEnters-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card !== self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.subtypes.includes('Minotaur') && !ctx.state.cards[m.card]?.isToken,
        ),
      label: () => "Sethron, Hurloon General - token",
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
};
