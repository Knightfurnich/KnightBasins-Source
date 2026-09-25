import { useState } from "react";
import { Check, Loader2, Volume2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetAdminSupportVoice, useUpdateAdminSupportVoice } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "ไม่สามารถบันทึกเสียงได้ กรุณาลองใหม่";
}

export function AdminVoiceSettings() {
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const queryClient = useQueryClient();

  const settingsQuery = useGetAdminSupportVoice();
  const updateVoice = useUpdateAdminSupportVoice();
  const current = settingsQuery.data?.current;
  const options = settingsQuery.data?.options ?? [];

  const previewVoice = async (voiceName: string) => {
    if (previewingVoice !== null) return;
    setPreviewingVoice(voiceName);
    setPreviewError("");
    try {
      const response = await fetch("/api/admin/support-voice/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceName }),
      });
      if (!response.ok) throw new Error("เล่นตัวอย่างเสียงไม่สำเร็จ");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      const stop = () => { setPreviewingVoice(null); URL.revokeObjectURL(url); };
      audio.addEventListener("ended", stop, { once: true });
      audio.addEventListener("error", stop, { once: true });
      await audio.play();
    } catch (error) {
      setPreviewError(errorMessage(error));
      setPreviewingVoice(null);
    }
  };

  const saveVoice = (voiceName: string) => {
    if (voiceName === current?.voiceName) return;
    setSaveError("");
    setNotice("");
    updateVoice.mutate({ data: { voiceName } }, {
      onError: (error) => setSaveError(errorMessage(error)),
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ["/api/admin/support-voice"] });
        setNotice("บันทึกเสียงน้องไนท์แล้ว");
      },
    });
  };

  return (
    <div className="space-y-8" data-testid="admin-voice-settings">
      <header className="border-b border-[var(--line)] pb-7">
        <p className="eyebrow accent">KNIGHT SUPPORT</p>
        <h1 className="font-display tracking-tight">เสียงผู้ช่วยขาย (น้องไนท์)</h1>
        <p className="mt-3 max-w-2xl text-[var(--ink-soft)]">
          เลือกโทนเสียงที่น้องไนท์ใช้ตอบลูกค้าในหน้าเว็บ กดฟังตัวอย่างก่อนเลือกได้ทุกโทน
        </p>
      </header>

      {notice && (
        <div className="flex items-start gap-3 border border-[var(--success)]/35 bg-[var(--success)]/5 p-4 text-[var(--success)] rounded-none" role="status" data-testid="status-voice-settings-success">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{notice}</p>
        </div>
      )}

      {(saveError || previewError) && (
        <div className="border border-[#a24439]/40 bg-[#a24439]/5 p-4 text-[#a24439] rounded-none" role="alert" data-testid="status-voice-settings-error">
          <p>{saveError || previewError}</p>
        </div>
      )}

      {settingsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2" aria-label="กำลังโหลดรายการเสียง" data-testid="status-voice-settings-loading">
          {[0, 1, 2, 3, 4].map((item) => (
            <div key={item} className="h-28 animate-pulse border border-[var(--line)] bg-[var(--card-paper)] rounded-none" />
          ))}
        </div>
      ) : settingsQuery.isError ? (
        <div className="border border-[#a24439]/40 bg-[#a24439]/5 p-6 rounded-none" role="alert" data-testid="status-voice-settings-load-error">
          <h3>โหลดรายการเสียงไม่สำเร็จ</h3>
          <p className="mt-2 text-[#a24439]">ระบบไม่สามารถดึงการตั้งค่าเสียงได้ในขณะนี้</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2" data-testid="grid-voice-options">
          {options.map((option) => {
            const isActive = option.voiceName === current?.voiceName;
            const isPreviewing = previewingVoice === option.voiceName;
            return (
              <div
                key={option.voiceName}
                className={`flex flex-col gap-4 border p-5 rounded-none ${isActive ? "border-[var(--ink)] bg-[var(--card-paper)]" : "border-[var(--line)] bg-[var(--card-paper)]"}`}
                data-testid={`card-voice-option-${option.voiceName}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-mono">{option.voiceName}</h3>
                    {isActive && (
                      <span className="inline-flex items-center gap-2 border border-[var(--success)]/40 px-2 py-1 text-[var(--success)] rounded-none" data-testid={`status-voice-active-${option.voiceName}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                        กำลังใช้งาน
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[var(--ink-soft)]">{option.label}</p>
                </div>
                <div className="mt-auto flex flex-wrap gap-2 border-t border-[var(--line)] pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-none"
                    disabled={previewingVoice !== null}
                    onClick={() => void previewVoice(option.voiceName)}
                    data-testid={`button-preview-voice-${option.voiceName}`}
                  >
                    {isPreviewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Volume2 className="mr-2 h-4 w-4" />}
                    ฟังตัวอย่าง
                  </Button>
                  <Button
                    type="button"
                    className="rounded-none bg-[var(--ink)] text-[var(--paper)]"
                    disabled={isActive || updateVoice.isPending}
                    onClick={() => saveVoice(option.voiceName)}
                    data-testid={`button-save-voice-${option.voiceName}`}
                  >
                    {updateVoice.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                    {isActive ? "เสียงที่ใช้งานอยู่" : "บันทึกเสียงนี้เป็นเสียงใช้งาน"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AdminVoiceSettings;
