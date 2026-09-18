on:nth-child(2)\') !== null'),
      Boolean,
      "small rectangle companion panel",
    );
    const secondRectangleX = await browser.page.evaluate(`(() => {
      const inputs = [...document.querySelectorAll('[data-testid^="input-rectangle-x-"]')];
      return inputs[0]?.getAttribute("data-testid") ?? "";
    })()`);
    assert.match(secondRectangleX, /^input-rectangle-x-/);
    await setTextInput(browser.page, secondRectangleX, "10");

    const dropped = await browser.page.evaluate(`(() => {
      const target = document.querySelector('[data-testid="studio-canvas"]');
      if (!(target instanceof HTMLElement)) return false;
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("application/x-studio-basin", "KF001");
      const rect = target.getBoundingClientRect();
      target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }));
      target.dispatchEvent(new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
        clientX: rect.left + rect.width * 0.2,
        clientY: rect.top + rect.height * 0.5,
      }));
      return true;
    })()`);

    const placementInputIds = await browser.page.evaluate(`(() => ({
      x: document.querySelector('[data-testid^="input-placement-x-"]')?.getAttribute("data-testid") ?? "",
      y: document.querySelector('[data-testid^="input-placement-y-"]')?.getAttribute("data-testid") ?? "",
    }))()`);
    assert.equal(dropped, true);
    await waitFor(
      () => browser.page.evaluate('document.querySelectorAll(".studio-placement").length > 0'),
      Boolean,
      "small rectangle basin placement",
    );

    for (const [testId, value] of [
      ["input-studio-name", "คุณทดสอบขนาดเล็ก"],
      ["input-studio-phone", "0812345678"],
      ["input-studio-project", "โครงการขนาดเล็ก"],
      ["input-studio-address", "กรุงเทพฯ"],
    ] as const) {
      await setTextInput(browser.page, testId, value);
    }
    await clickTestId(browser.page, "button-submit-studio");
    const submitResult = await waitFor(
      () => browser.page.evaluate("window.location.href"),
      (value) => value.includes("/quote/view?token="),
      "small rectangle non-blocking submit",
    );
    assert.match(submitResult, /\/quote\/view\?token=/);
    assert.match(warning, /ขนาด 10 มม/);
  });

  it("keeps Studio export actions on a saved quote snapshot", async () => {
    await browser.page.evaluate("localStorage.clear(); sessionStorage.clear()");
    await browser.page.command("Page.navigate", { url: `${baseUrl}/` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-order-mode-studio"]\') !== null'),
      Boolean,
      "saved Studio order mode",
    );
    await clickTestId(browser.page, "button-order-mode-studio");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-canvas"]\') !== null'),
      Boolean,
      "saved Studio canvas",
    );
    const fill = [
      ["input-studio-name", "คุณทดสอบแบบ"],
      ["input-studio-phone", "0812345678"],
      ["input-studio-project", "โครงการ Studio Export"],
      ["input-studio-address", "กรุงเทพฯ"],
    ] as const;
    for (const [testId, value] of fill) await setTextInput(browser.page, testId, value);
    const dropped = await browser.page.evaluate(`(() => {
      const target = document.querySelector('[data-testid="studio-canvas"]');
      if (!(target instanceof HTMLElement)) return false;
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("application/x-studio-basin", "KF001");
      const rect = target.getBoundingClientRect();
      target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }));
      target.dispatchEvent(new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
        clientX: rect.left + rect.width * 0.2,
        clientY: rect.top + rect.height * 0.5,
      }));
      return true;
    })()`);

    const placementInputIds = await browser.page.evaluate(`(() => ({
      x: document.querySelector('[data-testid^="input-placement-x-"]')?.getAttribute("data-testid") ?? "",
      y: document.querySelector('[data-testid^="input-placement-y-"]')?.getAttribute("data-testid") ?? "",
    }))()`);
    assert.equal(dropped, true);
    await waitFor(
      () => browser.page.evaluate('document.querySelectorAll(".studio-placement").length > 0'),
      Boolean,
      "basin placement",
    );
    await clickTestId(browser.page, "button-submit-studio");
    const savedOutcome = await waitFor(
      () => browser.page.evaluate(`(() => ({
        saved: document.querySelector('[data-testid="saved-studio-layout"]') !== null,
        error: document.querySelector('[data-testid="status-saved-quote-error"]')?.textContent ?? "",
        invalid: document.querySelector('[data-testid="status-saved-quote-invalid"]')?.textContent ?? "",
        result: document.querySelector('[role="status"]')?.textContent ?? "",
        url: window.location.href,
      }))()`),
      (value) => value.saved || Boolean(value.error) || Boolean(value.invalid),
      "saved Studio navigation",
    );
    assert.equal(savedOutcome.saved, true, JSON.stringify(savedOutcome));
    await clickTestId(browser.page, "button-saved-quote-language-en");
    const savedEnglish = await browser.page.evaluate(`(() => ({
      heading: document.querySelector('[data-testid="saved-studio-layout"] h2')?.textContent ?? "",
      note: document.querySelector('[data-testid="saved-studio-layout"] .studio-saved-layout-note')?.textContent ?? "",
      formalTitle: document.querySelector('[data-testid="formal-quote-sheet"] h1')?.textContent ?? "",
    }))()`);
    assert.equal(savedEnglish.heading, "Saved layout");
    assert.match(savedEnglish.note, /Basin positions are read-only/);
    assert.equal(savedEnglish.formalTitle, "OFFICIAL QUOTATION");
    const savedActions = await browser.page.evaluate(`(() => ({
      dxf: document.querySelector('[data-testid="button-download-saved-studio-dxf"]')?.disabled ?? true,
      pdf: document.querySelector('[data-testid="button-download-saved-studio-pdf"]')?.disabled ?? true,
      png: document.querySelector('[data-testid="button-download-studio-png"]')?.disabled ?? true,
    }))()`);
    assert.equal(savedActions.dxf, false);
    assert.equal(savedActions.pdf, false);
    assert.equal(savedActions.png, false);
    await clickTestId(browser.page, "button-download-studio-png");
    await clickTestId(browser.page, "button-download-saved-studio-dxf");
    await browser.page.evaluate("window.__studioPrintCalled = false; window.print = () => { window.__studioPrintCalled = true; }");
    await clickTestId(browser.page, "button-download-saved-studio-pdf");
    assert.equal(await waitFor(
      () => browser.page.evaluate("window.__studioPrintCalled === true"),
      Boolean,
      "saved Studio print action",
    ), true);
    assert.match(await browser.page.evaluate("document.title"), /^KF-Basins-.+-\d+ชิ้น$/);
    await clickTestId(browser.page, "button-copy-saved-studio-to-editor");
    await waitFor(
      () => browser.page.evaluate('window.location.pathname === "/studio" && new URLSearchParams(window.location.search).has("draft")'),
      Boolean,
      "Studio duplicate route",
    );
    assert.equal(await browser.page.evaluate('document.querySelector(\'[data-testid="studio-canvas"]\') !== null'), true);
    assert.equal(await browser.page.evaluate('document.querySelectorAll(".studio-placement").length > 0'), true);
  });

  it("guides shared Studio drafts through basin catalog changes", async () => {
    await browser.page.command("Page.navigate", { url: `${baseUrl}/studio` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-canvas"]\') !== null'),
      Boolean,
      "shared Studio draft canvas",
    );
    await browser.page.evaluate("localStorage.clear(); sessionStorage.clear()");
    await browser.page.command("Page.navigate", { url: `${baseUrl}/studio` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-canvas"]\') !== null'),
      Boolean,
      "fresh shared Studio draft canvas",
    );
    await clickTestId(browser.page, "button-studio-basin-KF002");
    const storedDraft = await waitFor(
      () => browser.page.evaluate('localStorage.getItem("knight-studio-draft-v1")'),
      (value) => Boolean(value),
      "Studio catalog context before named save",
    );
    const savedDraft = JSON.parse(storedDraft) as {
      state: { basinSkus: string[] };
      catalogContext: { revision: string; basinItems: Array<Record<string, unknown>> };
    };
    assert.ok(savedDraft.catalogContext);

    const removedSku = "KF999";
    const removedState = {
      ...savedDraft.state,
      basinSkus: [...savedDraft.state.basinSkus, removedSku],
    };
    const removedContext = {
      ...savedDraft.catalogContext,
      revision: "basins-before-named-removal",
      basinItems: [
        ...savedDraft.catalogContext.basinItems,
        { sku: removedSku, colorName: "รุ่นที่ยกเลิกสำหรับแบบร่างที่ตั้งชื่อ" },
      ],
    };
    await browser.page.command("Page.navigate", {
      url: sharedStudioDraftUrl(removedState, removedContext),
    });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-catalog-change-banner"]\')?.textContent ?? ""'),
      (value) => value.includes(removedSku),
      "removed basin catalog notice",
    );
    const removedNotice = await browser.page.evaluate(`(() => ({
      banner: document.querySelector('[data-testid="studio-catalog-change-banner"]')?.textContent ?? "",
      hidden: document.querySelector('[data-testid="studio-hidden-basins"]')?.textContent ?? "",
      replacement: document.querySelector('[data-testid="select-replace-studio-basin-${removedSku}"]') !== null,
      removal: document.querySelector('[data-testid="button-remove-hidden-studio-basin-${removedSku}"]') !== null,
    }))()`);
    assert.match(removedNotice.banner, new RegExp(removedSku));
    assert.match(removedNotice.banner, /ไม่มีในแคตตาล็อกปัจจุบัน/);
    assert.match(removedNotice.hidden, new RegExp(removedSku));
    assert.equal(removedNotice.replacement, true);
    assert.equal(removedNotice.removal, true);

    const replacementSku = await browser.page.evaluate(`(() => {
      const select = document.querySelector('[data-testid="select-replace-studio-basin-${removedSku}"]');
      if (!(select instanceof HTMLSelectElement)) return "";
      return [...select.options].find((option) => option.value)?.value ?? "";
    })()`);
    assert.ok(replacementSku, "A replacement basin should be available");
    await setSelectValue(browser.page, `select-replace-studio-basin-${removedSku}`, replacementSku);
    await waitFor(
      () => browser.page.evaluate(`document.querySelector('[data-testid="select-replace-studio-basin-${removedSku}"]') === null`),
      Boolean,
      "removed basin replacement",
    );
    assert.equal(await browser.page.evaluate(`document.querySelector('[data-testid="button-studio-basin-${replacementSku}"]')?.getAttribute("aria-pressed")`), "true");
    const replacedNotice = await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-catalog-change-banner"]\')?.textContent ?? ""'),
      (value) => value.includes("จัดการแล้ว") && value.includes(removedSku),
      "resolved replacement catalog notice",
    );
    assert.doesNotMatch(replacedNotice, /ไม่มีในแคตตาล็อกปัจจุบัน/);
    const persistedReplacementResolution = await waitFor(
      () => browser.page.evaluate(`(() => {
        const raw = localStorage.getItem("knight-studio-draft-v1");
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        return parsed.catalogContext?.resolvedSkus?.includes("${removedSku}") === true;
      })()`),
      Boolean,
      "resolved replacement autosave",
    );
    assert.equal(persistedReplacementResolution, true);

    await browser.page.command("Page.navigate", { url: `${baseUrl}/studio` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-resume-studio-draft"]\') !== null'),
      Boolean,
      "resolved Studio draft reopen banner",
    );
    await clickTestId(browser.page, "button-resume-studio-draft");
    await waitFor(
      () => browser.page.evaluate(`document.querySelector('[data-testid="studio-catalog-resolved-${removedSku}"]') !== null`),
      Boolean,
      "resolved replacement after draft reopen",
    );
    assert.equal(await browser.page.evaluate(`document.querySelector('[data-testid="select-replace-studio-basin-${removedSku}"]') === null`), true);

    await browser.page.command("Page.navigate", {
      url: sharedStudioDraftUrl(removedState, removedContext),
    });
    await waitFor(
      () => browser.page.evaluate(`document.querySelector('[data-testid="button-remove-hidden-studio-basin-${removedSku}"]') !== null`),
      Boolean,
      "removed basin removal control",
    );
    await clickTestId(browser.page, `button-remove-hidden-studio-basin-${removedSku}`);
    await waitFor(
      () => browser.page.evaluate(`document.querySelector('[data-testid="studio-hidden-basins"]') === null`),
      Boolean,
      "removed basin removal",
    );
    const removedResolvedNotice = await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-catalog-resolved"]\')?.textContent ?? ""'),
      (value) => value.includes(removedSku),
      "resolved removal catalog notice",
    );
    assert.match(removedResolvedNotice, /นำออกจากแบบหรือแทนที่แล้ว/);
    assert.equal(await browser.page.evaluate(`document.querySelector('[data-testid="select-replace-studio-basin-${removedSku}"]') === null`), true);

    const changedContext = {
      ...savedDraft.catalogContext,
      revision: "basins-before-update",
      basinItems: savedDraft.catalogContext.basinItems.map((item) =>
        item.sku === "KF001"
          ? { ...item, colorName: "ชื่อสีก่อนหน้า", priceTHB: Number(item.priceTHB) + 1000, basinDimensions: "360 × 510 × 130 mm" }
          : item,
      ),
    };
    await browser.page.command("Page.navigate", {
      url: sharedStudioDraftUrl(savedDraft.state, changedContext),
    });
    const changedNotice = await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-catalog-change-banner"]\')?.textContent ?? ""'),
      (value) => value.includes("KF001") && value.includes("ชื่อสีก่อนหน้า"),
      "changed basin catalog notice",
    );
    assert.match(changedNotice, /รายละเอียดแคตตาล็อกเปลี่ยนจาก ชื่อสีก่อนหน้า/);
    assert.match(changedNotice, /ราคา: ฿[\d,]+ → ฿[\d,]+/);
    assert.match(changedNotice, /ขนาดหลุม: 360 × 510 × 130 mm →/);
    assert.equal(await browser.page.evaluate('document.querySelector(\'[data-testid="studio-hidden-basins"]\') === null'), true);

    const staleContext = {
      ...savedDraft.catalogContext,
      revision: "basins-before-other-catalog-change",
    };
    await browser.page.command("Page.navigate", {
      url: sharedStudioDraftUrl(savedDraft.state, staleContext),
    });
    const unchangedSelectionNotice = await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-catalog-change-banner"]\')?.textContent ?? ""'),
      (value) => value.includes("รุ่นอ่างที่เลือกยังตรงกับรายการปัจจุบัน"),
      "unchanged selected basin catalog notice",
    );
    assert.match(unchangedSelectionNotice, /มีรายการอื่นในแคตตาล็อกอัปเดตแล้ว/);
    assert.equal(await browser.page.evaluate('document.querySelector(\'[data-testid="studio-hidden-basins"]\') === null'), true);
  });

  it("keeps Studio controls within the viewport on mobile", async () => {
    await browser.page.command("Emulation.setEmulatedMedia", { media: "screen" });
    await browser.page.command("Page.navigate", { url: `${baseUrl}/` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-order-mode-studio"]\') !== null'),
      Boolean,
      "Studio order mode",
    );
    await clickTestId(browser.page, "button-order-mode-studio");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-stone-comparison"]\') !== null'),
      Boolean,
      "Studio comparison",
    );

    await browser.page.command("Emulation.setDeviceMetricsOverride", {
      width: 375,
      height: 1200,
      deviceScaleFactor: 1,
      mobile: true,
    });
    const mobile = await browser.page.evaluate(`(() => {
      const style = (selector) => {
        const element = document.querySelector(selector);
        return element instanceof HTMLElement ? getComputedStyle(element).gridTemplateColumns : "";
      };
      return {
        bodyWidth: document.body.scrollWidth,
        viewportWidth: window.innerWidth,
        rectangleColumns: style(".studio-rectangle-inputs"),
        sideStatusColumns: style(".studio-side-status-grid"),
        pricingColumns: style(".studio-pricing-inputs"),
        comparisonColumns: style(".studio-stone-comparison-grid"),
      };
    })()`);
    assert.ok(mobile.bodyWidth <= mobile.viewportWidth, "Studio must not widen the mobile page");
    assert.equal(mobile.rectangleColumns.split(" ").length, 2);
    assert.equal(mobile.sideStatusColumns.split(" ").length, 2);
    assert.equal(mobile.pricingColumns.split(" ").length, 1);
    assert.equal(mobile.comparisonColumns.split(" ").length, 1);

    await browser.page.command("Emulation.setDeviceMetricsOverride", {
      width: 768,
      height: 1200,
      deviceScaleFactor: 1,
      mobile: false,
    });
    const tablet = await browser.page.evaluate(`(() => {
      const style = (selector) => {
        const element = document.querySelector(selector);
        return element instanceof HTMLElement ? getComputedStyle(element).gridTemplateColumns : "";
      };
      return {
        bodyWidth: document.body.scrollWidth,
        viewportWidth: window.innerWidth,
        rectangleColumns: style(".studio-rectangle-inputs"),
        sideStatusColumns: style(".studio-side-status-grid"),
        pricingColumns: style(".studio-pricing-inputs"),
        comparisonColumns: style(".studio-stone-comparison-grid"),
      };
    })()`);
    assert.ok(tablet.bodyWidth <= tablet.viewportWidth, "Studio must not widen the tablet page");
    assert.equal(tablet.rectangleColumns.split(" ").length, 4);
    assert.equal(tablet.sideStatusColumns.split(" ").length, 4);
    assert.equal(tablet.pricingColumns.split(" ").length, 3);
    assert.equal(tablet.comparisonColumns.split(" ").length, 3);
  });

  it("previews the latest hand sketch file without widening the mobile page", async () => {
    const fixtureDirectory = await mkdtemp(path.join(os.tmpdir(), "knight-basins-sketch-preview-"));
    const pngBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
    const firstFile = path.join(fixtureDirectory, "first-sketch.png");
    const secondFile = path.join(fixtureDirectory, "latest-sketch.png");
    await writeFile(firstFile, pngBytes);
    await writeFile(secondFile, pngBytes);
    try {
      await browser.page.command("Emulation.setDeviceMetricsOverride", {
        width: 375,
        height: 1200,
        deviceScaleFactor: 1,
        mobile: true,
      });
      await browser.page.command("Page.navigate", { url: `${baseUrl}/` });
      await waitFor(
        () => browser.page.evaluate('document.querySelector(\'[data-testid="button-order-mode-sketch"]\') !== null'),
        Boolean,
        "hand sketch order mode",
      );
      await browser.page.evaluate("localStorage.clear(); sessionStorage.clear()");
      await clickTestId(browser.page, "button-order-mode-sketch");
      await waitFor(
        () => browser.page.evaluate('document.querySelector(\'[data-testid="input-studio-sketch"]\') !== null'),
        Boolean,
        "hand sketch file input",
      );
      await browser.page.evaluate(`(() => {
        window.__revokedSketchObjectUrls = [];
        const nativeRevokeObjectURL = URL.revokeObjectURL.bind(URL);
        URL.revokeObjectURL = (url) => {
          window.__revokedSketchObjectUrls.push(url);
          nativeRevokeObjectURL(url);
        };
      })()`);

      await setFileInput(browser.page, firstFile);
      const firstPreview = await waitFor(
        () => browser.page.evaluate(`(() => {
          const image = document.querySelector('[data-testid="img-studio-sketch-preview"]');
          const fileInput = document.querySelector('[data-testid="input-studio-sketch"]');
          return {
            src: image?.getAttribute("src") ?? "",
            alt: image?.getAttribute("alt") ?? "",
            fileName: fileInput instanceof HTMLInputElement ? fileInput.files?.[0]?.name ?? "" : "",
            naturalWidth: image instanceof HTMLImageElement ? image.naturalWidth : 0,
          };
        })()`),
        (value) => Boolean(value.src) && value.naturalWidth > 0,
        "first hand sketch preview",
      );
      assert.match(firstPreview.alt, /first-sketch\.png/);
      assert.equal(firstPreview.fileName, "first-sketch.png");

      await setFileInput(browser.page, secondFile);
      const secondPreview = await waitFor(
        () => browser.page.evaluate(`(() => {
          const image = document.querySelector('[data-testid="img-studio-sketch-preview"]');
          const fileInput = document.querySelector('[data-testid="input-studio-sketch"]');
          return {
            src: image?.getAttribute("src") ?? "",
            alt: image?.getAttribute("alt") ?? "",
            fileName: fileInput instanceof HTMLInputElement ? fileInput.files?.[0]?.name ?? "" : "",
            naturalWidth: image instanceof HTMLImageElement ? image.naturalWidth : 0,
          };
        })()`),
        (value) => value.fileName === "latest-sketch.png" && value.naturalWidth > 0 && value.src !== firstPreview.src,
        "latest hand sketch preview",
      );
      assert.match(secondPreview.alt, /latest-sketch\.png/);
      assert.equal(secondPreview.fileName, "latest-sketch.png");
      assert.ok(secondPreview.src.startsWith("blob:"));
      assert.equal(await browser.page.evaluate(`window.__revokedSketchObjectUrls.includes(${JSON.stringify(firstPreview.src)})`), true);

      const mobileLayout = await browser.page.evaluate(`(() => {
        const drop = document.querySelector(".studio-file-drop");
        return {
          bodyWidth: document.body.scrollWidth,
          viewportWidth: window.innerWidth,
          previewWidth: drop?.querySelector("img")?.getBoundingClientRect().width ?? 0,
          dropWidth: drop instanceof HTMLElement ? drop.getBoundingClientRect().width : 0,
        };
      })()`);
      assert.ok(mobileLayout.bodyWidth <= mobileLayout.viewportWidth, "Hand sketch preview must not widen the mobile page");
      assert.ok(mobileLayout.previewWidth <= mobileLayout.dropWidth, "Hand sketch preview must stay inside the upload frame");

      await setTextInput(browser.page, "input-studio-name", "คุณทดสอบ");
      await setTextInput(browser.page, "input-studio-phone", "0812345678");
      await setTextInput(browser.page, "input-studio-project", "โครงการทดสอบ preview");
      await browser.page.evaluate(`(() => {
        window.fetch = async () => new Response(JSON.stringify({ message: "ส่งแบบร่างเรียบร้อยแล้ว" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      })()`);
      await clickTestId(browser.page, "button-submit-sketch");
      await waitFor(
        () => browser.page.evaluate(`(() => ({
          preview: document.querySelector('[data-testid="img-studio-sketch-preview"]') !== null,
          fileCount: document.querySelector('[data-testid="input-studio-sketch"]') instanceof HTMLInputElement
            ? document.querySelector('[data-testid="input-studio-sketch"]').files?.length ?? 0
            : -1,
          revoked: window.__revokedSketchObjectUrls.includes(${JSON.stringify(secondPreview.src)}),
        }))()`),
        (value) => !value.preview && value.fileCount === 0 && value.revoked,
        "cleared hand sketch preview after submit",
      );
    } finally {
      await rm(fixtureDirectory, { force: true, recursive: true });
    }
  });

  it("shows the Studio basin shortlist as a responsive two-or-three card grid", async () => {
    await browser.page.command("Emulation.setEmulatedMedia", { media: "screen" });
    await browser.page.command("Page.navigate", { url: `${baseUrl}/` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-order-mode-studio"]\') !== null'),
      Boolean,
      "basin grid Studio order mode",
    );
    await browser.page.evaluate("localStorage.clear(); sessionStorage.clear()");
    await clickTestId(browser.page, "button-order-mode-studio");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-basin-list"]\') !== null'),
      Boolean,
      "basin shortlist",
    );

    const readBasinGrid = () => browser.page.evaluate(`(() => {
      const list = document.querySelector(".studio-basin-list");
      const cards = [...document.querySelectorAll(".studio-basin-choice")];
      const art = document.querySelector(".studio-basin-choice-art");
      const columns = list instanceof HTMLElement
        ? getComputedStyle(list).gridTemplateColumns.trim().split(/\\s+/).filter(Boolean).length
        : 0;
      return {
        columns,
        bodyWidth: document.body.scrollWidth,
        viewportWidth: window.innerWidth,
        cardCount: cards.length,
        artWidth: art instanceof HTMLElement ? art.getBoundingClientRect().width : 0,
        artHeight: art instanceof HTMLElement ? art.getBoundingClientRect().height : 0,
      };
    })()`);

    await browser.page.command("Emulation.setDeviceMetricsOverride", {
      width: 375,
      height: 1200,
      deviceScaleFactor: 1,
      mobile: true,
    });
    const mobile = await readBasinGrid();
    assert.equal(mobile.columns, 2);
    assert.ok(mobile.bodyWidth <= mobile.viewportWidth, "The mobile basin shortlist must not widen the page");
    assert.ok(mobile.artWidth >= 100, `Mobile basin art is too narrow: ${JSON.stringify(mobile)}`);
    assert.ok(mobile.artHeight >= 100, `Mobile basin art is too short: ${JSON.stringify(mobile)}`);

    await browser.page.command("Emulation.setDeviceMetricsOverride", {
      width: 1920,
      height: 1200,
      deviceScaleFactor: 1,
      mobile: false,
    });
    const desktop = await readBasinGrid();
    assert.equal(desktop.columns, 3, `Desktop basin grid is not three columns: ${JSON.stringify(desktop)}`);
    assert.ok(desktop.bodyWidth <= desktop.viewportWidth, "The desktop basin shortlist must not widen the page");
    assert.ok(desktop.artWidth > 100);
    assert.ok(desktop.artHeight > 100);

    await clickTestId(browser.page, "button-studio-basin-KF001");
    await clickTestId(browser.page, "button-studio-basin-KF002");
    await clickTestId(browser.page, "button-studio-basin-KF019");
    const selectedBeforeSearch = await browser.page.evaluate(`(() => ({
      selected: [...document.querySelectorAll(".studio-basin-choice.is-selected")].length,
      first: document.querySelector('[data-testid="button-studio-basin-KF001"]')?.getAttribute("aria-pressed") ?? "",
      second: document.querySelector('[data-testid="button-studio-basin-KF002"]')?.getAttribute("aria-pressed") ?? "",
      third: document.querySelector('[data-testid="button-studio-basin-KF019"]')?.getAttribute("aria-pressed") ?? "",
    }))()`);
    assert.equal(selectedBeforeSearch.selected, 2);
    assert.equal(selectedBeforeSearch.first, "true");
    assert.equal(selectedBeforeSearch.second, "true");
    assert.equal(selectedBeforeSearch.third, "false");

    await setTextInput(browser.page, "input-studio-basin-search", "KF002");
    await waitFor(
      () => browser.page.evaluate('document.querySelectorAll(".studio-basin-choice").length === 1'),
      Boolean,
      "filtered basin shortlist",
    );
    assert.equal(await browser.page.evaluate('document.querySelector(\'[data-testid="button-studio-basin-KF002"]\')?.getAttribute("aria-pressed")'), "true");
  });

  it("shows Studio measurement guidance, swaps deep dimensions, and cleans phone input", async () => {
    await browser.page.evaluate("localStorage.clear(); sessionStorage.clear()");
    await browser.page.command("Page.navigate", { url: `${baseUrl}/` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-order-mode-studio"]\') !== null'),
      Boolean,
      "Studio helper order mode",
    );
    await clickTestId(browser.page, "button-order-mode-studio");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-canvas"]\') !== null'),
      Boolean,
      "Studio helper canvas",
    );
    const widthId = await browser.page.evaluate(`document.querySelector('[data-testid^="input-rectangle-width-"]')?.getAttribute("data-testid") ?? ""`);
    const lengthId = await browser.page.evaluate(`document.querySelector('[data-testid^="input-rectangle-length-"]')?.getAttribute("data-testid") ?? ""`);
    assert.ok(widthId);
    assert.ok(lengthId);
    assert.equal(await browser.page.evaluate('document.body.textContent?.includes("หน่วย มิลลิเมตร (มม.) เช่น 600 มม. = 60 ซม. / 1800 มม. = 1.8 เมตร") ?? false'), true);
    assert.equal(await browser.page.evaluate('document.body.textContent?.includes("ติดบัว = ชิดผนังปูน / ขอบเปิด = โชว์ลอยในอากาศ") ?? false'), true);

    await setTextInput(browser.page, widthId, "1000");
    const swapId = await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid^="button-swap-rectangle-dimensions-"]\')?.getAttribute("data-testid") ?? ""'),
      (value) => Boolean(value),
      "dimension swap suggestion",
    );
    await clickTestId(browser.page, swapId);
    assert.equal(await browser.page.evaluate(`document.querySelector('[data-testid="${widthId}"]')?.value ?? ""`), "600");
    assert.equal(await browser.page.evaluate(`document.querySelector('[data-testid="${lengthId}"]')?.value ?? ""`), "1000");

    await setTextInput(browser.page, "input-studio-phone", "081-234-5678");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="input-studio-phone"]\')?.value ?? ""'),
      (value) => value === "0812345678",
      "cleaned Studio phone",
    );
  });

  it("autosaves Studio drafts and resumes them from a self-contained link", async () => {
    await browser.page.command("Emulation.setEmulatedMedia", { media: "screen" });
    await browser.page.command("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await browser.page.command("Page.navigate", { url: `${baseUrl}/` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-order-mode-studio"]\') !== null'),
      Boolean,
      "Studio order mode",
    );
    await browser.page.evaluate("localStorage.removeItem('knight-studio-draft-v1')");
    await clickTestId(browser.page, "button-order-mode-studio");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-save-studio-draft-link"]\') !== null'),
      Boolean,
      "Studio draft toolbar",
    );
    const widthId = await browser.page.evaluate(`document.querySelector('[data-testid^="input-rectangle-width-"]')?.getAttribute("data-testid") ?? ""`);
    assert.ok(widthId);
    await setTextInput(browser.page, widthId, "2100");
    await clickTestId(browser.page, "button-studio-stone-SO423");
    await clickTestId(browser.page, "button-studio-active-stone-SO423");
    await clickTestId(browser.page, "button-studio-basin-KF002");
    await waitFor(
      () => browser.page.evaluate(`(() => {
        const record = JSON.parse(localStorage.getItem("knight-studio-draft-v1") || "null");
        return record?.state?.activeStone === "SO423" && record?.state?.basinSkus?.includes("KF002") && record?.state?.pieces?.[0]?.rectangles?.[0]?.widthMm === 2100;
      })()`),
      Boolean,
      "autosaved Studio state",
    );

    await browser.page.command("Page.navigate", { url: `${baseUrl}/` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-order-mode-studio"]\') !== null'),
      Boolean,
      "Studio order mode after draft save",
    );
    await clickTestId(browser.page, "button-order-mode-studio");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-draft-banner"]\') !== null'),
      Boolean,
      "Studio draft recovery banner",
    );
    assert.match(await browser.page.evaluate('document.querySelector(\'[data-testid="studio-draft-banner"]\')?.textContent ?? ""'), /พบแบบร่างที่ทำค้างไว้เมื่อ/);
    await clickTestId(browser.page, "button-resume-studio-draft");
    const resumed = await waitFor(
      () => browser.page.evaluate(`(() => {
        const input = document.querySelector('[data-testid^="input-rectangle-width-"]');
        return input instanceof HTMLInputElement ? input.value : "";
      })()`),
      (value) => value === "2250",
      "named draft card restore",
    );
    assert.equal(resumed.activeStone, true);
    assert.equal(resumed.basinSelected, true);
    assert.equal(resumed.width, "2100");
    assert.equal(resumed.banner, false);

    await browser.page.evaluate(`(() => {
      window.__draftLink = "";
      navigator.clipboard.writeText = async (value) => { window.__draftLink = value; };
    })()`);
    await clickTestId(browser.page, "button-save-studio-draft-link");
    const draftLink = await waitFor(
      () => browser.page.evaluate("window.__draftLink"),
      (value) => typeof value === "string" && value.includes("/studio?draft="),
      "copied Studio draft link",
    );
    assert.ok(draftLink.length > 100);
    assert.match(draftLink, /\/studio\?draft=[A-Za-z0-9_-]+$/);
    await browser.page.evaluate("localStorage.clear(); sessionStorage.clear()");
    await browser.page.command("Page.navigate", { url: draftLink });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-save-studio-draft-link"]\') !== null'),
      Boolean,
      "linked Studio draft",
    );
    const linked = await browser.page.evaluate(`(() => ({
      activeStone: document.querySelector('[data-testid="button-studio-active-stone-SO423"]')?.classList.contains("is-active") ?? false,
      basinSelected: document.querySelector('[data-testid="button-studio-basin-KF002"]')?.classList.contains("is-selected") ?? false,
      width: (() => { const input = document.querySelector('[data-testid^="input-rectangle-width-"]'); return input instanceof HTMLInputElement ? input.value : ""; })(),
      banner: document.querySelector('[data-testid="studio-draft-banner"]') !== null,
    }))()`);
    assert.equal(linked.activeStone, true);
    assert.equal(linked.basinSelected, true);
    assert.equal(linked.width, "2100");
    assert.equal(linked.banner, false);
    const legacyDraftLink = draftLink;
    assert.match(legacyDraftLink, /\/studio\?draft=[A-Za-z0-9_-]+$/);
    await browser.page.evaluate("localStorage.clear(); sessionStorage.clear()");
    await browser.page.command("Page.navigate", { url: legacyDraftLink });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-save-studio-draft-link"]\') !== null'),
      Boolean,
      "legacy linked Studio draft",
    );
    assert.equal(await browser.page.evaluate('document.querySelector(\'[data-testid="button-studio-active-stone-SO423"]\')?.classList.contains("is-active") ?? false'), true);
    assert.equal(await browser.page.evaluate('document.querySelector(\'[data-testid="button-studio-basin-KF002"]\')?.classList.contains("is-selected") ?? false'), true);
    assert.equal(await browser.page.evaluate(`(() => {
      const input = document.querySelector('[data-testid^="input-rectangle-width-"]');
      return input instanceof HTMLInputElement ? input.value : "";
    })()`), "2100");
    await browser.page.evaluate("localStorage.clear()");
  });

  it("saves named Studio drafts in My Drafts and restores each card", async () => {
    await browser.page.command("Emulation.setEmulatedMedia", { media: "screen" });
    await browser.page.command("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await browser.page.command("Page.navigate", { url: `${baseUrl}/` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-order-mode-studio"]\') !== null'),
      Boolean,
      "Studio order mode",
    );
    await browser.page.evaluate("localStorage.removeItem('knight-studio-draft-v1'); localStorage.removeItem('knight-studio-drafts-v1')");
    await clickTestId(browser.page, "button-order-mode-studio");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-save-named-studio-draft"]\') !== null'),
      Boolean,
      "named Studio draft toolbar",
    );
    const widthId = await browser.page.evaluate(`document.querySelector('[data-testid^="input-rectangle-width-"]')?.getAttribute("data-testid") ?? ""`);
    assert.ok(widthId);
    await setTextInput(browser.page, widthId, "2250");
    const dropped = await browser.page.evaluate(`(() => {
      const target = document.querySelector('[data-testid="studio-canvas"]');
      if (!(target instanceof HTMLElement)) return false;
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("application/x-studio-basin", "KF001");
      const rect = target.getBoundingClientRect();
      target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer }));
      target.dispatchEvent(new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
        clientX: rect.left + rect.width * 0.5,
        clientY: rect.top + rect.height * 0.5,
      }));
      return true;
    })()`);
    assert.equal(dropped, true);
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid^="studio-placement-"]\') !== null'),
      Boolean,
      "basin placement on Studio canvas",
    );
    await clickTestId(browser.page, "button-save-named-studio-draft");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-save-draft-dialog"]\') !== null'),
      Boolean,
      "save named draft dialog",
    );
    await setTextInput(browser.page, "input-studio-draft-name", "ห้องน้ำชั้น 1");
    await clickTestId(browser.page, "button-confirm-save-studio-draft");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-drafts-drawer"]\') !== null'),
      Boolean,
      "My Drafts drawer",
    );
    const card = await browser.page.evaluate(`(() => {
      const card = document.querySelector('[data-testid^="studio-saved-draft-"]');
      return {
        name: card?.querySelector(".studio-saved-draft-heading strong")?.textContent ?? "",
        summary: card?.querySelector(".studio-saved-draft-summary")?.textContent ?? "",
        preview: card?.querySelector('[data-testid^="studio-draft-preview-"]') !== null,
        placement: card?.querySelector('[data-testid^="studio-draft-placement-"]') !== null,
        count: document.querySelector('[data-testid="button-open-studio-drafts"]')?.textContent ?? "",
      };
    })()`);
    assert.equal(card.name, "ห้องน้ำชั้น 1");
    assert.match(card.summary, /m²/);
    assert.equal(card.preview, true);
    assert.equal(card.placement, true);
    assert.match(card.count, /แบบร่างของฉัน \(1\)/);

    await browser.page.evaluate(`(() => {
      window.__namedDraftLink = "";
      navigator.clipboard.writeText = async (value) => { window.__namedDraftLink = value; };
    })()`);
    await browser.page.evaluate("document.querySelector('[data-testid^=\"button-copy-studio-draft-\"]')?.click()");
    const namedDraftLink = await waitFor(
      () => browser.page.evaluate("window.__namedDraftLink"),
      (value) => typeof value === "string" && value.includes("/studio?draft="),
      "named draft card link",
    );
    assert.ok(namedDraftLink.length <= 100);
    assert.match(namedDraftLink, /\/studio\?draft=KB-[A-Z0-9]{6}$/);
    await browser.page.evaluate("document.querySelector('[data-testid^=\"button-open-studio-draft-\"]')?.click()");
    const resumed = await waitFor(
      () => browser.page.evaluate(`(() => {
        const input = document.querySelector('[data-testid^="input-rectangle-width-"]');
        return input instanceof HTMLInputElement ? input.value : "";
      })()`),
      (value) => value === "2250",
      "named draft card restore",
    );
    assert.equal(resumed, "2250");

    await setTextInput(browser.page, widthId, "2350");
    await clickTestId(browser.page, "button-save-named-studio-draft");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-save-draft-dialog"]\') !== null'),
      Boolean,
      "update named draft dialog",
    );
    assert.equal(await browser.page.evaluate(`document.querySelector('[data-testid="input-studio-draft-name"]')?.value ?? ""`), "ห้องน้ำชั้น 1");
    await clickTestId(browser.page, "button-confirm-save-studio-draft");
    await waitFor(
      () => browser.page.evaluate(`(() => {
        const drafts = JSON.parse(localStorage.getItem("knight-studio-drafts-v1") || "[]");
        return drafts.length === 1 && drafts[0]?.state?.pieces?.[0]?.rectangles?.[0]?.widthMm === 2350;
      })()`),
      Boolean,
      "updated named draft without duplicate",
    );
    const updatedDraft = await browser.page.evaluate(`(() => {
      const drafts = JSON.parse(localStorage.getItem("knight-studio-drafts-v1") || "[]");
      return { count: drafts.length, id: drafts[0]?.id ?? "", name: drafts[0]?.name ?? "", width: drafts[0]?.state?.pieces?.[0]?.rectangles?.[0]?.widthMm ?? 0 };
    })()`);
    assert.equal(updatedDraft.count, 1);
    assert.equal(updatedDraft.name, "ห้องน้ำชั้น 1");
    assert.equal(updatedDraft.width, 2350);
    await clickTestId(browser.page, "button-close-studio-drafts");

    await clickTestId(browser.page, "button-open-studio-drafts");
    await browser.page.evaluate("window.confirm = () => true");
    await browser.page.evaluate("document.querySelector('[data-testid^=\"button-delete-studio-draft-\"]')?.click()");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-drafts-drawer"]\')?.textContent?.includes("ยังไม่มีแบบร่างที่ตั้งชื่อ") ?? false'),
      Boolean,
      "deleted named draft",
    );

    await browser.page.evaluate("localStorage.removeItem('knight-studio-draft-v1'); localStorage.removeItem('knight-studio-drafts-v1')");
    await browser.page.command("Page.navigate", { url: namedDraftLink });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-save-named-studio-draft"]\') !== null'),
      Boolean,
      "named draft link",
    );
    const linkedWidth = await browser.page.evaluate(`(() => {
      const input = document.querySelector('[data-testid^="input-rectangle-width-"]');
      return input instanceof HTMLInputElement ? input.value : "";
    })()`);
    const storedDraft = await waitFor(
      () => browser.page.evaluate('localStorage.getItem("knight-studio-draft-v1")'),
      (value) => Boolean(value),
      "Studio catalog context before named save",
    );
    const savedDraft = JSON.parse(storedDraft) as {
      state: { basinSkus: string[] };
      catalogContext: { revision: string; basinItems: Array<Record<string, unknown>> };
    };
    assert.ok(savedDraft.catalogContext);

    const removedSku = "KF999";
    const removedState = {
      ...savedDraft.state,
      basinSkus: [...savedDraft.state.basinSkus, removedSku],
    };
    const removedContext = {
      ...savedDraft.catalogContext,
      revision: "basins-before-named-removal",
      basinItems: [
        ...savedDraft.catalogContext.basinItems,
        { sku: removedSku, colorName: "รุ่นที่ยกเลิกสำหรับแบบร่างที่ตั้งชื่อ" },
      ],
    };
    await browser.page.command("Page.navigate", {
      url: sharedStudioDraftUrl(removedState, removedContext),
    });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-catalog-change-banner"]\')?.textContent ?? ""'),
      (value) => value.includes(removedSku),
      "named draft removed basin notice",
    );
    await clickTestId(browser.page, `button-remove-hidden-studio-basin-${removedSku}`);
    await waitFor(
      () => browser.page.evaluate(`document.querySelector('[data-testid="studio-catalog-resolved-${removedSku}"]') !== null`),
      Boolean,
      "named draft resolved catalog notice",
    );

    await clickTestId(browser.page, "button-save-named-studio-draft");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-save-draft-dialog"]\') !== null'),
      Boolean,
      "named catalog draft dialog",
    );
    await setTextInput(browser.page, "input-studio-draft-name", "แบบร่างที่ยืนยันแคตตาล็อกแล้ว");
    await clickTestId(browser.page, "button-confirm-save-studio-draft");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-drafts-drawer"]\') !== null'),
      Boolean,
      "named catalog draft saved",
    );
    const namedDraftRecord = await browser.page.evaluate(`(() => {
      const drafts = JSON.parse(localStorage.getItem("knight-studio-drafts-v1") || "[]");
      const draft = drafts[0];
      return {
        basinSkus: draft?.state?.basinSkus ?? [],
        savedCatalogSkus: draft?.catalogContext?.basinItems?.map((item) => item.sku) ?? [],
        resolvedSkus: draft?.catalogContext?.resolvedSkus ?? [],
      };
    })()`);
    assert.equal(namedDraftRecord.basinSkus.includes(removedSku), false);
    assert.equal(namedDraftRecord.savedCatalogSkus.includes(removedSku), true);
    assert.equal(namedDraftRecord.resolvedSkus.includes(removedSku), true);

    await browser.page.command("Page.navigate", { url: `${baseUrl}/studio` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-new-studio-draft"]\') !== null'),
      Boolean,
      "fresh Studio draft action",
    );
    await clickTestId(browser.page, "button-new-studio-draft");
    await clickTestId(browser.page, "button-open-studio-drafts");
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="studio-drafts-drawer"]\') !== null'),
      Boolean,
      "named catalog draft drawer after reopen",
    );
    await browser.page.evaluate('document.querySelector(\'[data-testid^="button-open-studio-draft-"]\')?.click()');
    await waitFor(
      () => browser.page.evaluate(`document.querySelector('[data-testid="studio-catalog-resolved-${removedSku}"]') !== null`),
      Boolean,
      "resolved catalog entry after named draft reopen",
    );
    const reopenedNotice = await browser.page.evaluate(`(() => ({
      resolved: document.querySelector('[data-testid="studio-catalog-resolved-${removedSku}"]')?.textContent ?? "",
      activeWarning: document.querySelector('[data-testid="select-replace-studio-basin-${removedSku}"]') !== null ||
        document.querySelector('[data-testid="button-remove-hidden-studio-basin-${removedSku}"]') !== null,
    }))()`);
    assert.match(reopenedNotice.resolved, new RegExp(removedSku));
    assert.equal(reopenedNotice.activeWarning, false);
    await browser.page.evaluate("localStorage.clear()");
  });

  it("keeps KnightSupport readable and above mobile floating controls", async () => {
    await browser.page.command("Emulation.setEmulatedMedia", { media: "screen" });
    await browser.page.command("Emulation.setDeviceMetricsOverride", {
      width: 375,
      height: 1200,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await browser.page.command("Page.navigate", { url: `${baseUrl}/` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-knight-support"]\') !== null'),
      Boolean,
      "KnightSupport trigger",
    );
    await clickTestId(browser.page, "button-knight-support");
    const support = await waitFor(
      () => browser.page.evaluate(`(() => {
        const panel = document.querySelector(".knight-support-panel");
        const input = document.querySelector(".knight-support-form input");
        const title = document.querySelector(".knight-support-head strong");
        const description = document.querySelector(".knight-support-head small");
        const support = document.querySelector(".knight-support");
        if (!(panel instanceof HTMLElement) || !(input instanceof HTMLInputElement) || !(support instanceof HTMLElement)) return null;
        const maxHeight = Number.parseFloat(getComputedStyle(panel).maxHeight);
        return {
          title: title?.textContent ?? "",
          description: description?.textContent ?? "",
          fontSize: getComputedStyle(input).fontSize,
          maxHeight,
          expectedMaxHeight: window.innerHeight - 80,
          zIndex: getComputedStyle(support).zIndex,
          panelWidth: panel.getBoundingClientRect().width,
          bodyWidth: document.body.scrollWidth,
          viewportWidth: window.innerWidth,
        };
      })()`),
      (value): value is { title: string; description: string; fontSize: string; maxHeight: number; expectedMaxHeight: number; zIndex: string; panelWidth: number; bodyWidth: number; viewportWidth: number } => value !== null,
      "KnightSupport panel",
    );
    assert.equal(support.title, "น้องไนท์ (ผู้ช่วยทีมขาย)");
    assert.equal(support.description, "ถามสินค้า ราคา หรือวิธีใช้งาน Knight Basins ได้เลยค่ะ");
    assert.equal(support.fontSize, "14px");
    assert.ok(support.maxHeight <= support.expectedMaxHeight + 1);
    assert.equal(support.zIndex, "100");
    assert.ok(support.panelWidth <= 351);
    assert.ok(support.bodyWidth <= support.viewportWidth);

    await clickTestId(browser.page, "button-reset-knight-support-position");
    const dragStart = await browser.page.evaluate(`(() => {
      const wrapper = document.querySelector(".knight-support");
      const head = document.querySelector(".knight-support-head");
      if (!(wrapper instanceof HTMLElement) || !(head instanceof HTMLElement)) return null;
      const rect = wrapper.getBoundingClientRect();
      const pointer = { bubbles: true, cancelable: true, clientX: rect.left + 40, clientY: rect.top + 20, pointerId: 7, pointerType: "touch", buttons: 1 };
      head.dispatchEvent(new PointerEvent("pointerdown", pointer));
      head.dispatchEvent(new PointerEvent("pointermove", { ...pointer, clientX: pointer.clientX - 90, clientY: pointer.clientY - 70 }));
      head.dispatchEvent(new PointerEvent("pointerup", { ...pointer, clientX: pointer.clientX - 90, clientY: pointer.clientY - 70, buttons: 0 }));
      return { left: rect.left, top: rect.top };
    })()`);
    assert.ok(dragStart);
    const draggedPosition = await waitFor(
      () => browser.page.evaluate(`(() => {
        const wrapper = document.querySelector(".knight-support");
        if (!(wrapper instanceof HTMLElement)) return null;
        const rect = wrapper.getBoundingClientRect();
        return { left: rect.left, top: rect.top };
      })()`),
      (value): value is { left: number; top: number } => value !== null && value.left < (dragStart?.left ?? 0) - 40 && value.top < (dragStart?.top ?? 0) - 20,
      "dragged KnightSupport position",
    );
    assert.ok(draggedPosition.left < (dragStart?.left ?? 0) - 40);
    assert.ok(draggedPosition.top < (dragStart?.top ?? 0) - 20);
    await clickTestId(browser.page, "button-reset-knight-support-position");
    await waitFor(
      () => browser.page.evaluate("localStorage.getItem('knight-support-position')"),
      (value) => value === null,
      "reset KnightSupport position",
    );
  });

  it("flows authenticated profile defaults into a quote and toggles the condo floor field", async () => {
    await browser.page.command("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await browser.page.command("Page.addScriptToEvaluateOnNewDocument", {
      source: `(() => {
        const realFetch = window.fetch.bind(window);
        window.fetch = async (input, init) => {
          const url = input instanceof Request ? input.url : String(input);
          if (url.includes("/api/auth/line/status")) {
            return new Response(JSON.stringify({ authenticated: true, displayName: "คุณโปรไฟล์" }), { status: 200, headers: { "Content-Type": "application/json" } });
          }
          if (url.includes("/api/customer/profile")) {
            return new Response(JSON.stringify({
              id: 7,
              lineUserId: "Uprofile",
              displayName: "คุณโปรไฟล์",
              fullName: "คุณโปรไฟล์",
              phone: "0812345678",
              email: "profile@example.com",
              company: "บริษัทโปรไฟล์ จำกัด",
              project: "โครงการจากโปรไฟล์",
              address: "99 ถนนสุขุมวิท กรุงเทพฯ",
              taxName: "บริษัทโปรไฟล์ จำกัด",
              taxId: "0105559012345",
              taxBranch: "สำนักงานใหญ่",
              taxAddress: "99 ถนนสุขุมวิท กรุงเทพฯ 10110",
              preferredContact: "line",
              customerRole: "homeowner",
              createdAt: "2026-09-15T00:00:00.000Z",
              updatedAt: "2026-09-15T00:00:00.000Z"
            }), { status: 200, headers: { "Content-Type": "application/json" } });
          }
          if (url.includes("/api/customer/quotes")) {
            return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
          }
          return realFetch(input, init);
        };
      })();`,
    });
    await browser.page.command("Page.navigate", { url: `${baseUrl}/` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="button-order-mode-quick-purchase"]\') !== null'),
      Boolean,
      "storefront before clearing browser state",
    );
    await browser.page.evaluate("localStorage.clear(); sessionStorage.clear()");
    await browser.page.command("Page.navigate", { url: `${baseUrl}/` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="card-product-KF001"]\') !== null'),
      Boolean,
      "catalog with authenticated profile",
    );
    await clickTestId(browser.page, "card-product-KF001");
    await browser.page.command("Page.navigate", { url: `${baseUrl}/quote` });
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="input-customer-name"]\')?.value === "คุณโปรไฟล์"'),
      Boolean,
      "profile defaults in quote",
    );

    const profileDefaults = await browser.page.evaluate(`(() => ({
      name: document.querySelector('[data-testid="input-customer-name"]')?.value ?? "",
      phone: document.querySelector('[data-testid="input-customer-phone"]')?.value ?? "",
      project: document.querySelector('[data-testid="input-customer-project"]')?.value ?? "",
      taxAddress: document.querySelector('[data-testid="input-customer-tax-address"]')?.value ?? "",
      preferredContact: document.querySelector('[data-testid="input-customer-preferred-contact"]')?.value ?? "",
      role: document.querySelector('[data-testid="input-customer-role"]')?.value ?? "",
    }))()`);
    assert.deepEqual(profileDefaults, {
      name: "คุณโปรไฟล์",
      phone: "0812345678",
      project: "โครงการจากโปรไฟล์",
      taxAddress: "99 ถนนสุขุมวิท กรุงเทพฯ 10110",
      preferredContact: "line",
      role: "homeowner",
    });

    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="input-customer-property-type"]\') !== null'),
      Boolean,
      "quote site fields",
    );
    await browser.page.evaluate(`(() => {
      const select = document.querySelector('[data-testid="input-customer-property-type"]');
      if (!(select instanceof HTMLSelectElement)) return false;
      select.value = "condo";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="input-customer-condo-floor"]\') !== null'),
      Boolean,
      "condo floor field",
    );
    await browser.page.evaluate(`(() => {
      const select = document.querySelector('[data-testid="input-customer-property-type"]');
      if (!(select instanceof HTMLSelectElement)) return false;
      select.value = "house-townhome";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);
    await waitFor(
      () => browser.page.evaluate('document.querySelector(\'[data-testid="input-customer-condo-floor"]\') === null'),
      Boolean,
      "condo floor field hidden for houses",
    );
  });
});

    const saved = await waitFor(
      () => browser.page.evaluate(`(() => {
        const drafts = JSON.parse(localStorage.getItem("knight-studio-drafts-v1") || "[]");
        const draft = drafts.find((item) => item.name === "แบบร่างตัวยู");
        if (!draft) return null;
        return {
          shape: draft.state.shape,
          dimensions: draft.state.dimensions,
          rectangles: draft.state.pieces?.[0]?.rectangles?.map(({ widthMm, lengthMm, xMm, yMm, rotation }) => ({ widthMm, lengthMm, xMm, yMm, rotation })) ?? [],
          basinPlacements: draft.state.basinPlacements?.map(({ sku, pieceId, xMm, yMm, widthMm, depthMm }) => ({ sku, pieceId, xMm, yMm, widthMm, depthMm })) ?? [],
        };
      })()`),
      (value) => value !== null,
      "saved U draft payload",
    );

    const dxf = await browser.page.evaluate("window.__studioDxfBlob.text()");

    const restored = await waitFor(
      () => browser.page.evaluate(`(() => ({
        mainSizes: [...document.querySelectorAll('[data-testid="studio-canvas"] .studio-piece-size')].map((item) => item.textContent),
        printSizes: [...document.querySelectorAll('.studio-print-canvas .studio-piece-size')].map((item) => item.textContent),
        mainBasin: document.querySelector('[data-testid="studio-canvas"] .studio-placement')?.getAttribute("style") ?? "",
        mainBasinValid: document.querySelector('[data-testid="studio-canvas"] .studio-placement')?.classList.contains("studio-placement--invalid") === false,
      }))()`),
      (value) => {
        const left = Number.parseFloat(value.mainBasin.match(/left: ([0-9.]+)/)?.[1] ?? "NaN");
        const top = Number.parseFloat(value.mainBasin.match(/top: ([0-9.]+)/)?.[1] ?? "NaN");
        return value.mainSizes.length === 3 && value.printSizes.length === 3 && Math.abs(left - 3.333) < 0.1 && Math.abs(top - 36.111) < 0.1;
      },
      "restored U geometry",
    );
