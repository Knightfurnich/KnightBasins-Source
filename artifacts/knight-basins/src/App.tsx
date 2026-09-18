��ารถแก้ไขจากลิงก์นี้ได้"}</p>
    <p className="studio-print-warning">{STUDIO_PRINT_NOTE}</p>
  </section>;
}

function SavedQuotePage() {
  const [location, setLocation] = useLocation();
  const publicQuoteToken = new URLSearchParams(window.location.search).get("token") ?? "";
  const { data: lead, isLoading, error } = useGetSavedQuote(
    { token: publicQuoteToken },
    { query: { enabled: Boolean(publicQuoteToken), retry: false, queryKey: ["saved-quote", publicQuoteToken] } },
  );
  const [copied, setCopied] = useState(false);
  const [language, setLanguage] = useState<QuoteLanguage>("TH");
  const notifyMutation = useNotifySavedQuote();
  const [notificationMessage, setNotificationMessage] = useState(() => new URLSearchParams(window.location.search).get("notification") ?? "");
  const shouldPrint = new URLSearchParams(window.location.search).get("print") === "1";
  useEffect(() => {
    const persisted = lead?.studioData ? readSavedQuotePayload(lead.studioData) : null;
    setLanguage(persisted?.kind === "quick-purchase" ? persisted.language ?? "TH" : "TH");
  }, [lead?.quoteNumber]);
  useEffect(() => {
    if (!shouldPrint || !lead) return;
    const timer = window.setTimeout(() => window.print(), 500);
    return () => window.clearTimeout(timer);
  }, [shouldPrint, lead?.quoteNumber]);

  if (!publicQuoteToken) {
    return <div className="page-wrap empty-state"><span className="empty-number">—</span><h3>ไม่พบลิงก์ใบเสนอราคา</h3><p>ต้องใช้ลิงก์สาธารณะที่ลงลายมือชื่อแล้วเพื่อเปิดเอกสารนี้</p><Link href="/quote" className="text-link">กลับไปสร้างใบเสนอราคา <ArrowRight size={15} /></Link></div>;
  }
  if (isLoading) {
    return <div className="page-wrap empty-state" data-testid="status-saved-quote-loading"><span className="empty-number">…</span><h3>กำลังเปิดใบเสนอราคา</h3><p>กำลังโหลดแบบและตัวเลขที่บันทึกไว้</p></div>;
  }
  if (error || !lead) {
    return <div className="page-wrap empty-state" data-testid="status-saved-quote-error"><span className="empty-number">404</span><h3>ไม่พบใบเสนอราคานี้</h3><p>ลิงก์อาจไม่ถูกต้อง หรือเอกสารยังไม่ได้บันทึก</p><Link href="/" className="text-link">กลับไปแคตตาล็อก <ArrowRight size={15} /></Link></div>;
  }
  const saved = readSavedQuotePayload(lead.studioData);
  if (!saved) {
    return <div className="page-wrap empty-state" data-testid="status-saved-quote-invalid"><span className="empty-number">—</span><h3>เอกสารนี้ไม่มี snapshot ที่บันทึกไว้</h3><Link href="/" className="text-link">กลับไปแคตตาล็อก <ArrowRight size={15} /></Link></div>;
  }

  const issueDate = new Date(lead.createdAt);
  const expiryDate = new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  let state: StudioState | null = null;
  let customer: CustomerDetails;
  let formalItems: FormalQuoteItem[];
  let format: QuoteFormat;
  let grossSubtotal: number;
  let discountAmount: number;
  let subtotal: number;
  let vatAmount: number;
  let total: number;
  let vat: boolean;
  let lineSummary: string;

  if (saved.kind === "quick-purchase") {
    customer = saved.customer;
    formalItems = saved.items;
    format = saved.quoteFormat;
    grossSubtotal = saved.grossSubtotal;
    discountAmount = saved.discountAmount;
    subtotal = saved.subtotal;
    vatAmount = saved.vatAmount;
    total = saved.total;
    vat = saved.vat;
    lineSummary = `Knight Furnich ใบเสนอราคา ${lead.quoteNumber}\n${saved.customer.project || ""}\nโทร ${saved.customer.phone || "-"} · LINE ${saved.customer.lineContact || "-"} · ${saved.customer.email || "-"}\nยอดรวม ${formatTHB(saved.total)}`;
  } else {
    state = saved.state;
    const estimate = saved.estimate;
    customer = {
      name: lead.name ?? "",
      company: lead.company ?? "",
      taxId: lead.taxId ?? "",
      taxName: lead.taxName ?? "",
      taxBranch: lead.taxBranch ?? "",
      taxAddress: lead.taxAddress ?? "",
      phone: lead.phone ?? "",
      lineContact: lead.lineContact ?? "",
      email: lead.email ?? "",
      purchasingDepartment: "",
      address: lead.address ?? "",
      project: lead.project ?? "",
      site: "",
      preferredContact: (lead.preferredContact as CustomerDetails["preferredContact"]) ?? "",
      customerRole: (lead.customerRole as CustomerDetails["customerRole"]) ?? "",
      propertyType: (lead.propertyType as CustomerDetails["propertyType"]) ?? "",
      condoFloor: lead.condoFloor ?? "",
      expectedInstallationDate: lead.expectedInstallationDate ?? "",
      notes: lead.notes ?? "",
    };
    const placements = state.basinPlacements.length
      ? state.basinPlacements
      : state.basinSkus.map((sku, index) => ({ sku, id: `${sku}-${index}`, xMm: 70, yMm: 70, ...(() => {
        const product = productBySku(sku);
        return product ? { widthMm: product.basinDimensions ? Number(product.basinDimensions.match(/\d+/)?.[0] ?? 0) || null : null, depthMm: product.basinDimensions ? Number(product.basinDimensions.match(/\d+/g)?.[1] ?? 0) || null : null } : { widthMm: null, depthMm: null };
      })() }));
    const basinCounts = new Map<string, number>();
    placements.forEach((placement) => basinCounts.set(placement.sku, (basinCounts.get(placement.sku) ?? 0) + 1));
    formalItems = [];
    basinCounts.forEach((quantity, sku) => {
      const product = productBySku(sku);
      if (!product) return;
      formalItems.push({
        code: product.sku,
        description: `${product.colorName} · ${product.category === "counter basin" ? "อ่างวางเคาน์เตอร์" : "อ่างตั้งพื้น"} · ${product.dimensions}${product.basinDimensions ? ` · หลุม ${product.basinDimensions}` : ""}`,
        quantity,
        unit: "ใบ",
        unitPrice: product.priceTHB,
        total: product.priceTHB * quantity,
        videoUrl: product.videoUrl,
         notificationKind: "basin",
      });
    });
    const requestedInstallation = placements.length * INSTALLATION_PRICE;
     if (requestedInstallation > 0) formalItems.push({ code: "INSTALL", description: "ค่าติดตั้ง / ค่าแรงต่อชุด", quantity: placements.length, unit: "ชุด", unitPrice: INSTALLATION_PRICE, total: requestedInstallation, notificationKind: "service" });
     if (estimate.stoneUnitPriceTHB !== null) {
       const activeStone = stoneColorByName(state.activeStone);
       formalItems.push({
         code: activeStone.code,
         description: `${activeStone.name} · พื้นที่แผ่นรวมตามแบบ`,
         quantity: estimate.counterAreaSqM ?? estimate.stoneAreaSqM,
         unit: "ตร.ม.",
         unitPrice: estimate.stoneUnitPriceTHB,
         total: Math.max(0, (estimate.stoneTotalTHB ?? 0) - (estimate.upstandTotalTHB ?? 0)),
         notificationKind: "stone",
       });
       if ((estimate.upstandLengthM ?? 0) > 0) {
         formalItems.push({
           code: "UPSTAND",
           description: `บัว ${estimate.upstandLengthM.toFixed(2)} ม. · สูง ${state.upstandHeightMm ?? "ไม่ระบุ"} มม.`,
           quantity: estimate.upstandLengthM,
           unit: "ม.",
           unitPrice: estimate.upstandTotalTHB && estimate.upstandLengthM ? estimate.upstandTotalTHB / estimate.upstandLengthM : 0,
           total: estimate.upstandTotalTHB ?? 0,
           notificationKind: "service",
         });
       }
     }
     if ((estimate.openEdgeLengthM ?? 0) > 0) {
       formalItems.push({
         code: "OPEN-EDGE",
         description: `ขอบเปิด ${estimate.openEdgeLengthM.toFixed(2)} ม. · ${estimate.openEdgeUnitPriceTHB === 0 ? "ฟรี" : estimate.openEdgeUnitPriceTHB === null ? "รอทีมขายกรอกราคา" : "ราคาต่อเมตร"}`,
         quantity: estimate.openEdgeLengthM,
         unit: "ม.",
         unitPrice: estimate.openEdgeUnitPriceTHB ?? 0,
         total: estimate.openEdgeTotalTHB ?? 0,
         notificationKind: "service",
       });
     }
     formalItems.push({
       code: "WORKPIECES",
       description: `${estimate.pieceCount ?? 1} ชิ้นงาน · ${estimate.rectangleCount ?? 0} แผ่น`,
       quantity: estimate.pieceCount ?? 1,
       unit: "ชิ้นงาน",
       unitPrice: 0,
       total: 0,
       notificationKind: "service",
     });
     if (estimate.smallJobFeeTHB > 0) formalItems.push({ code: "SMALL-JOB", description: "ค่าดำเนินการงานพื้นที่เล็ก", quantity: 1, unit: "งาน", unitPrice: estimate.smallJobFeeTHB, total: estimate.smallJobFeeTHB, notificationKind: "service" });
     if (saved.notification) {
       formalItems = saved.notification.items.map((item) => ({
         code: item.code,
         description: item.description,
         quantity: item.quantity,
         unit: item.unit,
         unitPrice: item.unitPriceTHB ?? 0,
         total: item.totalTHB ?? Math.round(item.quantity * (item.unitPriceTHB ?? 0)),
         notificationKind: item.kind,
       }));
     }
    format = state.quoteFormat ?? "US";
     subtotal = saved.notification?.subtotal ?? estimate.subtotalTHB ?? estimate.totalTHB;
      discountAmount = saved.notification?.discountAmount ?? (estimate.installationDiscountTHB ?? 0) + (estimate.discountTHB ?? 0);
      grossSubtotal = saved.notification?.grossSubtotal ?? estimate.grossSubtotalTHB ?? subtotal + discountAmount;
     vatAmount = saved.notification?.vatAmount ?? estimate.vatAmountTHB ?? 0;
     total = saved.notification?.total ?? estimate.totalTHB;
     vat = saved.notification?.vat ?? Boolean(state.vat);
     lineSummary = `Knight Furnich ใบเสนอราคา ${lead.quoteNumber}\n${lead.project ?? ""}\nชิ้นงาน ${estimate.pieceCount ?? 1} ชิ้น · บัว ${estimate.upstandLengthM?.toFixed(2) ?? "0.00"} ม. · ขอบ ${estimate.openEdgeLengthM?.toFixed(2) ?? "0.00"} ม.\nยอดรวม ${formatTHB(estimate.totalTHB)}`;
  }
  const savedQuoteNumber = lead.quoteNumber ?? "saved-quote";
  const printSavedQuote = () => {
    const previousTitle = document.title;
    const cleanup = () => {
      document.title = previousTitle;
    };
    document.title = savedQuotePrintTitle(savedQuoteNumber, language);
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 1000);
  };
  const copyLink = async () => {
    await navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  const sendNotification = async () => {
    setNotificationMessage("กำลังส่งแจ้งเตือน...");
    try {
      const result = await notifyMutation.mutateAsync({ data: { token: publicQuoteToken } });
      setNotificationMessage(result.message);
    } catch (error) {
      setNotificationMessage(error instanceof Error ? error.message : "บันทึกแล้ว แต่ส่งแจ้งเตือนไม่สำเร็จ กรุณาลองใหม่");
    }
  };
  const copySavedStudioToEditor = () => {
    if (!state) return;
    const url = new URL(createStudioShareLink(state));
    setLocation(`${url.pathname}${url.search}`);
  };

  return <div className="page-wrap quote-page saved-quote-page" data-testid="saved-quote-page">
    <section className="quote-heading saved-quote-heading">
      <div><p className="eyebrow accent">SAVED QUOTATION / {lead.quoteNumber}</p><h1>ใบเสนอราคา<br /><em>พร้อมแบบที่บันทึกไว้</em></h1><p className="hero-copy">เอกสารนี้เปิดดูได้จากลิงก์เดิม และข้อมูลในแบบเป็น read-only</p></div>
      <div className="quote-date"><span>{language === "EN" ? "Issue Date" : "วันที่ออกเอกสาร"}</span><strong>{formatQuoteDate(issueDate, language)}</strong><small>{language === "EN" ? `Valid until ${formatQuoteDate(expiryDate, language)} · 30 days` : `ใช้ได้ถึง ${formatQuoteDate(expiryDate, language)} · 30 วัน`}</small><button onClick={printSavedQuote} data-testid="button-print-saved-quote"><Printer size={15} /> {language === "EN" ? "Print / PDF" : "พิมพ์ / PDF ทางการ"}</button></div>
    </section>
    <div className="quote-editor saved-quote-editor">
    <div className="saved-quote-actions">
      <div className="quote-language-switch" role="group" aria-label="ภาษาของใบเสนอราคา">
        <span>PDF / Print</span>
        <button type="button" className={language === "TH" ? "is-active" : ""} onClick={() => setLanguage("TH")} aria-pressed={language === "TH"} data-testid="button-saved-quote-language-th">TH</button>
        <button type="button" className={language === "EN" ? "is-active" : ""} onClick={() => setLanguage("EN")} aria-pressed={language === "EN"} data-testid="button-saved-quote-language-en">EN</button>
      </div>
      <button className="button button--dark" onClick={copyLink} data-testid="button-copy-saved-quote-link">{copied ? <><Check size={15} /> คัดลอกลิงก์แล้ว</> : "คัดลอกลิงก์ใบเสนอราคา"}</button>
       {state && <button className="button button--accent" onClick={copySavedStudioToEditor} data-testid="button-copy-saved-studio-to-editor"><Copy size={15} /> คัดลอกผังนี้ไปปรับแต่งใหม่</button>}
      <button className="button button--accent" onClick={sendNotification} disabled={notifyMutation.isPending} data-testid="button-send-saved-quote-notification">{notifyMutation.isPending ? "กำลังส่ง..." : "ส่งเข้า Telegram"}</button>
      <button className="button button--outline" onClick={() => setLocation("/")} data-testid="button-saved-quote-home">กลับไปแคตตาล็อก</button>
    </div>
    {notificationMessage && <p className="studio-result" role="status" data-testid="status-saved-quote-notification">{notificationMessage}</p>}
    </div>
    {state && <StudioLayoutSnapshot state={state} quoteNumber={savedQuoteNumber} language={language} />}
     <FormalQuote format={format} quoteNumber={savedQuoteNumber} issueDate={issueDate} expiryDate={expiryDate} customer={customer} items={formalItems} grossSubtotal={grossSubtotal} discountAmount={discountAmount} subtotal={subtotal} vatAmount={vatAmount} total={total} vat={vat} language={language} />
    <div className="source-note">แบบและราคา snapshot จากวันที่สร้างเอกสาร · {lineSummary}</div>
  </div>;
}

