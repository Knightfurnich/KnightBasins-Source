import { useEffect, useState } from "react";
import { Download, ExternalLink, LogOut, Save } from "lucide-react";
import {
  useDeleteLineSession,
  useGetCustomerProfile,
  useGetCustomerQuotationHistory,
  useGetLineAuthStatus,
  useUpdateCustomerProfile,
  type CustomerProfileInput,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { formatTHB } from "@/data/catalog";
import { formatThaiDateTime, thaiDateInputValue } from "@/data/date-time";
import { isValidEmailAddress } from "@/data/validation";
import { LineLoginButton } from "./KnightSupport";

const emptyProfile: CustomerProfileInput = {
  fullName: "",
  phone: "",
  email: "",
  company: "",
  project: "",
  address: "",
  taxName: "",
  taxId: "",
  taxBranch: "",
  taxAddress: "",
  preferredContact: "line",
  customerRole: "homeowner",
  propertyType: "house-townhome",
  condoFloor: "",
  expectedInstallationDate: "",
};

export function CustomerProfilePage() {
  const auth = useGetLineAuthStatus();
  const authenticated = auth.data?.authenticated === true;
  const profile = useGetCustomerProfile({ query: { queryKey: ["customer-profile"], enabled: authenticated, retry: false } });
  const history = useGetCustomerQuotationHistory({ query: { queryKey: ["customer-quotation-history"], enabled: authenticated, retry: false } });
  const updateProfile = useUpdateCustomerProfile();
  const logout = useDeleteLineSession();
  const [form, setForm] = useState<CustomerProfileInput>(emptyProfile);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const today = thaiDateInputValue(new Date());
  const hasInvalidTaxId = Boolean(form.taxId && !/^[0-9]{13}$/.test(form.taxId));

  useEffect(() => {
    if (!profile.data) return;
    setForm({
      fullName: profile.data.fullName ?? "",
      phone: profile.data.phone ?? "",
      email: profile.data.email ?? "",
      company: profile.data.company ?? "",
      project: profile.data.project ?? "",
      address: profile.data.address ?? "",
      taxName: profile.data.taxName ?? "",
      taxId: profile.data.taxId ?? "",
      taxBranch: profile.data.taxBranch ?? "",
      taxAddress: profile.data.taxAddress ?? "",
      preferredContact: profile.data.preferredContact ?? "line",
      customerRole: profile.data.customerRole ?? "homeowner",
      propertyType: profile.data.propertyType as CustomerProfileInput["propertyType"] ?? "house-townhome",
      condoFloor: profile.data.condoFloor ?? "",
      expectedInstallationDate: profile.data.expectedInstallationDate ?? "",
    });
  }, [profile.data?.updatedAt]);

  const update = (key: keyof CustomerProfileInput, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage("");
    setErrorMessage("");
  };

  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.fullName.trim() || !/^[0-9]{10}$/.test(form.phone)) {
      setErrorMessage("กรุณากรอกชื่อจริงและเบอร์โทรศัพท์ 10 หลัก");
      return;
    }
    if (form.email && !isValidEmailAddress(form.email)) {
      setErrorMessage("กรุณาตรวจสอบรูปแบบอีเมล");
      return;
    }
    if (hasInvalidTaxId) {
      setErrorMessage("");
      return;
    }
    if (form.expectedInstallationDate && form.expectedInstallationDate < today) {
      setErrorMessage("วันที่เข้าติดตั้งต้องไม่เป็นวันที่ผ่านมา");
      return;
    }
    updateProfile.mutate(
         { data: { ...form, fullName: form.fullName.trim(), phone: form.phone.trim(), email: form.email.trim(), company: form.company.trim(), project: form.project.trim(), address: form.address.trim(), taxName: form.taxName.trim(), taxId: form.taxId.trim(), taxBranch: form.taxBranch.trim(), taxAddress: form.taxAddress.trim(), expectedInstallationDate: form.expectedInstallationDate || null } },
      {
        onSuccess: (saved) => {
          setForm({
            fullName: saved.fullName ?? "",
            phone: saved.phone ?? "",
            email: saved.email ?? "",
            company: saved.company ?? "",
            project: saved.project ?? "",
            address: saved.address ?? "",
            taxName: saved.taxName ?? "",
            taxId: saved.taxId ?? "",
            taxBranch: saved.taxBranch ?? "",
            taxAddress: saved.taxAddress ?? "",
            preferredContact: saved.preferredContact ?? "line",
            customerRole: saved.customerRole ?? "homeowner",
            propertyType: saved.propertyType as CustomerProfileInput["propertyType"] ?? "house-townhome",
            condoFloor: saved.condoFloor ?? "",
            expectedInstallationDate: saved.expectedInstallationDate ?? "",
          });
          setMessage("บันทึกโปรไฟล์แล้ว");
          setErrorMessage("");
        },
        onError: (saveError) => setErrorMessage(saveError instanceof Error ? saveError.message : "บันทึกโปรไฟล์ไม่สำเร็จ"),
      },
    );
  };

  const signOut = () => {
    logout.mutate(undefined, { onSuccess: () => { window.location.assign("/"); } });
  };

  if (!authenticated) {
    return <section className="page-wrap profile-page profile-page--locked"><div className="profile-lock-card"><p className="eyebrow">CUSTOMER PROFILE</p><h1>โปรไฟล์ของฉัน</h1><p>เข้าสู่ระบบด้วย LINE เพื่อดูข้อมูลส่วนตัวและประวัติใบเสนอราคา</p><LineLoginButton /></div></section>;
  }

  if (profile.isLoading) {
    return <section className="page-wrap empty-state" data-testid="status-profile-loading"><span className="empty-number">…</span><h3>กำลังโหลดโปรไฟล์</h3></section>;
  }

  return <section className="page-wrap profile-page">
    <div className="profile-heading">
      <div>
        <p className="eyebrow">MY KNIGHT FURNICH</p>
        <h1>โปรไฟล์ของฉัน</h1>
        <p>ข้อมูลนี้จะถูกใช้เติมใน Studio 2D และใบเสนอราคาอัตโนมัติ</p>
      </div>
      <button type="button" className="button button--outline profile-logout" onClick={signOut} disabled={logout.isPending}><LogOut size={15} /> ออกจากระบบ</button>
    </div>

    <div className="profile-layout">
      <form className="profile-card profile-form" onSubmit={save} data-testid="form-customer-profile">
        <div className="profile-card-heading">
          {profile.data?.pictureUrl ? <img src={profile.data.pictureUrl} alt="" className="profile-avatar" /> : <div className="profile-avatar profile-avatar--fallback">LINE</div>}
          <div><span className="profile-label">LINE DISPLAY NAME</span><strong>{profile.data?.displayName}</strong><small>เชื่อมต่อด้วย LINE แล้ว</small></div>
        </div>
        <div className="profile-fields">
          <label>ชื่อจริง*<input value={form.fullName} onChange={(event) => update("fullName", event.target.value)} maxLength={160} required data-testid="input-profile-full-name" /></label>
          <label>เบอร์โทรศัพท์ 10 หลัก*<input value={form.phone} onChange={(event) => update("phone", event.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" maxLength={10} required data-testid="input-profile-phone" /></label>
          <label>อีเมล<input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} maxLength={240} data-testid="input-profile-email" /></label>
          <label>บริษัท<input value={form.company} onChange={(event) => update("company", event.target.value)} maxLength={200} data-testid="input-profile-company" /></label>
          <label>โครงการ<input value={form.project} onChange={(event) => update("project", event.target.value)} maxLength={240} data-testid="input-profile-project" /></label>
          <label className="profile-field-wide">ที่อยู่จัดส่ง / ติดตั้งเริ่มต้น<textarea value={form.address} onChange={(event) => update("address", event.target.value)} maxLength={4000} rows={4} data-testid="input-profile-address" /></label>
           <label>ประเภทสถานที่<select value={form.propertyType ?? "house-townhome"} onChange={(event) => setForm((current) => ({ ...current, propertyType: event.target.value as CustomerProfileInput["propertyType"], condoFloor: event.target.value === "condo" ? current.condoFloor : "" }))} data-testid="input-profile-property-type"><option value="house-townhome">บ้านเดี่ยว / ทาวน์โฮม</option><option value="condo">คอนโด</option><option value="commercial">อาคารพาณิชย์</option></select></label>
           {form.propertyType === "condo" && <label>ชั้นคอนโด<input value={form.condoFloor ?? ""} onChange={(event) => update("condoFloor", event.target.value)} maxLength={32} data-testid="input-profile-condo-floor" /></label>}
           <label>วันที่คาดว่าจะติดตั้ง<input type="date" min={today} value={form.expectedInstallationDate ?? ""} onChange={(event) => update("expectedInstallationDate", event.target.value)} data-testid="input-profile-installation-date" /></label>
          <label>ชื่อสำหรับใบกำกับภาษี<input value={form.taxName} onChange={(event) => update("taxName", event.target.value)} maxLength={240} data-testid="input-profile-tax-name" /></label>
           <label>เลขประจำตัวผู้เสียภาษี 13 หลัก<input value={form.taxId} onChange={(event) => update("taxId", event.target.value.replace(/\D/g, "").slice(0, 13))} inputMode="numeric" maxLength={13} aria-invalid={hasInvalidTaxId} data-testid="input-profile-tax-id" />{hasInvalidTaxId && <span className="field-error" role="alert" data-testid="status-profile-tax-id-validation">กรุณากรอกเลขประจำตัวผู้เสียภาษีให้ครบ 13 หลัก</span>}</label>
          <label>สาขา<input value={form.taxBranch} onChange={(event) => update("taxBranch", event.target.value)} maxLength={120} data-testid="input-profile-tax-branch" /></label>
          <label>ช่องทางติดต่อที่สะดวก<select value={form.preferredContact} onChange={(event) => update("preferredContact", event.target.value)} data-testid="input-profile-preferred-contact"><option value="line">LINE</option><option value="phone">โทรศัพท์</option><option value="email">อีเมล</option></select></label>
          <label>บทบาทลูกค้า<select value={form.customerRole} onChange={(event) => update("customerRole", event.target.value)} data-testid="input-profile-customer-role"><option value="homeowner">เจ้าของบ้าน</option><option value="architect-interior">สถาปนิก / อินทีเรีย</option><option value="contractor">ผู้รับเหมา</option></select></label>
          <label className="profile-field-wide">ที่อยู่สำหรับใบกำกับภาษี<textarea value={form.taxAddress} onChange={(event) => update("taxAddress", event.target.value)} maxLength={4000} rows={4} data-testid="input-profile-tax-address" /></label>
        </div>
        {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
        {message && <p className="form-success" role="status">{message}</p>}
        <button type="submit" className="button button--accent" disabled={updateProfile.isPending} data-testid="button-save-profile"><Save size={15} /> {updateProfile.isPending ? "กำลังบันทึก..." : "บันทึกโปรไฟล์"}</button>
      </form>

      <section className="profile-card profile-history" aria-labelledby="profile-history-title">
        <div className="profile-history-heading"><div><span className="profile-label">DOCUMENTS</span><h2 id="profile-history-title">ประวัติใบเสนอราคา</h2></div><span className="profile-history-count">{history.data?.length ?? 0} รายการ</span></div>
        {history.isLoading && <p className="profile-muted">กำลังโหลดประวัติใบเสนอราคา...</p>}
        {!history.isLoading && !history.data?.length && <div className="profile-empty-history"><p>ยังไม่มีใบเสนอราคาที่ผูกกับบัญชีนี้</p><Link href="/quote" className="text-link">เริ่มสร้างใบเสนอราคา <ExternalLink size={14} /></Link></div>}
        {!!history.data?.length && <div className="profile-history-list">{history.data.map((quote) => <article className="profile-quote-row" key={quote.id}>
          <div className="profile-quote-main"><strong>{quote.quoteNumber}</strong><span>{quote.orderMode === "studio" ? "2D Studio" : "ซื้อด่วนจากแคตตาล็อก"} · {formatThaiDateTime(new Date(quote.issuedAt))}</span></div>
          <strong className="profile-quote-total">{quote.amountTHB === null || quote.amountTHB === undefined ? "รอยืนยันราคา" : formatTHB(quote.amountTHB)}</strong>
          <div className="profile-quote-actions"><a href={quote.viewUrl} className="text-link" data-testid={`link-open-quote-${quote.id}`}><ExternalLink size={14} /> เปิดดู</a><a href={`${quote.viewUrl}&print=1`} className="text-link" target="_blank" rel="noreferrer" data-testid={`link-download-quote-${quote.id}`}><Download size={14} /> พิมพ์ / PDF</a></div>
        </article>)}</div>}
      </section>
    </div>
  </section>;
}