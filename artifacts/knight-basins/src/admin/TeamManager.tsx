import { useMemo, useState } from "react";
import {
  useCreateAdminInvite,
  useCreateAdminMember,
  useListAdminInvites,
  useListAdminMembers,
  useDeleteAdminInvite,
  useDeleteAdminMember,
  useRevokeAdminInvite,
  useUpdateAdminMember,
  useCreateAdminApiKey,
  useListAdminApiKeys,
  useRevokeAdminApiKey,
  type AdminApiKey,
  type AdminApiKeyInput,
  type CreateAdminApiKeyResponse,
  type AdminInvite,
  type AdminInviteInput,
  type AdminInviteInputPermissionsItem,
  type AdminInviteInputRole,
  type AdminMember,
  type AdminMemberInput,
  type AdminMemberPermissionsItem,
  type AdminMemberRole,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Clipboard, Copy, KeyRound, Link2, Loader2, Pencil, Plus, Trash2, UserRound, X } from "lucide-react";
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

const INVITE_ROLE_LABELS: Record<AdminInviteInputRole, string> = ROLE_LABELS;
const INVITE_PERMISSIONS: Array<{ value: AdminInviteInputPermissionsItem; label: string }> = PERMISSIONS;

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

function inviteDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function InvitePanel() {
  const queryClient = useQueryClient();
  const invitesQuery = useListAdminInvites();
  const createInvite = useCreateAdminInvite();
  const deleteInvite = useDeleteAdminInvite();
  const revokeInvite = useRevokeAdminInvite();
  const [role, setRole] = useState<AdminInviteInputRole>("staff");
  const [permissions, setPermissions] = useState<AdminInviteInputPermissionsItem[]>(
    INVITE_PERMISSIONS.map((item) => item.value),
  );
  const [expiresInMinutes, setExpiresInMinutes] = useState(30);
  const [createdInvite, setCreatedInvite] = useState<AdminInvite | null>(null);
  const [copyState, setCopyState] = useState<"code" | "link" | null>(null);
  const [formError, setFormError] = useState("");

  const togglePermission = (permission: AdminInviteInputPermissionsItem, checked: boolean) => {
    setPermissions((current) => checked
      ? [...new Set([...current, permission])]
      : current.filter((value) => value !== permission));
  };

  const createInviteNow = () => {
    setFormError("");
    const data: AdminInviteInput = { role, permissions, expiresInMinutes };
    createInvite.mutate({ data }, {
      onSuccess: (invite) => {
        setCreatedInvite(invite);
        void queryClient.invalidateQueries({ queryKey: ["/api/admin/team/invites"] });
      },
      onError: (error) => setFormError(errorMessage(error)),
    });
  };

  const copyValue = async (value: string, kind: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyState(kind);
      window.setTimeout(() => setCopyState(null), 1800);
    } catch {
      setFormError("คัดลอกไม่สำเร็จ กรุณาเลือกข้อความแล้วคัดลอกด้วยตนเอง");
    }
  };

  const deleteInviteRecord = (id: number) => {
    if (!window.confirm("ลบรายการคำเชิญนี้ถาวรใช่หรือไม่? ลิงก์หรือรหัสนี้จะใช้งานไม่ได้และรายการจะหายจากประวัติ")) return;
    setFormError("");
    deleteInvite.mutate({ id }, {
      onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["/api/admin/team/invites"] }),
      onError: (error) => setFormError(errorMessage(error)),
    });
  };

  const revokeInviteRecord = (id: number) => {
    setFormError("");
    revokeInvite.mutate({ id }, {
      onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["/api/admin/team/invites"] }),
      onError: (error) => setFormError(errorMessage(error)),
    });
  };

  const recentInvites = invitesQuery.data?.slice(0, 5) ?? [];

  return (
    <section className="border border-[var(--line)] bg-[var(--card-paper)] p-5 sm:p-6" data-testid="admin-invite-panel">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center border border-[var(--line)] text-[var(--ink-soft)]">
          <Link2 className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">เชิญสมาชิกด้วยลิงก์</h2>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            สร้างคำเชิญแล้วส่งลิงก์หรือรหัสให้ทีมงาน ทีมงานกดลิงก์และเข้าสู่ระบบด้วย LINE ได้เลย ไม่ต้องกรอก LINE User ID
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-3">
        <label className="space-y-2 text-sm">
          <span className="font-medium">บทบาท</span>
          <select
            value={role}
            onChange={(event) => {
              const nextRole = event.target.value as AdminInviteInputRole;
              setRole(nextRole);
              if (nextRole === "owner") setPermissions(INVITE_PERMISSIONS.map((item) => item.value));
            }}
            className="h-9 w-full border border-[var(--line)] bg-transparent px-3 text-sm"
            data-testid="select-admin-invite-role"
          >
            {Object.entries(INVITE_ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">อายุคำเชิญ</span>
          <select
            value={expiresInMinutes}
            onChange={(event) => setExpiresInMinutes(Number(event.target.value))}
            className="h-9 w-full border border-[var(--line)] bg-transparent px-3 text-sm"
            data-testid="select-admin-invite-expiry"
          >
            <option value={30}>30 นาที</option>
            <option value={60}>1 ชั่วโมง</option>
            <option value={1440}>24 ชั่วโมง</option>
          </select>
        </label>
        <div className="flex items-end">
          <Button type="button" className="h-9 w-full rounded-none bg-[var(--ink)] text-[var(--paper)]" onClick={createInviteNow} disabled={createInvite.isPending} data-testid="button-create-admin-invite">
            {createInvite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
            สร้างคำเชิญ
          </Button>
        </div>
      </div>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium">เมนูที่ให้เข้าถึง</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {INVITE_PERMISSIONS.map((permission) => (
            <label key={permission.value} className="flex items-center gap-3 text-sm text-[var(--ink-soft)]">
              <Checkbox
                checked={role === "owner" || permissions.includes(permission.value)}
                disabled={role === "owner"}
                onCheckedChange={(checked) => togglePermission(permission.value, checked === true)}
              />
              <span>{permission.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {formError && <p className="mt-4 text-sm text-[#a24439]" role="alert">{formError}</p>}

      {createdInvite && (
        <div className="mt-5 border border-[var(--saffron)]/50 bg-[var(--saffron)]/5 p-4" data-testid="admin-invite-created">
          <p className="text-xs font-medium uppercase tracking-widest text-[var(--ink-soft)]">คำเชิญพร้อมใช้งาน</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs text-[var(--ink-soft)]">รหัสสำรองสำหรับส่งให้ทีมงาน</p>
              <p className="mt-1 font-mono text-2xl tracking-[0.18em]" data-testid="admin-invite-code">{createdInvite.code}</p>
            </div>
            <Button type="button" variant="outline" className="rounded-none" onClick={() => void copyValue(createdInvite.code, "code")}>
              {copyState === "code" ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copyState === "code" ? "คัดลอกแล้ว" : "คัดลอกรหัส"}
            </Button>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Input value={createdInvite.inviteUrl} readOnly className="min-w-0 rounded-none border-[var(--line)] bg-transparent text-xs" data-testid="admin-invite-url" />
            <Button type="button" variant="outline" className="rounded-none" onClick={() => void copyValue(createdInvite.inviteUrl, "link")}>
              {copyState === "link" ? <Check className="mr-2 h-4 w-4" /> : <Clipboard className="mr-2 h-4 w-4" />}
              {copyState === "link" ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}
            </Button>
          </div>
          <p className="mt-3 text-xs text-[var(--ink-soft)]">ลิงก์นี้ใช้ได้ครั้งเดียวและหมดอายุ {inviteDate(createdInvite.expiresAt)}</p>
        </div>
      )}

      {invitesQuery.error && <p className="mt-4 text-sm text-[#a24439]">โหลดคำเชิญเดิมไม่สำเร็จ กรุณาตรวจสอบ migration ของฐานข้อมูล</p>}
      {recentInvites.length > 0 && (
        <div className="mt-5 border-t border-[var(--line)] pt-4">
          <p className="text-sm font-medium">คำเชิญล่าสุด</p>
          <div className="mt-3 space-y-2">
            {recentInvites.map((invite) => {
              const used = Boolean(invite.usedAt);
              const expired = !used && new Date(invite.expiresAt).getTime() <= Date.now();
              return (
                <div key={invite.id} className="flex flex-col gap-2 border border-[var(--line)] p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                  <span>{INVITE_ROLE_LABELS[invite.role]} · {used ? "ใช้แล้ว" : expired ? "หมดอายุ" : `หมดอายุ ${inviteDate(invite.expiresAt)}`}</span>
                  <div className="flex flex-wrap gap-1 self-start sm:self-auto">
                    {!used && !expired && (
                      <Button type="button" variant="ghost" size="sm" className="rounded-none text-[#a24439]" disabled={revokeInvite.isPending} onClick={() => revokeInviteRecord(invite.id)}>
                        ยกเลิกคำเชิญ
                      </Button>
                    )}
                    <Button type="button" variant="ghost" size="sm" className="rounded-none text-[#a24439]" disabled={deleteInvite.isPending} onClick={() => deleteInviteRecord(invite.id)} data-testid={`button-delete-admin-invite-${invite.id}`}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> ลบ
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function apiKeyDate(value: string | null) {
  if (!value) return "ไม่หมดอายุ";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function WorkerApiKeyPanel() {
  const queryClient = useQueryClient();
  const keysQuery = useListAdminApiKeys();
  const createKey = useCreateAdminApiKey();
  const revokeKey = useRevokeAdminApiKey();
  const [name, setName] = useState("David LINE archive worker");
  const [expiresInDays, setExpiresInDays] = useState(365);
  const [createdKey, setCreatedKey] = useState<CreateAdminApiKeyResponse | null>(null);
  const [copyState, setCopyState] = useState(false);
  const [formError, setFormError] = useState("");

  const createKeyNow = () => {
    setFormError("");
    const data: AdminApiKeyInput = {
      name: name.trim(),
      ...(expiresInDays > 0 ? { expiresInDays } : {}),
    };
    if (!data.name) {
      setFormError("กรุณาตั้งชื่อ credential");
      return;
    }
    createKey.mutate({ data }, {
      onSuccess: (key) => {
        setCreatedKey(key);
        void queryClient.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
      },
      onError: (error) => setFormError(errorMessage(error)),
    });
  };

  const copyToken = async () => {
    if (!createdKey?.token) return;
    try {
      await navigator.clipboard.writeText(createdKey.token);
      setCopyState(true);
      window.setTimeout(() => setCopyState(false), 1800);
    } catch {
      setFormError("คัดลอกไม่สำเร็จ กรุณาเลือก token แล้วคัดลอกด้วยตนเอง");
    }
  };

  const revokeKeyNow = (key: AdminApiKey) => {
    if (key.revokedAt || !window.confirm(`ยกเลิก credential "${key.name}" ใช่หรือไม่? Worker จะเรียก intake ไม่ได้อีก`)) return;
    setFormError("");
    revokeKey.mutate({ id: key.id }, {
      onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["/api/admin/api-keys"] }),
      onError: (error) => setFormError(errorMessage(error)),
    });
  };

  return (
    <section className="border border-[var(--line)] bg-[var(--card-paper)] p-5 sm:p-6" data-testid="admin-worker-api-key-panel">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center border border-[var(--line)] text-[var(--ink-soft)]">
          <KeyRound className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Credential สำหรับ Worker ของเดวิด</h2>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            คีย์นี้ใช้ได้เฉพาะงาน Lead และ intake สลิป มี scope ตายตัวเป็น <code>leads:edit</code> และยกเลิกได้ทันที
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-[1fr_220px_auto] md:items-end">
        <label className="space-y-2 text-sm">
          <span className="font-medium">ชื่อ credential</span>
          <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} className="rounded-none border-[var(--line)] bg-transparent" data-testid="input-admin-api-key-name" />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium">อายุการใช้งาน</span>
          <select value={expiresInDays} onChange={(event) => setExpiresInDays(Number(event.target.value))} className="h-9 w-full border border-[var(--line)] bg-transparent px-3 text-sm" data-testid="select-admin-api-key-expiry">
            <option value={30}>30 วัน</option>
            <option value={90}>90 วัน</option>
            <option value={365}>1 ปี</option>
            <option value={0}>ไม่หมดอายุ</option>
          </select>
        </label>
        <Button type="button" className="h-9 rounded-none bg-[var(--ink)] text-[var(--paper)]" onClick={createKeyNow} disabled={createKey.isPending} data-testid="button-create-admin-api-key">
          {createKey.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
          สร้างคีย์
        </Button>
      </div>

      {formError && <p className="mt-4 text-sm text-[#a24439]" role="alert">{formError}</p>}

      {createdKey && (
        <div className="mt-5 border border-[#a9791f]/50 bg-[#a9791f]/5 p-4" data-testid="admin-worker-api-key-created">
          <p className="text-xs font-medium uppercase tracking-widest text-[var(--ink-soft)]">คีย์พร้อมใช้งาน · แสดงครั้งเดียว</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input value={createdKey.token} readOnly className="min-w-0 rounded-none border-[var(--line)] bg-transparent font-mono text-xs" data-testid="admin-worker-api-key-token" />
            <Button type="button" variant="outline" className="rounded-none" onClick={() => void copyToken()}>
              {copyState ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copyState ? "คัดลอกแล้ว" : "คัดลอก token"}
            </Button>
          </div>
          <p className="mt-3 text-xs text-[var(--ink-soft)]">เก็บ token นี้ไว้ใน secret store ของ Worker เท่านั้น ระบบจะไม่แสดงค่าเต็มอีกหลังจากปิดหน้านี้</p>
        </div>
      )}

      {keysQuery.error && <p className="mt-4 text-sm text-[#a24439]">โหลด credential ไม่สำเร็จ กรุณาตรวจสอบ migration ของฐานข้อมูล</p>}
      {(keysQuery.data?.length ?? 0) > 0 && (
        <div className="mt-5 border-t border-[var(--line)] pt-4">
          <p className="text-sm font-medium">Credential ที่สร้างไว้</p>
          <div className="mt-3 space-y-2">
            {keysQuery.data?.map((key) => {
              const revoked = Boolean(key.revokedAt);
              const expired = !revoked && Boolean(key.expiresAt && new Date(key.expiresAt).getTime() <= Date.now());
              return (
                <div key={key.id} className="flex flex-col gap-2 border border-[var(--line)] p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <strong>{key.name}</strong>
                    <span className="ml-2 font-mono text-[var(--ink-soft)]">{key.keyPrefix}••••</span>
                    <p className="mt-1 text-[var(--ink-soft)]">scope: leads:edit · {revoked ? "ยกเลิกแล้ว" : expired ? "หมดอายุแล้ว" : `หมดอายุ ${apiKeyDate(key.expiresAt)}`}</p>
                  </div>
                  {!revoked && !expired && (
                    <Button type="button" variant="ghost" size="sm" className="self-start rounded-none text-[#a24439] sm:self-auto" disabled={revokeKey.isPending} onClick={() => revokeKeyNow(key)} data-testid={`button-revoke-admin-api-key-${key.id}`}>
                      ยกเลิกคีย์
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

export function TeamManager() {
  const queryClient = useQueryClient();
  const membersQuery = useListAdminMembers();
  const createMember = useCreateAdminMember();
  const deleteMember = useDeleteAdminMember();
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

  const deleteMemberRecord = (member: AdminMember) => {
    if (!window.confirm(`ลบสมาชิก "${member.displayName}" ออกจากระบบถาวรใช่หรือไม่? สมาชิกนี้จะไม่สามารถเข้าสู่ระบบ Admin ด้วย LINE ได้อีก`)) return;
    setFormError("");
    deleteMember.mutate({ id: member.id }, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ["/api/admin/team"] });
        if (editingId === member.id) resetForm();
      },
      onError: (error) => setFormError(errorMessage(error)),
    });
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

      <InvitePanel />
      <WorkerApiKeyPanel />

      <section className="border border-[var(--line)] bg-[var(--card-paper)] p-5 sm:p-6" aria-labelledby="team-member-form-title">
        <div className="flex items-center justify-between gap-3">
          <h2 id="team-member-form-title" className="text-lg font-semibold">
            {editingId === null ? "เพิ่มสมาชิกทีมด้วย LINE User ID (วิธีสำรอง)" : `แก้ไข ${selectedMember?.displayName ?? "สมาชิกทีม"}`}
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
            {editingId === null && <span className="block text-xs text-[var(--ink-soft)]">ใช้วิธีนี้เฉพาะกรณีที่ไม่ใช้คำเชิญจากด้านบน</span>}
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
          <div className="border border-[#a24439]/40 bg-[#a24439]/5 p-5 text-sm text-[#a24439]">
            <p>โหลดรายชื่อสมาชิกไม่สำเร็จ กรุณาลองใหม่</p>
            <Button type="button" variant="outline" size="sm" className="mt-3 rounded-none" onClick={() => void membersQuery.refetch()} data-testid="button-retry-admin-team">ลองโหลดอีกครั้ง</Button>
          </div>
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
                <div className="flex gap-1 self-start sm:self-center">
                  <Button type="button" variant="outline" size="sm" className="rounded-none" onClick={() => beginEdit(member)} data-testid={`button-edit-admin-member-${member.id}`}>
                    <Pencil className="mr-2 h-3.5 w-3.5" /> แก้ไข
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="rounded-none text-[#a24439]" disabled={deleteMember.isPending} onClick={() => deleteMemberRecord(member)} data-testid={`button-delete-admin-member-${member.id}`}>
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> ลบ
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}