import { Link } from "wouter";

export function NetworkPage() {
  return (
    <section
      className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16"
      aria-labelledby="network-title"
      data-testid="network-page"
    >
      <header className="mb-9 max-w-3xl">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">
          KNIGHT FURNICH NETWORK
        </p>
        <h1
          id="network-title"
          className="text-3xl font-bold leading-tight text-slate-900 md:text-4xl"
        >
          เครือข่ายของเรา
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          ทำความรู้จักกับบริษัท Knight Furnich, ระบบเลือกอ่างและหิน Knight Basins
          และแหล่งความรู้เรื่องหินสังเคราะห์ที่เราดูแลร่วมกัน
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-3" aria-label="เว็บไซต์ในเครือ">
        <article
          className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          data-testid="network-card-knight-furnich"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
            บริษัทแม่
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            Knight Furnich
          </h2>
          <p className="mt-3 flex-1 leading-7 text-slate-600">
            โรงงานผลิตและติดตั้งงานหินสังเคราะห์ พร้อมประสบการณ์ด้านวัสดุและงานตกแต่งมากกว่า 20 ปี
          </p>
          <a
            className="mt-5 font-semibold text-sky-700 underline underline-offset-4"
            href="https://www.knightfurnich.com/"
            target="_blank"
            rel="noopener"
            data-testid="link-network-knightfurnich"
          >
            Knight Furnich — เว็บบริษัท (ประสบการณ์ 20 ปี)
          </a>
          <nav className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm" aria-label="ช่องทางของ Knight Furnich">
            <a
              className="font-semibold text-sky-700 underline underline-offset-4"
              href="https://line.me/R/ti/p/@789gcnhq"
              target="_blank"
              rel="noopener"
              data-testid="link-network-line"
            >
              LINE OA @789gcnhq
            </a>
            <a
              className="font-semibold text-sky-700 underline underline-offset-4"
              href="https://www.facebook.com/knightfurnich"
              target="_blank"
              rel="noopener"
              data-testid="link-network-facebook"
            >
              Facebook Knight Furnich
            </a>
          </nav>
        </article>

        <article
          className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          data-testid="network-card-knight-basins"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
            ระบบออนไลน์
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            Knight Basins
          </h2>
          <p className="mt-3 flex-1 leading-7 text-slate-600">
            เลือกชมอ่างล้างหน้าและสีหิน เปรียบเทียบผลงาน และจัดทำใบเสนอราคาสำหรับโครงการของคุณ
          </p>
          <Link
            className="mt-5 font-semibold text-sky-700 underline underline-offset-4"
            href="/quote"
            data-testid="link-network-quote"
          >
            เริ่มจัดทำใบเสนอราคา
          </Link>
        </article>

        <article
          className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          data-testid="network-card-hinsangkhro"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
            ศูนย์ความรู้
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            หินสังเคราะห์.com
          </h2>
          <p className="mt-3 flex-1 leading-7 text-slate-600">
            รวมความรู้เกี่ยวกับหินสังเคราะห์ การเลือกวัสดุ และการดูแลรักษาสำหรับเจ้าของบ้านและผู้ทำงานก่อสร้าง
          </p>
          <a
            className="mt-5 font-semibold text-sky-700 underline underline-offset-4"
            href="https://xn--42cf7czb6aef3bfnp2mrg.com/"
            target="_blank"
            rel="noopener"
            data-testid="link-network-hinsangkhro"
          >
            ความรู้เรื่องหินสังเคราะห์
          </a>
        </article>
      </div>

      <nav
        className="mt-10 flex flex-wrap gap-x-6 gap-y-3 border-t border-slate-200 pt-6"
        aria-label="สำรวจ Knight Basins"
      >
        <Link
          className="font-semibold text-sky-700 underline underline-offset-4"
          href="/stone"
          data-testid="link-network-stone"
        >
          เลือกชมสีหินสังเคราะห์
        </Link>
        <Link
          className="font-semibold text-sky-700 underline underline-offset-4"
          href="/portfolio"
          data-testid="link-network-portfolio"
        >
          ดูผลงานติดตั้งจริง
        </Link>
        <Link
          className="font-semibold text-sky-700 underline underline-offset-4"
          href="/quote"
          data-testid="link-network-quote-footer"
        >
          ขอใบเสนอราคา
        </Link>
      </nav>
    </section>
  );
}

export default NetworkPage;
