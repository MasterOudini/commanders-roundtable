import { describe, expect, test } from 'vitest';
import { Projector, project } from './project';
import {
  ORACLE,
  advanceUntil,
  battlefieldOf,
  findAnywhere,
  holdEverywhere,
  idsIn,
  must,
  put,
  startedGame,
} from './testing/harness';
import { zoneId } from '../view/types';
import type { PlayerView } from '../view/types';

function viewFor(game: ReturnType<typeof startedGame>, player: string): PlayerView {
  return project(game.state, ORACLE, game.deps.scripts, player);
}

/** Every oracle id the projection could possibly leak, as one searchable blob. */
function serialised(view: PlayerView): string {
  return JSON.stringify(view);
}

describe('projection — the hidden-information boundary', () => {
  test('your own hand is fully visible', () => {
    const game = startedGame();
    const view = viewFor(game, 'p1');
    const hand = view.zones[zoneId('hand', 'p1')] ?? [];
    expect(hand.length).toBeGreaterThan(0);
    for (const id of hand) {
      expect(view.cards[id]?.card, `card ${id}`).not.toBeNull();
      expect(view.cards[id]?.faceDown).toBe(false);
    }
  });

  /**
   * ⚠️ An opponent's hand keeps its real ids and its true LENGTH with NO card
   * data. That is what lets the table animate *that specific card back* moving
   * hand → battlefield, and hiddenness is the absence of data rather than a flag
   * a component has to remember to honour.
   */
  test("every entry in an opponent's hand projects to card: null", () => {
    const game = startedGame();
    const view = viewFor(game, 'p1');
    const hand = view.zones[zoneId('hand', 'p2')] ?? [];
    expect(hand.length).toBe(idsIn(game, 'p2', 'hand').length);
    for (const id of hand) {
      expect(view.cards[id]?.card, `card ${id}`).toBeNull();
      expect(view.cards[id]?.faceDown).toBe(true);
    }
    expect(view.hiddenCounts[zoneId('hand', 'p2')]).toBe(hand.length);
  });

  /**
   * ⚠️ INCLUDING YOUR OWN. The host process holds the shuffled order in memory
   * and `project()` strips it, so the game UI — which reads only the view —
   * cannot show it even by accident. That is what makes accidental cheating
   * structurally impossible rather than a matter of discipline.
   */
  test('a library is a COUNT, for every player including the viewer', () => {
    const game = startedGame();
    const view = viewFor(game, 'p1');
    for (const p of ['p1', 'p2', 'p3', 'p4']) {
      expect(view.zones[zoneId('lib', p)]).toBeUndefined();
      expect(view.hiddenCounts[zoneId('lib', p)]).toBe(idsIn(game, p, 'library').length);
    }
  });

  /**
   * ⚠️ Checked STRUCTURALLY, not by grepping the serialised view. A string
   * search reports a false leak the moment an instance id collides with real
   * card data — `c17` is both an instance id and Scryfall's set code for
   * Commander 2017, so the grep version of this test failed on a view that was
   * perfectly clean.
   */
  test('no library card appears in the card map or any zone array', () => {
    const game = startedGame();
    const view = viewFor(game, 'p1');
    const libraryIds = new Set(['p1', 'p2', 'p3', 'p4'].flatMap((p) => idsIn(game, p, 'library')));
    expect(libraryIds.size).toBeGreaterThan(50);
    for (const id of Object.keys(view.cards)) {
      expect(libraryIds.has(id), `library card ${id} is in view.cards`).toBe(false);
    }
    for (const [zone, ids] of Object.entries(view.zones)) {
      for (const id of ids ?? []) {
        expect(libraryIds.has(id), `library card ${id} is in ${zone}`).toBe(false);
      }
    }
  });

  test("a card unique to another player's hand never reaches the view", () => {
    // A card NOBODY else has a copy of, so a printing-id search is meaningful:
    // with basics the same printing id legitimately appears on both sides.
    const game = startedGame({ decks: [[], ['Baleful Strix'], [], []] });
    const strix = findAnywhere(game, 'p2', 'Baleful Strix');
    must(game.submit({ t: 'ManualMoveCard', player: 'p2', card: strix, to: { kind: 'hand', player: 'p2' } }));
    const view = viewFor(game, 'p1');
    // The INSTANCE id is present — the hand fan animates that specific card
    // back — but nothing about what it is.
    expect(view.cards[strix]).toBeDefined();
    expect(view.cards[strix]?.card).toBeNull();
    const printing = game.state.cards[strix]?.printingId ?? '@@';
    expect(serialised(view).includes(printing)).toBe(false);
  });

  test('public zones are fully visible to everyone', () => {
    const game = startedGame({ decks: [['Sol Ring'], [], [], []] });
    const ring = put(game, 'p1', 'Sol Ring');
    for (const viewer of ['p1', 'p2', 'p3', 'p4']) {
      const view = viewFor(game, viewer);
      expect(view.cards[ring]?.card?.name).toBe('Sol Ring');
    }
  });

  /**
   * ⚠️ CR 708.2. A face-down permanent is a PUBLIC OBJECT whose identity is
   * hidden: everyone sees a 2/2 with its counters, damage and tapped state; only
   * its controller sees what it is.
   */
  test('a face-down permanent shows as a 2/2 to opponents and as itself to its controller', () => {
    const game = startedGame({ decks: [['Serra Angel'], [], [], []] });
    const angel = put(game, 'p1', 'Serra Angel');
    must(game.submit({ t: 'ManualSetFaceDown', player: 'p1', card: angel, faceDown: true }));

    const mine = viewFor(game, 'p1');
    expect(mine.cards[angel]?.card?.name).toBe('Serra Angel');

    const theirs = viewFor(game, 'p2');
    expect(theirs.cards[angel]?.card).toBeNull();
    expect(theirs.cards[angel]?.faceDown).toBe(true);
    expect(theirs.cards[angel]?.power).toBe(2);
    expect(theirs.cards[angel]?.toughness).toBe(2);
    expect(serialised(theirs).includes(game.state.cards[angel]?.printingId ?? '@@')).toBe(false);
  });

  test('a card revealed to you is visible; to everyone else it is not', () => {
    const game = startedGame();
    must(game.submit({ t: 'ManualPeekLibrary', player: 'p1', count: 2 }));
    const library = idsIn(game, 'p1', 'library');
    const top = library.slice(library.length - 2);
    const mine = viewFor(game, 'p1');
    for (const id of top) expect(mine.cards[id]?.card).not.toBeNull();
    const theirs = viewFor(game, 'p2');
    for (const id of top) expect(theirs.cards[id]).toBeUndefined();
  });

  test('seat order starts at the viewer and goes clockwise', () => {
    const game = startedGame();
    expect(viewFor(game, 'p1').seatOrder).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(viewFor(game, 'p3').seatOrder).toEqual(['p3', 'p4', 'p1', 'p2']);
  });

  test('seats carry life, pool, identity and the lost flag', () => {
    const game = startedGame();
    must(game.submit({ t: 'ManualSetLife', player: 'p1', target: 'p2', delta: -8 }));
    must(game.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
    must(game.submit({ t: 'Concede', player: 'p3' }));
    const view = viewFor(game, 'p1');
    expect(view.seats['p2']?.life).toBe(32);
    expect(view.seats['p1']?.manaPool.R).toBe(2);
    expect(view.seats['p3']?.lost).toBe(true);
    expect(view.seats['p1']?.identity.sort()).toEqual(['B', 'R', 'U']);
  });

  test('the stack projects with a label, controller and identity', () => {
    const game = startedGame({ players: 2, decks: [['Mountain', 'Lightning Bolt'], []] });
    // ⚠️ There has to BE a stack to project. Auto-pass resolves a spell nobody
    // can answer inside the casting submit, so the engine is held still here.
    holdEverywhere(game);
    put(game, 'p1', 'Mountain');
    const bolt = findAnywhere(game, 'p1', 'Lightning Bolt');
    must(game.submit({ t: 'ManualMoveCard', player: 'p1', card: bolt, to: { kind: 'hand', player: 'p1' } }));
    must(game.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'player', id: 'p2' }] }));
    const view = viewFor(game, 'p2');
    expect(view.stack).toHaveLength(1);
    expect(view.stack[0]?.label).toBe('Lightning Bolt');
    expect(view.stack[0]?.controller).toBe('p1');
    expect(view.stack[0]?.identity).toEqual(['R']);
    // The card on the stack is public: everyone sees what it is.
    expect(view.cards[bolt]?.card?.name).toBe('Lightning Bolt');
  });

  test('turn, priority and the log come through', () => {
    const game = startedGame();
    const view = viewFor(game, 'p1');
    expect(view.turn).toEqual({ active: 'p1', phase: 'main1', turnNumber: 1 });
    expect(view.priority).toBe('p1');
    expect(view.log.length).toBeGreaterThan(0);
  });

  test('combat state reaches the view as attacking/blocking flags', () => {
    const game = startedGame({ players: 2, decks: [['Grizzly Bears'], ['Scathe Zombies']] });
    const bear = put(game, 'p1', 'Grizzly Bears');
    const zombie = put(game, 'p2', 'Scathe Zombies');
    // ⚠️ The attacking/blocking flags exist only WHILE combat does, and with
    // auto-pass on there is no window between blocks and damage for anyone who
    // cannot act — the whole of combat happens inside the DeclareBlockers submit.
    holdEverywhere(game);
    advanceUntil(game, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers');
    must(
      game.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [{ card: bear, defender: { kind: 'player', id: 'p2' } }],
      }),
    );
    advanceUntil(game, (s) => s.priority.awaiting?.kind === 'declareBlockers');
    must(game.submit({ t: 'DeclareBlockers', player: 'p2', blocks: [{ blocker: zombie, attacker: bear }] }));
    const view = viewFor(game, 'p1');
    expect(view.cards[bear]?.attacking).toBe('p2');
    expect(view.cards[zombie]?.blocking).toEqual([bear]);
    expect(view.cards[bear]?.blocking).toEqual([]);
  });

  /**
   * ⚠️ THE CASE THE OLD PROJECTION COULD NOT REPORT. `blocking` was one
   * `InstanceId` built from `attackerOrder[0]`, so a creature blocking two
   * attackers named the first and dropped the second — and `orderAttackers`, the
   * prompt that asks for exactly this list, was unanswerable by any client for
   * that reason alone. `GameState` has carried the whole order since M3. See D125.
   */
  test('a creature blocking two attackers reports both, in the engine order', () => {
    const game = startedGame({
      players: 2,
      decks: [['Grizzly Bears', 'Scathe Zombies'], ['Serra Angel']],
    });
    const bear = put(game, 'p1', 'Grizzly Bears');
    const zombie = put(game, 'p1', 'Scathe Zombies');
    const angel = put(game, 'p2', 'Serra Angel');
    holdEverywhere(game);
    advanceUntil(game, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers');
    must(
      game.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [
          { card: bear, defender: { kind: 'player', id: 'p2' } },
          { card: zombie, defender: { kind: 'player', id: 'p2' } },
        ],
      }),
    );
    advanceUntil(game, (s) => s.priority.awaiting?.kind === 'declareBlockers');
    must(
      game.submit({
        t: 'DeclareBlockers',
        player: 'p2',
        blocks: [
          { blocker: angel, attacker: bear },
          { blocker: angel, attacker: zombie },
        ],
      }),
    );

    // Both, and in the order the engine will assign damage down — the order is
    // load-bearing, so equality against the state's own list is the assertion.
    const order = game.state.combat?.blockers.find((b) => b.card === angel)?.attackerOrder;
    expect(order).toEqual([bear, zombie]);
    expect(viewFor(game, 'p1').cards[angel]?.blocking).toEqual([bear, zombie]);
    expect(viewFor(game, 'p2').cards[angel]?.blocking).toEqual([bear, zombie]);
  });

  test('summoning sickness is projected, and haste clears it', () => {
    const game = startedGame({ decks: [['Grizzly Bears', 'Raging Goblin']] });
    const bear = put(game, 'p1', 'Grizzly Bears');
    const goblin = put(game, 'p1', 'Raging Goblin');
    const view = viewFor(game, 'p1');
    expect(view.cards[bear]?.summoningSick).toBe(true);
    expect(view.cards[goblin]?.summoningSick).toBe(false);
  });

  test('commander damage is reported per opponent as the MAXIMUM commander', () => {
    const game = startedGame({
      players: 2,
      commanders: [['Thrasios, Triton Hero', 'Tymna the Weaver'], ['Krenko, Mob Boss']],
    });
    const [a, b] = game.state.zones.command['p1'] ?? [];
    for (const id of [a, b]) {
      must(
        game.submit({
          t: 'ManualMoveCard',
          player: 'p1',
          card: id as string,
          to: { kind: 'battlefield', player: 'p1' },
        }),
      );
      must(game.submit({ t: 'ManualSetPt', player: 'p1', card: id as string, power: 5, toughness: 5 }));
    }
    advanceUntil(game, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers');
    must(
      game.submit({
        t: 'DeclareAttackers',
        player: 'p1',
        attackers: [a, b].map((card) => ({ card: card as string, defender: { kind: 'player' as const, id: 'p2' } })),
      }),
    );
    advanceUntil(game, (s) => s.turn.step === 'postcombatMain');
    const view = viewFor(game, 'p2');
    // ⚠️ MAX, not SUM. Summing a partner pair would show 21 when neither half
    // has dealt lethal — and 21 from one commander is what ends the game.
    expect(view.seats['p2']?.cmdDamage['p1']).toBe(5);
  });
});

