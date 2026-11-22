import assert from "node:assert/strict";
import test from "node:test";

import { normaliseOverview } from "./overview";

/**
 * #105: Jellyfin keeps the synopsis an editor typed, so `<br>` arrives in the string and was
 * printed as text. These are the shapes a library actually sends.
 */

test("a <br> becomes a line break, in each spelling a library uses", () => {
  for (const tag of ["<br>", "<br/>", "<br />", "<BR>", "<br  >"]) {
    assert.equal(
      normaliseOverview(`He walks in.${tag}Nobody looks up.`),
      "He walks in.\nNobody looks up.",
      tag,
    );
  }
});

test("clean text passes through unchanged", () => {
  const clean = "A chef returns home.\n\nHis family has other plans.";
  assert.equal(normaliseOverview(clean), clean);
});

test("a bare < in prose is prose, not a tag", () => {
  assert.equal(normaliseOverview("Ratings < 5 are ignored, per <the docs>."), "Ratings < 5 are ignored, per <the docs>.");
});

test("known markup is dropped, and nothing is left dangling", () => {
  assert.equal(
    normaliseOverview("<p>First act.</p><p>Second act.</p>"),
    "First act.\n\nSecond act.",
  );
  assert.equal(normaliseOverview("A <b>very</b> long <i>night</i>."), "A very long night.");
  assert.equal(
    normaliseOverview('<a href="https://example.com/x">Read more</a>'),
    "Read more",
  );
});

test("entities decode exactly once", () => {
  assert.equal(normaliseOverview("Fish &amp; chips"), "Fish & chips");
  assert.equal(normaliseOverview("&quot;Run&quot;"), '"Run"');
  assert.equal(normaliseOverview("A&nbsp;B"), "A B");
  // A source that wrote the escape itself must keep it visible: decoding twice would turn
  // "&amp;lt;br&amp;gt;" into a tag and eat it.
  assert.equal(normaliseOverview("Literal &amp;lt;br&amp;gt; here"), "Literal &lt;br&gt; here");
});

test("runs of blank lines collapse, and the ends are trimmed", () => {
  assert.equal(normaliseOverview("\n\nA.<br><br><br><br>B.\n\n"), "A.\n\nB.");
});

test("absent and non-string overviews stay undefined", () => {
  assert.equal(normaliseOverview(undefined), undefined);
  assert.equal(normaliseOverview(null), undefined);
  assert.equal(normaliseOverview(42), undefined);
});
