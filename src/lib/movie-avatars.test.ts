import assert from "node:assert/strict";
import test from "node:test";
import { MOVIE_AVATARS, MOVIE_AVATAR_IDS, movieAvatarSvg } from "./movie-avatars";

test("the cast is eight mascots with distinct names and backgrounds", () => {
  assert.equal(MOVIE_AVATAR_IDS.length, 8);
  assert.deepEqual([...new Set(MOVIE_AVATAR_IDS)], MOVIE_AVATAR_IDS);
  const names = Object.values(MOVIE_AVATARS).map((a) => a.name);
  assert.deepEqual([...new Set(names)], names);
});

test("every mascot has the fields the picker and the renderer read", () => {
  for (const id of MOVIE_AVATAR_IDS) {
    const avatar = MOVIE_AVATARS[id];
    assert.match(avatar.name, /^[\w ]+$/, id);
    assert.match(avatar.background, /^#[0-9a-f]{6}$/i, id);
    // art is interpolated raw into the built SVG: it must be shapes, never markup of its own
    assert.ok(avatar.art.length > 40, id);
    for (const forbidden of ["<svg", "<script", "<img", "<foreignObject"]) {
      assert.ok(!avatar.art.toLowerCase().includes(forbidden), `${id} embeds ${forbidden}`);
    }
  }
});

test("the built SVG wraps the art over the mascot's background", () => {
  const svg = movieAvatarSvg("kaiju");
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 64 64">'));
  assert.ok(svg.includes('<path fill="#63315b" d="M0 0h64v64H0z"/>'));
  assert.ok(svg.endsWith(MOVIE_AVATARS.kaiju.art + "</svg>"));
  // the shape the sharp rasteriser and the picker's data URL both rely on
  assert.ok(!svg.slice(4).includes("<svg"));
});

test("an id from the DB round-trips through the catalog, a junk id does not resolve", () => {
  for (const id of ["moonwalker", "sleuth", "kaiju", "driver", "ghost", "robot", "spellbinder", "projectionist"] as const) {
    assert.equal(movieAvatarSvg(id), movieAvatarSvg(MOVIE_AVATAR_IDS[MOVIE_AVATAR_IDS.indexOf(id)]));
  }
  assert.throws(() => movieAvatarSvg("not-one" as never));
});