function QuotePage({ cart, setCart, stones, setStones, stoneColors, customer, setCustomer, vat, setVat, onSubmitQuote }: { cart: QuoteBasinLine[]; setCart: Dispatch<SetStateAction<QuoteBasinLine[]>>; stones: StoneConfig[]; setStones: Dispatch<SetStateAction<StoneConfig[]>>; stoneColors: ReadonlyArray<StoneColor>; customer: CustomerDetails; setCustomer: Dispatch<SetStateAction<CustomerDetails>>; vat: boolean; setVat: Dispatch<SetStateAction<boolean>>; onSubmitQuote: (snapshot: QuickQuoteSnapshot, notify?: boolean) => Promise<void> }) {
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [quoteFormat, setQuoteFormat] = useStored<QuoteFormat>("knight-quote-format", "US");
  const [quoteLanguage, setQuoteLanguage] = useState<QuoteLanguage>("TH");
  const [quoteSerial] = useStored("knight-quote-serial", String(Math.floor(1000 + Math.random() * 8999)));
  const issueDate = useMemo(() => new Date(), []);
  const expiryDate = useMemo(() => new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000), [issueDate]);
  const today = thaiDateInputValue(new Date());
  const quoteNumber = `${formatQuoteMonth(issueDate)} / ${quoteFormat} / ${quoteSerial}`;
  const basinSubtotal = cart.reduce((sum, line) => sum + (productBySku(line.sku)?.priceTHB || 0) * line.quantity, 0);
  const basinSets = cart.reduce((sum, line) => sum + line.quantity, 0);
  const requestedInstallationCharge = cart.reduce((sum, line) => sum + (line.installationSelected ? INSTALLATION_PRICE * line.quantity : 0), 0);
  const stoneActive = stones.length > 0;
  const totalStone = stones.reduce((sum, stone) => sum + stoneTotal(stone, stoneColors), 0);
  const { installationDiscount, installationCharge, grossSubtotal, subtotal, vatAmount, total } = calculateFormalQuoteTotals({ basinSubtotal, requestedInstallationCharge, basinSets, stoneTotal: totalStone, vat, vatRate: VAT_RATE });
  const hasInvalidEmail = !isValidEmailAddress(customer.email);
  const hasMissing = false;
  const hasInvalidTaxId = Boolean(customer.taxId && !/^[0-9]{13}$/.test(customer.taxId));
  const hasPastInstallationDate = Boolean(customer.expectedInstallationDate && customer.expectedInstallationDate < today);
  const missingTaxIdForVat = vat && !/^[0-9]{13}$/.test(customer.taxId);
  const hasInvalidStone = stones.some((stone) => isInvalidStone(stone, stoneColors));
  const canGenerate = !hasInvalidEmail && !hasInvalidTaxId && !hasPastInstallationDate && !hasInvalidStone && cart.length > 0;
  const formalItems: FormalQuoteItem[] = cart.map((line) => {
    const product = productBySku(line.sku)!;
    return {
      code: product.sku,
      description: `${product.colorName} · ${product.category === "counter basin" ? "อ่างวางเคาน์เตอร์" : "อ่างตั้งพื้น"} · ${product.dimensions}${product.basinDimensions ? ` · หลุม ${product.basinDimensions}` : ""}${quoteFormat === "OF" ? ` · จุดติดตั้ง ${customer.site || customer.project || "ตามแบบ"}` : ""}`,
      quantity: line.quantity,
      unit: "ชุด",
      unitPrice: product.priceTHB,
      total: product.priceTHB * line.quantity,
      videoUrl: product.videoUrl,
      notificationKind: "basin",
    };
  });
   if (requestedInstallationCharge > 0) formalItems.push({ code: "INSTALL", description: quoteFormat === "OF" ? `ค่าติดตั้ง / ค่าแรง แยกรายจุด · ${customer.site || customer.project || "ตามแบบ"}` : "ค่าติดตั้ง / ค่าแรงต่อชุด", quantity: requestedInstallationCharge / INSTALLATION_PRICE, unit: "ชุด", unitPrice: INSTALLATION_PRICE, total: requestedInstallationCharge, notificationKind: "service" });
  stones.forEach((stone) => {
     const selectedStone = stoneColorByName(stone.color, stoneColors);
     const currentStoneUnitPrice = stoneUnitPrice(stone, stoneColors);
     if (currentStoneUnitPrice === null || isInvalidStone(stone, stoneColors)) return;
    formalItems.push({
      code: selectedStone.code,
      description: `${selectedStone.name} · ${stoneOrderModeLabel(stone.mode)} · ${stone.mode === "whole-sheet" ? "แผ่นมาตรฐาน 760 × 3680 mm" : `พื้นที่ ${stone.widthCm} × ${stone.lengthCm} cm`}`,
      quantity: stone.mode === "whole-sheet" ? stone.quantity : stoneAreaSqM(stone),
      unit: stone.mode === "whole-sheet" ? "แผ่น" : "ตร.ม.",
      unitPrice: currentStoneUnitPrice,
       total: stoneTotal(stone, stoneColors),
       notificationKind: "stone",
    });
  });
  const lineSummary = [
    `Knight Furnich ใบเสนอราคา ${quoteNumber}`,
    `รูปแบบ: ${quoteFormat === "US" ? "US / สรุปตามพื้นที่" : "OF / รายละเอียดหน้างาน"}`,
    `ผู้ติดต่อ: ${customer.name} · โครงการ: ${customer.project}`,
    `ประเภทสถานที่: ${customer.propertyType || "-"}${customer.condoFloor ? ` · ชั้น ${customer.condoFloor}` : ""} · วันที่คาดว่าจะติดตั้ง: ${customer.expectedInstallationDate || "-"}`,
    `ใบกำกับภาษี: ${customer.taxName || "-"} · ${customer.taxId || "-"} · ${customer.taxBranch || "-"}`,
    `สินค้า: ${cart.map((line) => `${line.sku} x${line.quantity}`).join(", ") || "-"}`,
    `หินสังเคราะห์: ${stoneActive ? stones.map((stone) => `${stoneColorByName(stone.color).code} · ${stoneOrderModeLabel(stone.mode)} · ${stone.mode === "whole-sheet" ? `${stone.quantity} แผ่น` : `${stoneAreaSqM(stone).toFixed(2)} m²`}`).join(", ") : "ไม่ได้เลือก"}`,
    `ยอดสุทธิประมาณการ: ${formatTHB(total)}`,
    `เอกสารมีอายุ 30 วันนับจากวันที่ออกเอกสาร (${formatDate(expiryDate)})`,
    "ขอให้ทีมงานยืนยันแบบและติดต่อกลับเพื่อสรุปหน้างาน",
  ].join("\n");
  const copyLineSummary = async () => {
    await navigator.clipboard?.writeText(lineSummary);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  const updateLine = (sku: string, changes: Partial<QuoteBasinLine>) => setCart((lines) => lines.map((line) => line.sku === sku ? { ...line, ...changes } : line).filter((line) => line.quantity > 0));
  const removeStone = (color: string) => setStones((current) => removeStoneSelection(current, color));
  const snapshot: QuickQuoteSnapshot = {
    kind: "quick-purchase",
    quoteFormat,
    language: quoteLanguage,
    customer,
    items: formalItems,
    grossSubtotal,
    discountAmount: installationDiscount,
    subtotal,
    vatAmount,
    total,
    vat,
  };
  const focusQuoteRequirement = () => {
    const targetTestId = !cart.length
      ? "link-add-more"
      : hasInvalidEmail
        ? "input-customer-email"
        : hasInvalidTaxId
          ? "input-customer-taxId"
          : hasPastInstallationDate
            ? "input-customer-expectedInstallationDate"
            : hasInvalidStone
              ? "link-edit-stone"
              : "";
    if (!targetTestId) return;
    window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(`[data-testid="${targetTestId}"]`);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.focus();
    }, 0);
  };
  const saveQuote = async (notify = false) => {
    if (!canGenerate) {
      setSubmitted(true);
      focusQuoteRequirement();
      return;
    }
    setSubmitted(true);
    setSaveError("");
    setSaving(true);
    try {
      await onSubmitQuote(snapshot, notify);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "บันทึกใบเสนอราคาไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  };
  const generateQuote = () => {
    void saveQuote();
  };
  const printQuote = () => {
    if (!canGenerate) {
      setSubmitted(true);
      focusQuoteRequirement();
      return;
    }
    setSubmitted(true);
    const previousTitle = document.title;
    const cleanup = () => {
      document.title = previousTitle;
    };
    document.title = savedQuotePrintTitle(quoteNumber, quoteLanguage);
    window.addEventListener("afterprint", cleanup, { once: true });
    void saveQuote();
    window.setTimeout(() => {
      window.print();
      window.setTimeout(cleanup, 1000);
    }, 80);
  };
  const customerFields: Array<{ key: keyof CustomerDetails; label: string; placeholder: string; inputMode?: "numeric" }> = [
    { key: "name", label: "ชื่อผู้ติดต่อ", placeholder: "เช่น คุณนรินทร์" },
    { key: "company", label: "บริษัท / นิติบุคคล", placeholder: "ถ้ามี" },
    { key: "phone", label: "เบอร์โทรศัพท์", placeholder: "0812345678 (ถ้ามี)", inputMode: "numeric" },
    { key: "lineContact", label: "LINE สำหรับติดต่อ", placeholder: "@ไอดี หรือชื่อบัญชี (ถ้ามี)" },
    { key: "email", label: "อีเมล", placeholder: "name@company.com (ถ้ามี)" },
    { key: "project", label: "ชื่อโครงการ", placeholder: "เช่น บ้านพักอาศัยสุขุมวิท" },
    { key: "purchasingDepartment", label: "ฝ่ายจัดซื้อ / บัญชี", placeholder: "ถ้ามี" },
    { key: "taxName", label: "ชื่อสำหรับใบกำกับภาษี", placeholder: "ถ้าต้องการใบกำกับภาษี" },
    { key: "taxId", label: "เลขประจำตัวผู้เสียภาษี", placeholder: "13 หลัก (ถ้ามี)", inputMode: "numeric" },
    { key: "taxBranch", label: "สาขา", placeholder: "สำนักงานใหญ่ / ถ้ามี" },
  ];
  const renderCustomerField = (field: (typeof customerFields)[number]) => (
    <label key={field.key}>
      {field.label}
      <input
        type={field.key === "email" ? "email" : field.key === "phone" ? "tel" : undefined}
        inputMode={field.inputMode}
        value={customer[field.key] ?? ""}
        placeholder={field.placeholder}
        onChange={(event) => setCustomer((current) => ({
          ...current,
          [field.key]: field.key === "taxId"
            ? event.target.value.replace(/\D/g, "").slice(0, 13)
            : field.key === "phone"
              ? event.target.value.replace(/\D/g, "").slice(0, 10)
              : event.target.value,
        }))}
        data-testid={`input-customer-${field.key}`}
        aria-invalid={(field.key === "email" && hasInvalidEmail) || (field.key === "taxId" && hasInvalidTaxId)}
      />
    </label>
  );
  return <div className="page-wrap quote-page">
    <div className="quote-editor">
      <div className="saved-quote-actions quote-notification-actions">
        <button className="button button--accent" onClick={() => void saveQuote(true)} disabled={saving || !canGenerate} data-testid="button-send-quote-notification">{saving ? "กำลังบันทึก..." : "บันทึกและส่งเข้า Telegram"}</button>
        {saveError && <span className="summary-warning" role="alert" data-testid="status-quote-save-error">{saveError}</span>}
      </div>
      <section className="quote-heading"><div><p className="eyebrow accent">QUOTE BUILDER / {quoteNumber}</p><h1>จากรายการ<br /><em>สู่ตัวเลขที่ชัดเจน</em></h1><p className="hero-copy">ตรวจสอบรายการ ปรับรายละเอียด และออกใบเสนอราคาทางการสำหรับโปรเจกต์ของคุณ</p></div><div className="quote-date"><span>วันที่ออกเอกสาร</span><strong>{formatDate(issueDate)}</strong><small>ใช้ได้ถึง {formatDate(expiryDate)} · 30 วัน</small><button onClick={printQuote} data-testid="button-print-quote"><Printer size={15} /> พิมพ์ / PDF ทางการ</button></div></section>
       <section className="quote-format-panel"><div><p className="eyebrow">DOCUMENT FORMAT</p><strong>เลือกรูปแบบใบเสนอราคา</strong><small>US สรุปตามพื้นที่/แผ่น · OF แยกรายห้อง/จุดติดตั้ง</small></div><div className="quote-format-switch"><button className={quoteFormat === "US" ? "is-active" : ""} onClick={() => setQuoteFormat("US")} data-testid="button-quote-format-us"><span>US</span><small>พื้นที่ / แผ่น</small></button><button className={quoteFormat === "OF" ? "is-active" : ""} onClick={() => setQuoteFormat("OF")} data-testid="button-quote-format-of"><span>OF</span><small>รายห้อง / จุด</small></button></div><div className="quote-language-choice"><p className="eyebrow">DOCUMENT LANGUAGE</p><strong>เลือกภาษาสำหรับ PDF / Print</strong><small>ค่าเริ่มต้นเป็นภาษาไทย และบันทึกไปกับใบเสนอราคา</small></div><div className="quote-language-switch quote-language-switch--builder" role="group" aria-label="ภาษาของใบเสนอราคา"><span>PDF / Print</span><button type="button" className={quoteLanguage === "TH" ? "is-active" : ""} onClick={() => setQuoteLanguage("TH")} aria-pressed={quoteLanguage === "TH"} data-testid="button-quote-language-th">TH</button><button type="button" className={quoteLanguage === "EN" ? "is-active" : ""} onClick={() => setQuoteLanguage("EN")} aria-pressed={quoteLanguage === "EN"} data-testid="button-quote-language-en">EN</button></div></section>
      <div className="quote-layout"><section className="quote-main"><div className="quote-block"><div className="block-header"><div><p className="eyebrow">01 / BASINS</p><h2>รายการอ่างล้างหน้า</h2></div><Link href="/" className="text-link" data-testid="link-add-more">เพิ่มรายการ <Plus size={15} /></Link></div>{cart.length ? cart.map((line) => { const product = productBySku(line.sku)!; return <div className="quote-line" key={line.sku} data-testid={`row-quote-${line.sku}`}><BasinVisual tone={product.imageTone} imageUrl={product.imageUrl} alt={`${product.sku} ${product.colorName}`} tall={product.category === "tall vertical washbasin"} /><div className="quote-line-name"><span className="eyebrow">{product.sku} / {product.colorCode}</span><strong>{product.colorName}</strong><small>{product.category === "counter basin" ? "เคาน์เตอร์" : "ทรงสูง"} · {product.dimensions}</small></div><div className="line-quantity"><button onClick={() => updateLine(line.sku, { quantity: line.quantity - 1 })} aria-label={`ลดจำนวน ${line.sku}`} data-testid={`button-quantity-minus-${line.sku}`}><Minus size={13} /></button><span data-testid={`text-quantity-${line.sku}`}>{line.quantity}</span><button onClick={() => updateLine(line.sku, { quantity: line.quantity + 1 })} aria-label={`เพิ่มจำนวน ${line.sku}`} data-testid={`button-quantity-plus-${line.sku}`}><Plus size={13} /></button></div><label className="install-toggle"><input type="checkbox" checked={line.installationSelected} onChange={(event) => updateLine(line.sku, { installationSelected: event.target.checked })} data-testid={`input-installation-${line.sku}`} /><span />ติดตั้ง</label><strong className="line-price">{formatTHB(product.priceTHB * line.quantity)}</strong><button className="icon-button" onClick={() => setCart((lines) => lines.filter((item) => item.sku !== line.sku))} aria-label={`ลบ ${line.sku}`} data-testid={`button-remove-${line.sku}`}><Trash2 size={15} /></button></div>; }) : <div className="quote-empty" data-testid="status-quote-empty"><ShoppingBag size={22} /><p>ยังไม่มีสินค้าในใบเสนอราคา</p><Link href="/" className="text-link" data-testid="link-empty-catalog">เลือกจากแคตตาล็อก <ArrowRight size={15} /></Link></div>}<div className="install-note">ค่าติดตั้งอ่าง <strong>5,000 บาท/ชุด</strong> · ฟรีค่าดำเนินการติดตั้งเมื่อสั่งตั้งแต่ 3 ชุดขึ้นไป</div></div>
           <div className="quote-block"><div className="block-header"><div><p className="eyebrow">02 / STONE</p><h2>หินสังเคราะห์</h2></div><Link href="/stone" className="text-link" data-testid="link-edit-stone">{stoneActive ? "แก้ไขการกำหนดค่า" : "เพิ่มหินสังเคราะห์"} <ArrowRight size={15} /></Link></div>{stoneActive ? stones.map((stone) => <QuoteStoneRow key={stone.color} stone={stone} stoneColors={stoneColors} onRemove={removeStone} />) : <div className="quote-empty quote-empty--compact" data-testid="status-stone-empty"><p>ยังไม่ได้เลือกหินสังเคราะห์</p><Link href="/stone" className="text-link" data-testid="link-empty-stone">เลือกสีและรูปแบบการสั่งซื้อ <ArrowRight size={15} /></Link></div>}</div>
           <div className="quote-block customer-block"><div className="block-header"><div><p className="eyebrow">03 / CUSTOMER</p><h2>ข้อมูลลูกค้าและหน้างาน</h2><p className="customer-intro">กรอกเท่าที่มีได้เลยครับ ข้อมูลลูกค้ายังไม่ครบก็ออกใบเสนอราคาได้ ระบบจะแจ้งเฉพาะค่าที่กรอกแล้วแต่รูปแบบไม่ถูกต้อง</p></div></div><div className="customer-grid"><div className="customer-group-title span-2"><strong>1 / ข้อมูลลูกค้าและที่อยู่ใบเสนอราคา</strong><small>ชื่อและที่อยู่ช่วยให้ทีมขายจัดทำเอกสารได้ตรงใจ แต่ไม่บังคับ</small></div>{customerFields.slice(0, 2).map(renderCustomerField)}<label className="span-2">ที่อยู่สำหรับใบเสนอราคา<textarea value={customer.address ?? ""} onChange={(event) => setCustomer((current) => ({ ...current, address: event.target.value }))} placeholder="บ้านเลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์" data-testid="input-customer-address" /></label><div className="customer-group-title span-2"><strong>2 / ช่องทางติดต่อ</strong><small>กรอกช่องทางที่สะดวกอย่างน้อยหนึ่งช่องทางได้ตามต้องการ</small></div>{customerFields.slice(2, 5).map(renderCustomerField)}<label>ช่องทางติดต่อที่สะดวก<select value={customer.preferredContact} onChange={(event) => setCustomer((current) => ({ ...current, preferredContact: event.target.value as CustomerDetails["preferredContact"] }))} data-testid="input-customer-preferred-contact"><option value="">ยังไม่ระบุ</option>{CUSTOMER_CONTACT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><div className="customer-group-title span-2"><strong>3 / ข้อมูลใบกำกับภาษี (ไม่บังคับ)</strong><small>กรอกเมื่อขอใบกำกับภาษีในนามบริษัทหรือนิติบุคคล</small></div>{customerFields.slice(7, 10).map(renderCustomerField)}<label className="span-2">ที่อยู่สำหรับใบกำกับภาษี<textarea value={customer.taxAddress ?? ""} onChange={(event) => setCustomer((current) => ({ ...current, taxAddress: event.target.value }))} placeholder="กรอกเมื่อใช้ที่อยู่ภาษีต่างจากที่อยู่ใบเสนอราคา" data-testid="input-customer-tax-address" /></label><div className="customer-group-title span-2"><strong>4 / รายละเอียดหน้างาน (ไม่บังคับ)</strong><small>ช่วยให้ทีมงานประเมินงานและนัดหมายได้ตรงจุด</small></div><label>โลเคชันหน้างาน<input value={customer.site ?? ""} onChange={(event) => setCustomer((current) => ({ ...current, site: event.target.value }))} placeholder="เช่น ห้องน้ำชั้น 2" data-testid="input-customer-site" /></label><label>ประเภทสถานที่<select value={customer.propertyType} onChange={(event) => setCustomer((current) => ({ ...current, propertyType: event.target.value as CustomerDetails["propertyType"], condoFloor: event.target.value === "condo" ? current.condoFloor : "" }))} data-testid="input-customer-property-type"><option value="">ยังไม่ระบุ</option>{PROPERTY_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>{customer.propertyType === "condo" && <label>ชั้นคอนโด<input value={customer.condoFloor} onChange={(event) => setCustomer((current) => ({ ...current, condoFloor: event.target.value }))} maxLength={32} data-testid="input-customer-condo-floor" /></label>}<label>วันที่คาดว่าจะติดตั้ง<input type="date" min={today} value={customer.expectedInstallationDate} onChange={(event) => setCustomer((current) => ({ ...current, expectedInstallationDate: event.target.value }))} data-testid="input-customer-installation-date" /></label><label>บทบาทลูกค้า<select value={customer.customerRole} onChange={(event) => setCustomer((current) => ({ ...current, customerRole: event.target.value as CustomerDetails["customerRole"] }))} data-testid="input-customer-role"><option value="">ยังไม่ระบุ</option>{CUSTOMER_ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="span-2">หมายเหตุเพิ่มเติม<textarea value={customer.notes ?? ""} onChange={(event) => setCustomer((current) => ({ ...current, notes: event.target.value }))} placeholder="ถ้ามีรายละเอียดเพิ่มเติมเกี่ยวกับงาน" data-testid="input-customer-notes" /></label></div>{hasInvalidEmail && <p className="summary-warning" role="alert" data-testid="status-quote-email-validation">กรุณากรอกอีเมลให้ถูกต้อง (เช่น name@example.com)</p>}{hasInvalidTaxId && <p className="summary-warning" role="alert" data-testid="status-quote-tax-id-validation">เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก</p>}{hasPastInstallationDate && <p className="summary-warning" role="alert" data-testid="status-quote-installation-date-validation">วันที่เข้าติดตั้งต้องไม่เป็นวันที่ผ่านมา</p>}</div>
         </section><aside className="quote-summary"><p className="eyebrow">04 / TOTAL</p><h2>สรุปใบเสนอราคา</h2><div className="total-rows"><div><span>สินค้าอ่างล้างหน้า <small>{basinSets} ชุด</small></span><strong>{formatTHB(basinSubtotal)}</strong></div><div><span>ค่าติดตั้งอ่าง</span><strong className={installationCharge === 0 ? "free-text" : ""}>{installationCharge === 0 ? "ฟรี" : formatTHB(installationCharge)}</strong></div>{stoneActive && <div><span>หินสังเคราะห์ <small>{stones.length} สี · อ้างอิงราคาจากเอกสาร</small></span><strong>{hasInvalidStone ? "ตรวจสอบรายการ" : formatTHB(totalStone)}</strong></div>}<div className="discount-row"><span>ส่วนลด / สิทธิ์ติดตั้งฟรี</span><strong>{installationDiscount ? `-${formatTHB(installationDiscount)}` : "—"}</strong></div></div><div className="vat-row"><label><input type="checkbox" checked={vat} onChange={(event) => setVat(event.target.checked)} data-testid="input-vat" /><span />คิด VAT 7%</label><strong>{formatTHB(vatAmount)}</strong></div>{missingTaxIdForVat && <p className="summary-warning" role="status" data-testid="status-quote-vat-tax-id">💡 กรุณากรอกเลขประจำตัวผู้เสียภาษี 13 หลักในโปรไฟล์เพื่อให้ออกใบกำกับภาษีได้สมบูรณ์</p>}<div className="grand-total"><span>ยอดรวมทั้งสิ้น</span><strong data-testid="text-grand-total">{formatTHB(total)}</strong><small>{thaiNumberText(total)}</small></div><button className="button button--accent full-width" onClick={generateQuote} data-testid="button-generate-quote">{submitted && canGenerate ? <><Check size={16} /> สร้างใบเสนอราคาแล้ว</> : <>ออกใบเสนอราคาทางการ <ArrowRight size={16} /></>}</button>{hasMissing && <p className="summary-warning" data-testid="status-quote-validation">กรอกชื่อผู้ติดต่อ โทรศัพท์ อีเมล และชื่อโครงการ เพื่อสร้างใบเสนอราคาที่สมบูรณ์</p>}{hasPastInstallationDate && <p className="summary-warning" data-testid="status-quote-installation-date-summary-validation">วันที่เข้าติดตั้งต้องไม่เป็นวันที่ผ่านมา</p>}{hasInvalidStone && <p className="summary-warning" data-testid="status-quote-stone-validation">กลับไปหน้าหินสังเคราะห์และกรอกขนาดอย่างน้อย 10 × 10 ซม. หรือเลือกสีที่มีราคาในเอกสาร ก่อนสร้างใบเสนอราคา</p>}{!cart.length && <p className="summary-warning" data-testid="status-quote-cart-validation">เพิ่มสินค้าอย่างน้อย 1 รายการก่อนออกใบเสนอราคา</p>}{submitted && canGenerate && <div className="success-message" data-testid="status-quote-success"><Check size={16} /> {quoteNumber} พร้อมพิมพ์หรือบันทึกเป็น PDF</div>}<div className="quote-share"><strong>ยืนยันแบบ / ขอให้ทีมงานติดต่อกลับ</strong><p>กดคัดลอกข้อความสำหรับส่งทาง LINE หรือเปิด LINE เพื่อส่งต่อได้ทันที</p><div className="quote-share-actions"><button type="button" className="button button--dark" onClick={copyLineSummary} data-testid="button-copy-line-summary">{copied ? <><Check size={15} /> คัดลอกแล้ว</> : "คัดลอกสรุปส่ง LINE"}</button><a className="button button--outline" href={`https://line.me/R/msg/text/?text=${encodeURIComponent(lineSummary)}`} target="_blank" rel="noreferrer" data-testid="link-send-line-summary">เปิด LINE</a></div></div><div className="quote-terms"><strong>หมายเหตุจากแคตตาล็อก</strong><p>ราคาสินค้าไม่รวม VAT · หินตัดและติดตั้งใช้อัตรารวมติดตั้งแล้ว · งานหินต่ำกว่าพื้นที่ขั้นต่ำอาจมีค่าดำเนินการเพิ่มตามพื้นที่</p></div></aside></div>
    </div>
    {submitted && canGenerate && <FormalQuote format={quoteFormat} quoteNumber={quoteNumber} issueDate={issueDate} expiryDate={expiryDate} customer={customer} items={formalItems} grossSubtotal={grossSubtotal} discountAmount={installationDiscount} subtotal={subtotal} vatAmount={vatAmount} total={total} vat={vat} language={quoteLanguage} />}
    <div className="source-note">ข้อมูลสินค้าจาก Knight Basins Catalogue Part 1–2 · ราคาหินอ้างอิงจากเอกสารราคาขายแผ่นและราคารวมติดตั้งของ Knight Furnich</div>
  </div>;
}

import AdminApp from "./admin/AdminApp";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { useGetCatalog, useGetCustomerProfile, useGetLineAuthStatus, useGetSavedQuote, useNotifySavedQuote, useUpsertLead } from "@workspace/api-client-react";
import { KnightSupport, LineLoginButton } from "@/components/KnightSupport";
import OwnerWorkbench from "./admin/OwnerWorkbench";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function OrderModeTabs({ mode, setMode, onModeChange }: { mode: StudioOrderMode; setMode: Dispatch<SetStateAction<StudioOrderMode>>; onModeChange?: (mode: StudioOrderMode) => void }) {
  return <div className="order-mode-tabs" role="tablist" aria-label="รูปแบบการสั่งซื้อ">
    {([
      ["quick-purchase", "ซื้อด่วนจากแคตตาล็อก", "เลือกสินค้าและเพิ่มลงใบเสนอราคา"],
      ["studio", "ออกแบบใน 2D Studio", "กำหนดขนาดและจัดวางอ่าง"],
      ["sketch", "ส่งแบบร่างด้วยมือ", "แนบภาพให้ทีมขายช่วยดูแบบ"],
    ] as const).map(([value, label, description]) => <button type="button" key={value} role="tab" aria-selected={mode === value} className={mode === value ? "is-active" : ""} onClick={() => { setMode(value); onModeChange?.(value); }} data-testid={`button-order-mode-${value}`}><strong>{label}</strong><small>{description}</small></button>)}
  </div>;
}

function Storefront() {
  const { data: remoteCatalog } = useGetCatalog({
    query: {
      staleTime: 0,
      refetchInterval: 15_000,
      refetchIntervalInBackground: true,
      refetchOnMount: "always",
      refetchOnReconnect: true,
    },
  });
  const { data: lineAuth } = useGetLineAuthStatus();
  const { data: customerProfile } = useGetCustomerProfile({ query: { queryKey: ["customer-profile"], enabled: lineAuth?.authenticated === true, retry: false } });
  const [catalogStoneColors, setCatalogStoneColors] = useState<{
    wholeSheet: ReadonlyArray<StoneColor>;
    installed: ReadonlyArray<StoneColor>;
    all: ReadonlyArray<StoneColor>;
  }>({
    wholeSheet: STONE_COLORS,
    installed: STONE_COLORS,
    all: STONE_COLORS,
  });
  const [cart, setCart] = useStored<QuoteBasinLine[]>("knight-cart", []);
  const [stones, setStones] = useStoredStones("knight-stones", []);
  const [customer, setCustomer] = useStored<CustomerDetails>("knight-customer", emptyCustomer);
  const [vat, setVat] = useStored<boolean>("knight-vat", true);
  const activeBasinProducts = useMemo(() => remoteCatalog?.basins.map(basinProductFromCatalog) ?? PRODUCTS, [remoteCatalog?.basins]);
  const [catalogNotice, setCatalogNotice] = useState("");
  const [orderMode, setOrderMode] = useState<StudioOrderMode>("quick-purchase");
  const [leadKey] = useStored("knight-lead-key", `lead-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const [, setLocation] = useLocation();
  const lastCatalogFingerprint = useRef<string | null>(null);
  const upsertLead = useUpsertLead();
  const notifyQuoteMutation = useNotifySavedQuote();
  const contactDefaults = useMemo(() => ({
    name: customerProfile?.fullName || customerProfile?.displayName || "",
    company: customerProfile?.company || "",
    taxId: customerProfile?.taxId || "",
    taxName: customerProfile?.taxName || "",
    taxBranch: customerProfile?.taxBranch || "",
    taxAddress: customerProfile?.taxAddress || "",
    phone: customerProfile?.phone || "",
    lineContact: customerProfile?.lineContact || "",
    email: customerProfile?.email || "",
    project: customerProfile?.project || "",
    address: customerProfile?.address || "",
    preferredContact: (customerProfile?.preferredContact || "") as CustomerDetails["preferredContact"],
    customerRole: (customerProfile?.customerRole || "") as CustomerDetails["customerRole"],
    propertyType: (customerProfile?.propertyType || "") as CustomerDetails["propertyType"],
    condoFloor: customerProfile?.condoFloor || "",
    expectedInstallationDate: customerProfile?.expectedInstallationDate || "",
  }), [customerProfile?.fullName, customerProfile?.displayName, customerProfile?.company, customerProfile?.taxId, customerProfile?.taxName, customerProfile?.taxBranch, customerProfile?.taxAddress, customerProfile?.phone, customerProfile?.lineContact, customerProfile?.email, customerProfile?.project, customerProfile?.address, customerProfile?.preferredContact, customerProfile?.customerRole, customerProfile?.propertyType, customerProfile?.condoFloor, customerProfile?.expectedInstallationDate]);
  useEffect(() => {
    if (!customerProfile) return;
    setCustomer((current) => ({
      ...current,
      name: contactDefaults.name || current.name,
      company: contactDefaults.company || current.company,
       taxId: contactDefaults.taxId || current.taxId,
       taxName: contactDefaults.taxName || current.taxName,
       taxBranch: contactDefaults.taxBranch || current.taxBranch,
       taxAddress: contactDefaults.taxAddress || current.taxAddress,
      phone: contactDefaults.phone || current.phone,
      lineContact: contactDefaults.lineContact || current.lineContact,
      email: contactDefaults.email || current.email,
      project: contactDefaults.project || current.project,
      address: contactDefaults.address || current.address,
       preferredContact: contactDefaults.preferredContact || current.preferredContact,
       customerRole: contactDefaults.customerRole || current.customerRole,
        propertyType: contactDefaults.propertyType || current.propertyType,
        condoFloor: contactDefaults.condoFloor || current.condoFloor,
        expectedInstallationDate: contactDefaults.expectedInstallationDate || current.expectedInstallationDate,
    }));
  }, [customerProfile?.id, customerProfile?.updatedAt]);
  useEffect(() => {
    if (!remoteCatalog) return;
    const catalogFingerprint = JSON.stringify({
      basins: remoteCatalog.basins.map((basin) => [basin.sku, basin.priceTHB, basin.active, basin.sortOrder]),
      categories: remoteCatalog.categories.map((category) => [category.name, category.active, category.sortOrder]),
      installedStones: remoteCatalog.installedStones.map((stone) => [stone.code, stone.name, stone.pricePerSqmTHB, stone.active, stone.sortOrder]),
      sheetStones: remoteCatalog.sheetStones.map((stone) => [stone.code, stone.name, stone.basePriceTHB, stone.active, stone.sortOrder]),
    });
    const catalogChanged = lastCatalogFingerprint.current !== null && lastCatalogFingerprint.current !== catalogFingerprint;
    lastCatalogFingerprint.current = catalogFingerprint;
    PRODUCTS.splice(0, PRODUCTS.length, ...remoteCatalog.basins.map(basinProductFromCatalog));
    const wholeSheet = stoneColorsForMode(remoteCatalog.installedStones, remoteCatalog.sheetStones, "whole-sheet");
    const installed = stoneColorsForMode(remoteCatalog.installedStones, remoteCatalog.sheetStones, "installed");
    const all = stoneColorsFromCatalog(remoteCatalog.installedStones, remoteCatalog.sheetStones);
    setCatalogStoneColors({ wholeSheet, installed, all });
    STONE_COLORS.splice(0, STONE_COLORS.length, ...all);
    const stoneReconciliation = reconcileStoneSelections(stones, { "whole-sheet": wholeSheet, installed });
    const activeBasinSkus = new Set(remoteCatalog.basins.map((basin) => basin.sku));
    const removedBasinSkus = cart.filter((line) => !activeBasinSkus.has(line.sku)).map((line) => line.sku);
    if (stoneReconciliation.hidden.length) setStones(stoneReconciliation.active);
    if (removedBasinSkus.length) setCart((current) => current.filter((line) => activeBasinSkus.has(line.sku)));
    if (catalogChanged || stoneReconciliation.hidden.length || removedBasinSkus.length) {
      const hiddenStones = stoneReconciliation.hidden.map((stone) => stone.color).join(", ");
      const hiddenBasins = [...new Set(removedBasinSkus)].join(", ");
      const removed = [
        hiddenStones && `หิน ${hiddenStones} ถูกซ่อนและนำออกจากรายการที่กำลังเลือก`,
        hiddenBasins && `อ่าง ${hiddenBasins} ไม่เปิดใช้งานแล้วและนำออกจากใบเสนอราคา`,
      ].filter(Boolean);
      setCatalogNotice(removed.length
        ? `แคตตาล็อกอัปเดตแล้ว · ${removed.join(" · ")} รายการที่ยังเปิดใช้และรายละเอียดที่กำลังแก้ไขยังคงเดิม`
        : "แคตตาล็อกอัปเดตแล้ว · รายการที่เปิดใช้งานล่าสุดพร้อมให้เลือกแล้ว");
    }
  }, [cart, remoteCatalog, stones]);
  const addToQuote = (sku: string) => setCart((current) => current.some((line) => line.sku === sku) ? current.map((line) => line.sku === sku ? { ...line, quantity: line.quantity + 1 } : line) : [...current, { sku, quantity: 1, installationSelected: false }]);
  const syncLead = (status: "new_lead" | "selecting" | "quote_requested", source: string, details: Partial<CustomerDetails> & { productSkus?: string[]; orderMode?: StudioOrderMode; studioData?: unknown } = {}) => {
    return upsertLead.mutateAsync({
      data: {
        leadKey,
        status,
        source,
        productSkus: [...new Set(details.productSkus ?? cart.map((line) => line.sku))],
        name: details.name ?? (customer.name || null),
        company: details.company ?? (customer.company || null),
        phone: details.phone ?? (customer.phone || null),
        lineContact: details.lineContact ?? (customer.lineContact || null),
        email: details.email ?? (customer.email || null),
        project: details.project ?? (customer.project || null),
        address: details.address ?? (customer.address || null),
        site: details.site ?? (customer.site || null),
        purchasingDepartment: details.purchasingDepartment ?? (customer.purchasingDepartment || null),
        notes: details.notes ?? (customer.notes || null),
        taxName: details.taxName ?? (customer.taxName || null),
        taxId: details.taxId ?? (customer.taxId || null),
        taxBranch: details.taxBranch ?? (customer.taxBranch || null),
        taxAddress: details.taxAddress ?? (customer.taxAddress || null),
        preferredContact: details.preferredContact || customer.preferredContact || null,
        customerRole: details.customerRole || customer.customerRole || null,
        propertyType: details.propertyType || customer.propertyType || null,
        condoFloor: details.condoFloor || customer.condoFloor || null,
        expectedInstallationDate: details.expectedInstallationDate || customer.expectedInstallationDate || null,
        orderMode: details.orderMode ?? "quick-purchase",
        studioData: details.studioData ? { ...(details.studioData as Record<string, unknown>) } : null,
      },
    });
  };
  const leadEvent = (status: "new_lead" | "selecting", productSkus: string[] = []) => syncLead(status, "knight_support", { productSkus });
  const requestQuote = (skus: string[]) => {
    skus.forEach(addToQuote);
    leadEvent("selecting", skus);
    setLocation("/quote");
  };
  const submitQuote = async (snapshot: QuickQuoteSnapshot, notify = false) => {
    const lead = await syncLead("quote_requested", "quote_builder", {
      ...snapshot.customer,
      productSkus: cart.map((line) => line.sku),
      orderMode: "quick-purchase",
      studioData: snapshot,
    });
    if (!lead.quoteNumber || !lead.publicQuoteToken) throw new Error("ระบบยังไม่ได้สร้างลิงก์ใบเสนอราคา");
    let notificationMessage = "";
    if (notify) {
      try {
        const result = await notifyQuoteMutation.mutateAsync({ data: { token: lead.publicQuoteToken } });
        notificationMessage = result.message;
      } catch (error) {
        notificationMessage = error instanceof Error ? error.message : "บันทึกแล้ว แต่ส่งแจ้งเตือนไม่สำเร็จ กรุณาลองใหม่";
      }
    }
    const notificationQuery = notificationMessage ? `&notification=${encodeURIComponent(notificationMessage)}` : "";
    setLocation(`/quote/view?token=${encodeURIComponent(lead.publicQuoteToken)}${notificationQuery}`);
  };
  const submitStudio = async ({ state, estimate, contact, notification }: StudioSubmission) => {
    setCustomer((current) => ({ ...current, ...contact }));
    const lead = await syncLead("quote_requested", "studio", { ...contact, productSkus: state.basinSkus, orderMode: "studio", studioData: { state, estimate, notification } });
    if (!lead.quoteNumber || !lead.publicQuoteToken) throw new Error("ระบบยังไม่ได้สร้างลิงก์ใบเสนอราคา");
    setLocation(`/quote/view?token=${encodeURIComponent(lead.publicQuoteToken)}`);
  };
  const initialBasinSkus = useMemo(() => [...new Set(cart.map((line) => line.sku))].slice(0, 2), [cart]);
  const initialStoneColors = useMemo(() => [...new Set(stones.filter((stone) => stone.enabled).map((stone) => stone.color))].slice(0, 3), [stones]);
  const navigateFromStoneMode = (mode: StudioOrderMode) => {
    if (mode === "studio") setLocation("/studio");
    else setLocation("/");
  };
  return <Layout cart={cart} setCart={setCart} stones={stones} setStones={setStones} stoneColors={catalogStoneColors.all} catalogNotice={catalogNotice} onDismissCatalogNotice={() => setCatalogNotice("")} onAddToQuote={addToQuote} onRequestQuote={requestQuote} onLeadEvent={leadEvent}><Switch><Route path="/"><OrderModeTabs mode={orderMode} setMode={setOrderMode} />{orderMode === "quick-purchase" ? <HomePage cart={cart} setCart={setCart} categories={remoteCatalog?.categories} products={activeBasinProducts} /> : <StudioPage mode={orderMode} leadKey={leadKey} onSubmitStudio={submitStudio} contactDefaults={contactDefaults} initialBasinSkus={initialBasinSkus} initialStoneColors={initialStoneColors} stoneColors={catalogStoneColors.installed} sheetPriceColors={catalogStoneColors.all} basinProducts={activeBasinProducts} />}</Route><Route path="/studio"><StudioPage mode="studio" leadKey={leadKey} onSubmitStudio={submitStudio} contactDefaults={contactDefaults} initialBasinSkus={initialBasinSkus} initialStoneColors={initialStoneColors} stoneColors={catalogStoneColors.installed} sheetPriceColors={catalogStoneColors.all} basinProducts={activeBasinProducts} /></Route><Route path="/stone"><OrderModeTabs mode={orderMode} setMode={setOrderMode} onModeChange={navigateFromStoneMode} /><StonePage stones={stones} setStones={setStones} stoneColorsByMode={catalogStoneColors} /></Route><Route path="/quote/view"><SavedQuotePage /></Route><Route path="/quote"><QuotePage cart={cart} setCart={setCart} stones={stones} setStones={setStones} stoneColors={catalogStoneColors.all} customer={customer} setCustomer={setCustomer} vat={vat} setVat={setVat} onSubmitQuote={submitQuote} /></Route><Route path="/profile"><CustomerProfilePage /></Route><Route><div className="empty-state"><span className="empty-number">404</span><h3>ไม่พบหน้านี้</h3><Link href="/" className="text-link" data-testid="link-not-found-home">กลับไปแคตตาล็อก <ArrowRight size={15} /></Link></div></Route></Switch></Layout>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Switch>
        <Route path="/admin" component={AdminApp} />
        <Route path="/admin/*" component={AdminApp} />
        <Route path="/" component={RootEntry} />
        <Route component={Storefront} />
      </Switch>
      <Toaster />
    </QueryClientProvider>
  );
}

function RootEntry() {
  return new URLSearchParams(window.location.search).get("workbench") === "1" ? <OwnerWorkbench /> : <Storefront />;
}

export default App;