describe('projection preserves referential identity (D21)', () => {
  /**
   * ⚠️ NOT AN OPTIMISATION. Measured in M2: without object reuse, EVERY view
   * commit produced exactly one long frame, scaling with the board — 33 ms at 2
   * permanents per seat, 58 ms at 10, 83 ms at 20 — even for a pure phase change
   * that animates nothing. `React.memo` on `Card` can never match a fresh object.
   */
  test('an unchanged card is the SAME object across two projections', () => {
    const game = startedGame({ decks: [['Sol Ring', 'Grizzly Bears'], [], [], []] });
    const ring = put(game, 'p1', 'Sol Ring');
    const bear = put(game, 'p1', 'Grizzly Bears');
    const projector = new Projector(ORACLE, game.deps.scripts, 'p1');
    const first = projector.project(game.state);
    must(game.submit({ t: 'ManualSetTapped', player: 'p1', cards: [ring], tapped: true }));
    const second = projector.project(game.state);
    expect(second.cards[bear]).toBe(first.cards[bear]);
    expect(second.cards[ring]).not.toBe(first.cards[ring]);
  });

  test('an unchanged seat and zone array are the same objects too', () => {
    const game = startedGame({ decks: [['Sol Ring'], [], [], []] });
    put(game, 'p1', 'Sol Ring');
    const projector = new Projector(ORACLE, game.deps.scripts, 'p1');
    const first = projector.project(game.state);
    must(game.submit({ t: 'ManualSetLife', player: 'p1', target: 'p2', delta: -1 }));
    const second = projector.project(game.state);
    expect(second.seats['p1']).toBe(first.seats['p1']);
    expect(second.seats['p2']).not.toBe(first.seats['p2']);
    expect(second.zones[zoneId('bf', 'p1')]).toBe(first.zones[zoneId('bf', 'p1')]);
  });

  test('a phase change reuses every card object', () => {
    const game = startedGame({ decks: [['Sol Ring', 'Grizzly Bears'], [], [], []] });
    put(game, 'p1', 'Sol Ring');
    put(game, 'p1', 'Grizzly Bears');
    const projector = new Projector(ORACLE, game.deps.scripts, 'p1');
    const first = projector.project(game.state);
    must(game.submit({ t: 'PassPriority', player: 'p1' }));
    const second = projector.project(game.state);
    let reused = 0;
    for (const id of battlefieldOf(game, 'p1')) {
      if (second.cards[id] === first.cards[id]) reused++;
    }
    expect(reused).toBe(battlefieldOf(game, 'p1').length);
  });

  test('a card that ceases to exist is dropped from the cache', () => {
    const game = startedGame();
    must(game.submit({ t: 'ManualCreateToken', player: 'p1', printingId: tokenId(game), count: 1 }));
    const token = battlefieldOf(game, 'p1').find((id) => game.state.cards[id]?.isToken) as string;
    const projector = new Projector(ORACLE, game.deps.scripts, 'p1');
    expect(projector.project(game.state).cards[token]).toBeDefined();
    must(
      game.submit({
        t: 'ManualMoveCard',
        player: 'p1',
        card: token,
        to: { kind: 'graveyard', player: 'p1' },
      }),
    );
    expect(projector.project(game.state).cards[token]).toBeUndefined();
  });
});

function tokenId(game: ReturnType<typeof startedGame>): string {
  void game;
  // The Treasure token fixture.
  const card = ORACLE.byName('Treasure');
  if (!card) throw new Error('no Treasure token fixture');
  return card.printingId;
}
