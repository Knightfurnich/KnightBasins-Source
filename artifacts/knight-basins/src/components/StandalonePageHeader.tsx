import { ArrowLeft } from "lucide-react";
import { Link, useLocation } from "wouter";

import { knightFurnichLogo } from "@/data/assets";
import {
  STANDALONE_PAGE_HOME_LABEL,
  STANDALONE_PAGE_NAV,
  STANDALONE_PAGE_QUOTE_LABEL,
} from "@/components/standalonePageNav";

/**
 * job 458-B - the one header shared by the standalone pages (`/readme` `/site-prep` `/portfolio`
 * `/price-guide`).
 *
 * Before this file each of those pages carried its own copy of a header: four different heights
 * (measured on `origin/main` at 390 px: 68 / 72 / 76 / 82 px), two different brand marks (a logo
 * image on three pages, a "KF" tile on the price guide), a back-to-store link on three of them, and
 * no site menu at all - so a customer who reached a guide page had no way to move on except the
 * browser button.
 *
 * `src/App.tsx` and `src/index.css` are frozen for this job, so the header borrows the storefront's
 * own classes (`.site-header`, `.brand`, `.main-nav`, `.header-actions`, `.quote-link`): the
 * typography, the desktop height and the colours therefore come from the same frozen stylesheet as
 * the storefront header instead of being restated here. Two things the storefront gets from an
 * inline `<style>` inside `App.tsx` - which a standalone route never renders - have to be declared
 * in this component instead: the mobile menu that scrolls with a cue (job 431-B E) and the idle link
 * colour that clears AA (job 453-B A). The numbers are the same as `App.tsx`'s on purpose;
 * `test/standalone-page-header-458b.test.ts` fails if either side drifts, because a copy that can
 * drift is exactly what this job is here to remove.
 */

/**
 * `page` prefixes every test id. The `/readme` page keeps the prefix it has always had ("guide"),
 * and the price guide keeps `link-price-guide-home` on the brand, so nothing outside this job that
 * reads those ids stops working.
 */
export function StandalonePageHeader({ page, subtitle }: { page: string; subtitle: string }) {
  const [location] = useLocation();
  return <header className="site-header standalone-page-header" data-page={page} data-testid="standalone-page-header">
    <style>{`
      /* job 453-B A: idle menu links must clear 4.5:1 on the header in both themes. */
      .standalone-page-header > .main-nav a:not(.is-active):not(:hover) {
        color: color-mix(in srgb, var(--ink-soft) 70%, var(--ink));
      }
      /* job 431-B E: above nothing scrolls; below 800 px the menu keeps 44 px targets. */
      /* ข้อ D: every control in this header is a tap target, so none of them may be shorter than
         44 px - the back-to-store link inherits the 10 px padding of the shared button class and
         lands on 42 px without this rule. No backtick may appear inside this template literal:
         one ended it early in development and took the whole page to the error boundary. */
      .standalone-page-header .standalone-back-home,
      .standalone-page-header > .brand,
      .standalone-page-header > .brand img { min-height: 44px; }
      @media (max-width: 800px) {
        .standalone-page-header { padding-inline: clamp(14px, 4vw, 22px); }
        .standalone-page-header > .main-nav { height: auto; min-width: 0; }
        .standalone-page-header > .main-nav a { min-height: 44px; }
      }
      @media (max-width: 720px) {
        .standalone-page-header { min-height: auto; flex-wrap: wrap; padding-top: 8px; padding-bottom: 0; }
        .standalone-page-header > .brand { order: 0; }
        .standalone-page-header > .header-actions { order: 1; margin-left: auto; }
        .standalone-page-header > .main-nav {
          order: 2; flex: 0 0 100%; justify-content: space-between; gap: 6px; height: 44px;
          overflow-x: auto; scrollbar-width: none;
        }
        .standalone-page-header > .main-nav::-webkit-scrollbar { display: none; }
        .standalone-page-header > .main-nav a {
          flex: 0 0 auto; min-height: 44px; padding: 10px; font-size: 13px; line-height: 1.2; white-space: nowrap;
        }
        /* the strip scrolls sideways - say so, or a customer never finds the rest of the menu */
        .standalone-page-header > .main-nav::after {
          content: "\\2192"; flex: 0 0 auto; align-self: center; color: var(--ink-soft); font-size: 13px;
        }
        .standalone-page-header > .main-nav .quote-link {
          display: inline-flex; align-items: center; min-width: 44px; min-height: 44px;
        }
      }
    `}</style>
    <Link href="/" className="brand" aria-label={`Knight Furnich ${STANDALONE_PAGE_HOME_LABEL}`} data-testid={`link-${page}-home`}>
      <img className="brand-logo brand-logo--png" src={knightFurnichLogo} alt="Knight Furnich" />
      <span className="brand-copy"><strong>KNIGHT FURNICH</strong><small>{subtitle}</small></span>
    </Link>
    <nav className="main-nav standalone-top-nav" aria-label="หลัก" data-testid="standalone-top-nav">
      {STANDALONE_PAGE_NAV.map((item) => <Link key={item.href} href={item.href}
        className={location === item.href ? "is-active" : ""}
        data-testid={`link-${page}-nav-${item.href === "/" ? "catalog" : item.href.slice(1)}`}>{item.label}</Link>)}
      <Link href="/quote" className={`quote-link ${location === "/quote" ? "is-active" : ""}`}
        data-testid={`link-${page}-nav-quote`}>{STANDALONE_PAGE_QUOTE_LABEL}</Link>
    </nav>
    <div className="header-actions">
      <Link href="/" className="standalone-back-home button button--outline" data-testid={`link-${page}-back-to-store`}>
        <ArrowLeft size={15} /> {STANDALONE_PAGE_HOME_LABEL}
      </Link>
    </div>
  </header>;
}
