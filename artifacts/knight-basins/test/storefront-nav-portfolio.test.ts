import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const appSource = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const headerSource = appSource.match(/function Header\([\s\S]*?(?=\nfunction Footer\()/)?.[0];

function readMainNav() {
  assert.ok(headerSource, "App.tsx should define the storefront Header");
  const nav = headerSource.match(
    /<nav className="main-nav" aria-label="หลัก">([\s\S]*?)<\/nav>/,
  )?.[1];
  assert.ok(nav, "Header should render its main navigation");
  return nav;
}

describe("storefront portfolio and site-prep navigation", () => {
  it("renders both links with their routes, active states, test IDs, and labels", () => {
    const nav = readMainNav();
    const links = [...nav.matchAll(/<Link\b([^>]*)>([\s\S]*?)<\/Link>/g)];

    const expectedLinks = [
      {
        href: "/portfolio",
        testId: "link-portfolio",
        label: "📸 ผลงานจริง",
      },
      {
        href: "/site-prep",
        testId: "link-site-prep",
        label: "📐 เตรียมหน้างาน",
      },
    ];

    for (const expected of expectedLinks) {
      const link = links.find(([, attributes]) => attributes.includes(`href="${expected.href}"`));
      assert.ok(link, `Header should include a link to ${expected.href}`);
      const [, attributes, content] = link;
      assert.match(
        attributes,
        new RegExp(`className=\\{location === "${expected.href.replace("/", "\\/")}" \\? "is-active" : ""\\}`),
      );
      assert.ok(attributes.includes(`data-testid="${expected.testId}"`));
      assert.ok(content.includes(expected.label));
    }

    const quotePosition = nav.indexOf('href="/quote"');
    const sketchPosition = nav.indexOf('href="/sketch"');
    assert.ok(quotePosition > nav.indexOf('href="/portfolio"'));
    assert.ok(quotePosition > nav.indexOf('href="/site-prep"'));
    assert.ok(sketchPosition < nav.indexOf('href="/portfolio"'));
    assert.ok(sketchPosition < nav.indexOf('href="/site-prep"'));
  });

  it("gives the storefront links a full-width mobile navigation row", () => {
    assert.match(headerSource ?? "", /@media \(max-width: 720px\)/);
    assert.match(headerSource ?? "", /\.site-header > \.main-nav \{[\s\S]*?flex: 0 0 100%/);
    assert.match(headerSource ?? "", /\.site-header > \.main-nav a \{[\s\S]*?white-space: nowrap/);
  });
});