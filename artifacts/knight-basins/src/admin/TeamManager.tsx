import { useMemo, useState } from "react";
import {
  useCreateAdminMember,
  useListAdminMembers,
  useUpdateAdminMember,
  type AdminMember,
  type AdminMemberInput,
  type AdminMemberPermissionsItem,
  type AdminMemberRole,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Pencil, Plus, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

const PERMISSIONS: Array<{ value: AdminMemberPermissionsItem; label: string }> = [
  { value: "basins", label: "อ่างล้างหน้า" },
  { value: "installed-stones", label: "หินพร้อมติดตั้ง" },
  { value: "sheet-stones", label: "หินขายแผ่น" },
  { value: "leads", label: "ลูกค้า / Lead" },
];

const ROLE_LABELS: Record<AdminMemberRole, string> = {
  owner: "เจ้าของระบบ",
  staff: "ทีมงาน",
  viewer: "ดูข้อมูล",
};

type MemberDraft = {
  lineUserId: string;
  displayName: string;
  pictureUrl: string;
  role: AdminMemberRole;
  permissions: AdminMemberPermissionsItem[];
  active: boolean;
};

const emptyDraft: MemberDraft = {
  lineUserId: "",
  displayName: "",
  pictureUrl: "",
  role: "staff",
  permissions: PERMISSIONS.map((permission) => permission.value),
  active: true,
};

function draftFromMember(member: AdminMember): MemberDraft {
  return {
    lineUserId: member.lineUserId,
    displayName: member.displayName,
    pictureUrl: member.pictureUrl ?? "",
    role: member.role,
    permissions: member.permissions,
    active: member.active,
  };
}

function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
}

