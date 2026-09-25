import { useMemo, useState } from "react";
import { Check, Edit3, Loader2, Plus, Power, Save, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateAdminTechnicianTeam,
  useListAdminTechnicianTeams,
  useUpdateAdminTechnicianTeam,
  type TechnicianTeam,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";

type TeamDraft = {
  code: string;
  name: string;
  shortName: string;
  aliases: string;
  sortOrder: string;
  active: boolean;
};

const emptyDraft: TeamDraft = {
  code: "",
  name: "",
  shortName: "",
  aliases: "",
  sortOrder: "",
  active: true,
};

function draftFromTeam(team: TechnicianTeam): TeamDraft {
  return {
    code: team.code,
    name: team.name,
    shortName: team.shortName,
    aliases: team.aliases.join(", "),
    sortOrder: String(team.sortOrder),
    active: team.active,
  };
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "ไม่สามารถบันทึกข้อมูลทีมได้ กรุณาลองใหม่";
}

function aliasesFromDraft(value: string) {
  return [...new Set(value.split(/[,;\n]/).map((alias) => alias.trim()).filter(Boolean))];
}

function formatCount(value: number) {
  return new Intl.NumberFormat("th-TH").format(value);
}

export function TechnicianTeamsManager() {
  const [includeInactive, setIncludeInactive] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<TeamDraft>(emptyDraft);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const queryClient = useQueryClient();

  const teamsQuery = useListAdminTechnicianTeams(
    includeInactive ? { includeInactive: 1 } : undefined,
  );
  const createTeam = useCreateAdminTechnicianTeam();
  const updateTeam = useUpdateAdminTechnicianTeam();
  const teams = useMemo(
    () => [...(teamsQuery.data ?? [])].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)),
    [teamsQuery.data],
  );
  const isEditing = editingId !== null;
  const isSaving = createTeam.isPending || updateTeam.isPending;
  const invalidateTeams = () => {
    void queryClient.invalidateQueries({ queryKey: ["/api/admin/technician-teams"] });
  };

  const updateDraft = <K extends keyof TeamDraft>(field: K, value: TeamDraft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setFormError("");
    setNotice("");
  };

  const resetForm = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setFormError("");
    setNotice("");
  };

  const beginEdit = (team: TechnicianTeam) => {
    setEditingId(team.id);
    setDraft(draftFromTeam(team));
    setFormError("");
    setNotice("");
    window.requestAnimationFrame(() => document.getElementById("technician-team-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const validateDraft = () => {
    if (!draft.code.trim() || !draft.name.trim() || !draft.shortName.trim()) {
      return "กรุณากรอกรหัส ชื่อทีม และชื่อย่อให้ครบ";
    }
    const sortOrder = Number(draft.sortOrder);
    if (!draft.sortOrder.trim() || !Number.isInteger(sortOrder) || sortOrder < 0) {
      return "ลำดับการแสดงผลต้องเป็นจำนวนเต็มตั้งแต่ศูนย์ขึ้นไป";
    }
    return "";
  };

  const saveTeam = () => {
    const validationError = validateDraft();
    if (validationError) {
      setFormError(validationError);
      setNotice("");
      return;
    }

    const fields = {
      name: draft.name.trim(),
      shortName: draft.shortName.trim(),
      aliases: aliasesFromDraft(draft.aliases),
      sortOrder: Number(draft.sortOrder),
    };

    setFormError("");
    setNotice("");
    if (editingId === null) {
      createTeam.mutate({ data: { code: draft.code.trim(), ...fields } }, {
        onError: (error) => setFormError(errorMessage(error)),
        onSuccess: () => {
          invalidateTeams();
          resetForm();
          setNotice("บันทึกทีมติดตั้งแล้ว");
        },
      });
      return;
    }

    updateTeam.mutate({ id: editingId, data: { ...fields, active: draft.active } }, {
      onError: (error) => setFormError(errorMessage(error)),
      onSuccess: () => {
        invalidateTeams();
        resetForm();
        setNotice("อัปเดตข้อมูลทีมติดตั้งแล้ว");
      },
    });
  };

  const toggleTeamActive = (team: TechnicianTeam) => {
    setNotice("");
    setFormError("");
    updateTeam.mutate({
      id: team.id,
      data: { active: !team.active },
    }, {
      onError: (error) => setFormError(errorMessage(error)),
      onSuccess: () => {
        invalidateTeams();
        setNotice(team.active ? "ปิดใช้งานทีมติดตั้งแล้ว" : "เปิดใช้งานทีมติดตั้งแล้ว");
      },
    });
  };

  return (
    <div className="space-y-8" data-testid="admin-technician-teams">
      <header className="flex flex-col gap-5 border-b border-[var(--line)] pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow accent">INSTALLATION OPERATIONS</p>
          <h1 className="font-display tracking-tight">ทีมติดตั้ง</h1>
          <p className="mt-3 max-w-2xl text-[var(--ink-soft)]">
            จัดระเบียบทีมช่างสำหรับการมอบหมายงานและเตรียมคิวติดตั้งให้พร้อมใช้งาน
          </p>
        </div>
        <Button
          type="button"
          className="rounded-none bg-[var(--ink)] text-[var(--paper)]"
          onClick={() => {
            resetForm();
            window.requestAnimationFrame(() => document.getElementById("technician-team-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }));
          }}
          data-testid="button-add-technician-team"
        >
          <Plus className="mr-2 h-4 w-4" /> เพิ่มทีมติดตั้ง
        </Button>
      </header>

      {notice && (
        <div className="flex items-start gap-3 border border-[var(--success)]/35 bg-[var(--success)]/5 p-4 text-[var(--success)] rounded-none" role="status" data-testid="status-technician-team-success">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{notice}</p>
        </div>
      )}

      <section
        id="technician-team-editor"
        className="border border-[var(--line)] bg-[var(--card-paper)] p-5 rounded-none sm:p-7"
        aria-labelledby="technician-team-editor-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] pb-5">
          <div>
            <p className="eyebrow">TEAM RECORD</p>
            <h2 id="technician-team-editor-title">{isEditing ? "แก้ไขข้อมูลทีม" : "เพิ่มทีมติดตั้ง"}</h2>
            <p className="mt-2 text-[var(--ink-soft)]">
              กำหนดข้อมูลที่จะแสดงในเครื่องมือจัดคิวและการมอบหมายงาน
            </p>
          </div>
          {isEditing && (
            <Button type="button" variant="ghost" className="rounded-none" onClick={resetForm} data-testid="button-cancel-edit-technician-team">
              <X className="mr-2 h-4 w-4" /> ยกเลิก
            </Button>
          )}
        </div>

        <form
          className="mt-6 space-y-6"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            saveTeam();
          }}
        >
          <div className="grid gap-6 md:grid-cols-3">
            <label className="space-y-2">
              <span className="font-semibold">รหัสทีม</span>
              <input
                value={draft.code}
                onChange={(event) => updateDraft("code", event.target.value)}
                readOnly={isEditing}
                className="h-11 w-full rounded-none border border-[var(--line)] bg-transparent px-3 outline-none transition-colors focus:border-[var(--ink)] read-only:cursor-not-allowed read-only:opacity-70"
                data-testid="input-technician-team-code"
                autoComplete="off"
                required
              />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="font-semibold">ชื่อทีม</span>
              <input
                value={draft.name}
                onChange={(event) => updateDraft("name", event.target.value)}
                className="h-11 w-full rounded-none border border-[var(--line)] bg-transparent px-3 outline-none transition-colors focus:border-[var(--ink)]"
                data-testid="input-technician-team-name"
                autoComplete="off"
                required
              />
            </label>
            <label className="space-y-2">
              <span className="font-semibold">ชื่อย่อ</span>
              <input
                value={draft.shortName}
                onChange={(event) => updateDraft("shortName", event.target.value)}
                className="h-11 w-full rounded-none border border-[var(--line)] bg-transparent px-3 outline-none transition-colors focus:border-[var(--ink)]"
                data-testid="input-technician-team-short-name"
                autoComplete="off"
                required
              />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="font-semibold">ชื่อเรียกอื่น</span>
              <input
                value={draft.aliases}
                onChange={(event) => updateDraft("aliases", event.target.value)}
                className="h-11 w-full rounded-none border border-[var(--line)] bg-transparent px-3 outline-none transition-colors focus:border-[var(--ink)]"
                data-testid="input-technician-team-aliases"
                autoComplete="off"
              />
              <span className="block text-[var(--ink-soft)]">คั่นแต่ละชื่อด้วยเครื่องหมายจุลภาค</span>
            </label>
            <label className="space-y-2">
              <span className="font-semibold">ลำดับการแสดงผล</span>
              <input
                type="number"
                min="0"
                step="1"
                value={draft.sortOrder}
                onChange={(event) => updateDraft("sortOrder", event.target.value)}
                className="h-11 w-full rounded-none border border-[var(--line)] bg-transparent px-3 font-mono outline-none transition-colors focus:border-[var(--ink)]"
                data-testid="input-technician-team-sort-order"
                required
              />
            </label>
          </div>

          {isEditing && (
            <label className="flex items-center gap-3 border-t border-[var(--line)] pt-5">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(event) => updateDraft("active", event.target.checked)}
                className="h-4 w-4 rounded-none accent-[var(--ink)]"
                data-testid="checkbox-technician-team-active"
              />
              <span>
                <strong className="block">เปิดใช้งานทีม</strong>
                <span className="text-[var(--ink-soft)]">ทีมที่ปิดใช้งานจะไม่พร้อมสำหรับการมอบหมายงานใหม่</span>
              </span>
            </label>
          )}

          {formError && (
            <div className="border border-[#a24439]/40 bg-[#a24439]/5 p-4 text-[#a24439] rounded-none" role="alert" data-testid="status-technician-team-error">
              <p>{formError}</p>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-[var(--line)] pt-5 sm:flex-row sm:items-center">
            <Button type="submit" className="rounded-none bg-[var(--ink)] text-[var(--paper)]" disabled={isSaving} data-testid="button-save-technician-team">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isEditing ? "บันทึกการเปลี่ยนแปลง" : "เพิ่มทีมติดตั้ง"}
            </Button>
            {!isEditing && <span className="text-[var(--ink-soft)]">ข้อมูลจะถูกส่งไปยังระบบเมื่อกดบันทึก</span>}
          </div>
        </form>
      </section>

      <section aria-labelledby="technician-team-list-title">
        <div className="mb-4 flex flex-col gap-4 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">DISPATCH DIRECTORY</p>
            <h2 id="technician-team-list-title">รายชื่อทีมติดตั้ง</h2>
          </div>
          <label className="flex items-center gap-3 text-[var(--ink-soft)]">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(event) => {
                setIncludeInactive(event.target.checked);
                setFormError("");
                setNotice("");
              }}
              className="h-4 w-4 rounded-none accent-[var(--ink)]"
              data-testid="checkbox-technician-team-include-inactive"
            />
            รวมทีมที่ปิดใช้งาน
          </label>
        </div>

        {teamsQuery.isLoading ? (
          <div className="space-y-2" aria-label="กำลังโหลดรายชื่อทีม" data-testid="status-technician-team-loading">
            {[0, 1, 2].map((item) => (
              <div key={item} className="grid min-h-16 grid-cols-3 items-center gap-4 border border-[var(--line)] bg-[var(--card-paper)] p-4 rounded-none">
                <span className="h-3 w-2/3 animate-pulse bg-[var(--line)]" />
                <span className="h-3 w-1/2 animate-pulse bg-[var(--line)]" />
                <span className="ml-auto h-8 w-24 animate-pulse bg-[var(--line)]" />
              </div>
            ))}
          </div>
        ) : teamsQuery.isError ? (
          <div className="border border-[#a24439]/40 bg-[#a24439]/5 p-6 rounded-none" role="alert" data-testid="status-technician-team-load-error">
            <h3>โหลดรายชื่อทีมไม่สำเร็จ</h3>
            <p className="mt-2 text-[#a24439]">ระบบไม่สามารถดึงข้อมูลทีมติดตั้งได้ในขณะนี้</p>
          </div>
        ) : teams.length === 0 ? (
          <div className="border border-dashed border-[var(--line)] bg-[var(--card-paper)] p-10 text-center rounded-none" data-testid="status-technician-team-empty">
            <div className="mx-auto grid h-12 w-12 place-items-center border border-[var(--line)] text-[var(--ink-soft)] rounded-none">
              <Power className="h-5 w-5" />
            </div>
            <h3 className="mt-5">ยังไม่มีทีมติดตั้ง</h3>
            <p className="mx-auto mt-2 max-w-md text-[var(--ink-soft)]">
              เพิ่มทีมแรกเพื่อให้ฝ่ายปฏิบัติการเริ่มจัดคิวและมอบหมายงานติดตั้งได้
            </p>
            <Button type="button" variant="outline" className="mt-5 rounded-none" onClick={() => document.getElementById("technician-team-editor")?.scrollIntoView({ behavior: "smooth", block: "start" })} data-testid="button-empty-add-technician-team">
              <Plus className="mr-2 h-4 w-4" /> เพิ่มทีมติดตั้ง
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto border border-[var(--line)] rounded-none">
            <table className="w-full min-w-[760px] border-collapse bg-[var(--card-paper)]" data-testid="table-technician-teams">
              <thead>
                <tr className="border-b border-[var(--line)] text-left text-[var(--ink-soft)]">
                  <th className="p-4 font-mono font-medium">ลำดับ</th>
                  <th className="p-4 font-medium">ทีม</th>
                  <th className="p-4 font-medium">ชื่อเรียก</th>
                  <th className="p-4 font-medium">สถานะ</th>
                  <th className="p-4 text-right font-medium">การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team) => (
                  <tr key={team.id} className={`border-b border-[var(--line)] last:border-b-0 ${team.active ? "" : "text-[var(--ink-soft)]"}`} data-testid={`row-technician-team-${team.id}`}>
                    <td className="p-4 font-mono">{team.sortOrder}</td>
                    <td className="p-4">
                      <div className="flex items-start gap-3">
                        <span className="border border-[var(--line)] px-2 py-1 font-mono font-medium text-[var(--ink)] rounded-none">{team.code}</span>
                        <div>
                          <h3>{team.name}</h3>
                          <p className="mt-1 text-[var(--ink-soft)]">{team.shortName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-xs p-4">
                      {team.aliases.length ? team.aliases.join(" · ") : <span className="text-[var(--ink-soft)]">ไม่มีชื่อเรียกอื่น</span>}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-2 border px-2 py-1 rounded-none ${team.active ? "border-[var(--success)]/40 text-[var(--success)]" : "border-[var(--line)] text-[var(--ink-soft)]"}`} data-testid={`status-technician-team-${team.id}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${team.active ? "bg-[var(--success)]" : "bg-[var(--ink-soft)]"}`} />
                        {team.active ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" className="rounded-none" onClick={() => beginEdit(team)} data-testid={`button-edit-technician-team-${team.id}`}>
                          <Edit3 className="mr-2 h-4 w-4" /> แก้ไข
                        </Button>
                        <Button type="button" variant="ghost" className="rounded-none" disabled={isSaving} onClick={() => toggleTeamActive(team)} data-testid={`button-toggle-technician-team-${team.id}`}>
                          <Power className="mr-2 h-4 w-4" /> {team.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-[var(--line)] p-3 text-[var(--ink-soft)]" data-testid="text-technician-team-count">
              แสดง {formatCount(teams.length)} ทีม
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default TechnicianTeamsManager;
