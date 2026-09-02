// `Aragorn, the Uniter` — four cast watchers keyed on the colour of the spell
// I cast: white makes a Human Soldier, blue scries 2, red aims 3 damage at
// an opponent, green aims +4/+4 at a creature. A multicolour spell fires
// every line it matches.

import { ARAGORN_THE_UNITER } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import { parseTargetClauses } from '../../../data/targetParse';
import { faceOf } from '../../oracle';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

/** The colour letters a cast face carries, derived from the face itself. */
type ColorLetter = ReturnType<typeof faceOf>['colors'][number];

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

const PRINTED = printed(
  ARAGORN_THE_UNITER,
  'Whenever you cast a white spell, create a 1/1 white Human Soldier creature token.\nWhenever you cast a blue spell, scry 2.\nWhenever you cast a red spell, Aragorn deals 3 damage to target opponent.\nWhenever you cast a green spell, target creature gets +4/+4 until end of turn.',
);
const WHITE = PRINTED.split('\n')[0] as string;
const BLUE = PRINTED.split('\n')[1] as string;
const RED = PRINTED.split('\n')[2] as string;
const GREEN = PRINTED.split('\n')[3] as string;

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}
const HUMAN_SOLDIER = tokenRef('Human Soldier|1/1|W|Creature|');

function token(ctx: ScriptCtx, controller: string, ref: TokenRef): EventBody {
  return {
    t: 'TokenCreated',
    card: ctx.ids.nextInstance(),
    oracleId: ref.oracleId,
    printingId: ref.printingId,
    controller,
    owner: controller,
    turnNumber: ctx.state.turn.turnNumber,
  };
}

/** True when I cast a spell whose cast face carries `color`. */
function castOfColor(color: ColorLetter): (ctx: ScriptCtx, self: InstanceId, ev: EventBody) => boolean {
  return (ctx, self, ev) => {
    if (ev.t !== 'SpellCast') return false;
    if (ev.obj.controller !== ctx.query.controllerOf(self)) return false;
    if (!ev.obj.card) return false;
    const inst = ctx.state.cards[ev.obj.card];
    const oc = inst ? ctx.oracle.byPrinting(inst.printingId) : undefined;
    if (!oc) return false;
    return faceOf(oc, ev.obj.faceIndex).colors.includes(color);
  };
}

export const ARAGORN_THE_UNITER_SCRIPT: CardScript = {
  oracleId: ARAGORN_THE_UNITER.oracleId,
  name: ARAGORN_THE_UNITER.name,
  triggers: [
    {
      abilityId: 'white-soldier',
      text: WHITE,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: castOfColor('W'),
      label: () => 'Aragorn, the Uniter — create a 1/1 Human Soldier',
      resolve: (ctx, _self, obj): readonly EventBody[] => [token(ctx, obj.controller, HUMAN_SOLDIER)],
    },
    {
      abilityId: 'blue-scry',
      text: BLUE,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: castOfColor('U'),
      label: () => 'Aragorn, the Uniter — scry 2',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // The reveal is what makes the prompt answerable (D195): the top is
        // the END of the library array, and the answer handler validates
        // against what is revealed to the player.
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const count = Math.min(2, library.length);
        if (count === 0) return [];
        const top = library.slice(library.length - count);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          {
            t: 'AwaitingSet',
            awaiting: {
              kind: 'scryChoice',
              player: obj.controller,
              count,
              toGraveyard: false,
              thenDraw: 0,
              label: 'Aragorn, the Uniter — scry 2',
            },
          },
        ];
      },
    },
    {
      abilityId: 'red-damage',
      text: RED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(RED),
      matches: castOfColor('R'),
      label: () => 'Aragorn, the Uniter — 3 damage to an opponent',
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'player') return [];
        const them = ctx.state.players[target.id];
        if (!them || them.hasLost) return [];
        return [
          {
            t: 'DamageDealt',
            damages: [
              {
                source: self,
                target: { kind: 'player', id: target.id },
                amount: 3,
                deathtouch: false,
                lifelinkTo: null,
                isCommanderDamage: false,
                viaTrample: 0,
                toxic: 0,
                applyAs: 'normal',
              },
            ],
          },
        ];
      },
    },
    {
      abilityId: 'green-pump',
      text: GREEN,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(GREEN),
      matches: castOfColor('G'),
      label: () => 'Aragorn, the Uniter — +4/+4 to a creature',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 4, toughness: 4, keywords: [] }];
      },
    },
  ],
};
