// `Charforger` - a etb trigger token, a cardPutIntoGraveyard trigger selfCounter, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CHARFORGER } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(CHARFORGER, "When this creature enters, create a 1/1 red Phyrexian Goblin creature token.\nWhenever another creature or artifact you control is put into a graveyard from the battlefield, put an oil counter on this creature.\nRemove three oil counters from this creature: Exile the top card of your library. You may play that card this turn.");
const LINES = PRINTED.split('\n');
const TOKEN_L0 = tokenRef("Phyrexian Goblin|1/1|R|Creature|");

const VOCAB_A0 = vocabularyEffects("Exile the top card of your library. You may play that card this turn.", CHARFORGER.name);
const VOCAB_T_A0 = vocabularyTargets("Exile the top card of your library. You may play that card this turn.");

export const CHARFORGER_SCRIPT: CardScript = {
  oracleId: CHARFORGER.oracleId,
  name: CHARFORGER.name,
  activated: [
    {
      ref: `${CHARFORGER.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
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
      label: () => "Charforger - token",
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
      label: () => "Charforger - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "oil", delta: 1 }] }];
      },
    },
  ],
};