export function TeamManager() {
  const queryClient = useQueryClient();
  const membersQuery = useListAdminMembers();
  const createMember = useCreateAdminMember();
  const updateMember = useUpdateAdminMember();
  const [draft, setDraft] = useState<MemberDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formError, setFormError] = useState("");
  const isSaving = createMember.isPending || updateMember.isPending;
  const members = membersQuery.data ?? [];
  const selectedMember = useMemo(
    () => members.find((member) => member.id === editingId),
    [editingId, members],
  );

  const resetForm = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setFormError("");
  };

  const beginEdit = (member: AdminMember) => {
    setEditingId(member.id);
    setDraft(draftFromMember(member));
    setFormError("");
  };

  const setRole = (role: AdminMemberRole) => {
    setDraft((current) => ({
      ...current,
      role,
      permissions: role === "owner"
        ? PERMISSIONS.map((permission) => permission.value)
        : current.permissions,
    }));
  };

  const togglePermission = (permission: AdminMemberPermissionsItem, checked: boolean) => {
    setDraft((current) => ({
      ...current,
      permissions: checked
        ? [...new Set([...current.permissions, permission])]
        : current.permissions.filter((value) => value !== permission),
    }));
  };

  const saveMember = () => {
    setFormError("");
    if (!draft.lineUserId.trim() || !draft.displayName.trim()) {
      setFormError("กรุณากรอก LINE User ID และชื่อสมาชิก");
      return;
    }
    if (editingId !== null) {
      updateMember.mutate({
        id: editingId,
        data: {
          displayName: draft.displayName.trim(),
          pictureUrl: draft.pictureUrl.trim() || null,
          role: draft.role,
          permissions: draft.permissions,
          active: draft.active,
        },
      }, {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: ["/api/admin/team"] });
          resetForm();
        },
        onError: (error) => setFormError(errorMessage(error)),
      });
      return;
    }
    const data: AdminMemberInput = {
      lineUserId: draft.lineUserId.trim(),
      displayName: draft.displayName.trim(),
      pictureUrl: draft.pictureUrl.trim() || null,
      role: draft.role,
      permissions: draft.permissions,
      active: draft.active,
    };
    createMember.mutate({ data }, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ["/api/admin/team"] });
        resetForm();
      },
      onError: (error) => setFormError(errorMessage(error)),
    });
  };

  return (
    <div className="space-y-8" data-testid="admin-team">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow accent">TEAM ACCESS</p>
          <h1 className="text-3xl font-semibold font-display tracking-tight">สมาชิกทีม</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--ink-soft)]">
            อนุมัติบัญชี LINE และกำหนดเมนูที่แต่ละคนใช้งานได้ สิทธิ์จะมีผลทุกครั้งที่เข้าสู่ระบบ
          </p>
        </div>
        <Button type="button" variant="outline" className="rounded-none" onClick={resetForm}>
          <Plus className="mr-2 h-4 w-4" /> เพิ่มสมาชิก
        </Button>
      </div>

      <section className="border border-[var(--line)] bg-[var(--card-paper)] p-5 sm:p-6" aria-labelledby="team-member-form-title">
        <div className="flex items-center justify-between gap-3">
          <h2 id="team-member-form-title" className="text-lg font-semibold">
            {editingId === null ? "เพิ่มสมาชิกทีม" : `แก้ไข ${selectedMember?.displayName ?? "สมาชิกทีม"}`}
          </h2>
          {editingId !== null && (
            <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
              <X className="mr-2 h-4 w-4" /> ยกเลิก
            </Button>
          )}
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium">LINE User ID</span>
            <Input
              value={draft.lineUserId}
              onChange={(event) => setDraft((current) => ({ ...current, lineUserId: event.target.value }))}
              placeholder="เช่น Uxxxxxxxx"
              disabled={editingId !== null}
              className="rounded-none border-[var(--line)] bg-transparent"
              data-testid="input-admin-member-line-id"
            />
            {editingId === null && <span className="block text-xs text-[var(--ink-soft)]">คัดลอกจากบัญชี LINE ที่ต้องการอนุมัติ</span>}
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">ชื่อที่แสดง</span>
            <Input
              value={draft.displayName}
              onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))}
              placeholder="ชื่อสมาชิกทีม"
              className="rounded-none border-[var(--line)] bg-transparent"
              data-testid="input-admin-member-name"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">รูปโปรไฟล์ (ถ้ามี)</span>
            <Input
              value={draft.pictureUrl}
              onChange={(event) => setDraft((current) => ({ ...current, pictureUrl: event.target.value }))}
              placeholder="https://..."
              className="rounded-none border-[var(--line)] bg-transparent"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">บทบาท</span>
            <select
              value={draft.role}
              onChange={(event) => setRole(event.target.value as AdminMemberRole)}
              className="h-9 w-full border border-[var(--line)] bg-transparent px-3 text-sm"
              data-testid="select-admin-member-role"
            >
              {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>

        <fieldset className="mt-5">
          <legend className="text-sm font-medium">เมนูที่เข้าถึงได้</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {PERMISSIONS.map((permission) => (
              <label key={permission.value} className="flex items-center gap-3 text-sm text-[var(--ink-soft)]">
                <Checkbox
                  checked={draft.role === "owner" || draft.permissions.includes(permission.value)}
                  disabled={draft.role === "owner"}
                  onCheckedChange={(checked) => togglePermission(permission.value, checked === true)}
                  data-testid={`checkbox-admin-member-${permission.value}`}
                />
                <span>{permission.label}</span>
              </label>
            ))}
          </div>
          {draft.role === "owner" && <p className="mt-2 text-xs text-[var(--ink-soft)]">เจ้าของระบบจะเข้าถึงทุกเมนูและจัดการสมาชิกทีมได้</p>}
        </fieldset>

        <label className="mt-5 flex items-center gap-3 text-sm text-[var(--ink-soft)]">
          <Checkbox
            checked={draft.active}
            onCheckedChange={(checked) => setDraft((current) => ({ ...current, active: checked === true }))}
            data-testid="checkbox-admin-member-active"
          />
          บัญชีนี้เปิดใช้งานและเข้าสู่ระบบ Admin ได้
        </label>

        {formError && <p className="mt-4 text-sm text-[#a24439]" role="alert">{formError}</p>}
        <Button type="button" className="mt-6 rounded-none bg-[var(--ink)] text-[var(--paper)]" disabled={isSaving} onClick={saveMember} data-testid="button-save-admin-member">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {editingId === null ? "เพิ่มสมาชิก" : "บันทึกการเปลี่ยนแปลง"}
        </Button>
      </section>

      <section aria-labelledby="team-member-list-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="team-member-list-title" className="text-lg font-semibold">สมาชิกในระบบ</h2>
          <span className="text-xs text-[var(--ink-soft)]">{members.length} บัญชี</span>
        </div>
        {membersQuery.isLoading ? (
          <div className="flex min-h-32 items-center justify-center border border-[var(--line)]"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : membersQuery.error ? (
          <div className="border border-[#a24439]/40 bg-[#a24439]/5 p-5 text-sm text-[#a24439]">โหลดรายชื่อสมาชิกไม่สำเร็จ กรุณาลองใหม่</div>
        ) : members.length === 0 ? (
          <div className="border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--ink-soft)]">ยังไม่มีสมาชิก LINE ที่ได้รับอนุมัติ</div>
        ) : (
          <div className="grid gap-3">
            {members.map((member) => (
              <article key={member.id} className={`flex flex-col gap-4 border border-[var(--line)] bg-[var(--card-paper)] p-4 sm:flex-row sm:items-center sm:justify-between ${!member.active ? "opacity-65" : ""}`}>
                <div className="flex min-w-0 items-center gap-3">
                  {member.pictureUrl ? <img src={member.pictureUrl} alt="" className="h-10 w-10 rounded-full object-cover" /> : <div className="grid h-10 w-10 place-items-center rounded-full bg-[var(--line)]"><UserRound className="h-5 w-5 text-[var(--ink-soft)]" /></div>}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-medium">{member.displayName}</h3>
                      <span className="border border-[var(--line)] px-2 py-0.5 text-[10px] text-[var(--ink-soft)]">{ROLE_LABELS[member.role]}</span>
                      {!member.active && <span className="border border-[#a24439]/30 px-2 py-0.5 text-[10px] text-[#a24439]">ปิดใช้งาน</span>}
                    </div>
                    <p className="mt-1 truncate font-mono text-[11px] text-[var(--ink-soft)]">{member.lineUserId}</p>
                    <p className="mt-1 text-xs text-[var(--ink-soft)]">{member.role === "owner" ? "ทุกเมนู" : member.permissions.length ? member.permissions.map((value) => PERMISSIONS.find((item) => item.value === value)?.label).join(" · ") : "ยังไม่ได้เลือกเมนู"}</p>
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" className="rounded-none self-start sm:self-center" onClick={() => beginEdit(member)} data-testid={`button-edit-admin-member-${member.id}`}>
                  <Pencil className="mr-2 h-3.5 w-3.5" /> แก้ไข
                </Button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}