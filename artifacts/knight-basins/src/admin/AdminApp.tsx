import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { Switch, Route, useLocation } from "wouter";
import { useGetAdminSession, useCreateAdminSession, useDeleteAdminSession } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { LockKeyhole, LogOut, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { BasinsManager } from "./BasinsManager";
import { InstalledStonesManager } from "./InstalledStonesManager";
import { SheetStonesManager } from "./SheetStonesManager";
import StockInventoryPage from "./StockInventoryPage";
import { LeadsManager } from "./LeadsManager";
import { TeamManager } from "./TeamManager";
import { AdminDashboard } from "./AdminDashboard";
import { TechnicianCalendarPage } from "./TechnicianCalendarPage";
import { TechnicianTeamsManager } from "./TechnicianTeamsManager";
import { BackupVaultPage } from "./BackupVaultPage";
import { AdminVoiceSettings } from "./AdminVoiceSettings";
import { SitePhotosPage } from "./SitePhotosPage";
import { PortfolioGalleryPage } from "./PortfolioGalleryPage";
import AiCostCenterPage from "./AiCostCenterPage";
import { knightFurnichLogo } from "@/data/assets";

const loginSchema = z.object({
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน"),
});

type AdminPermission = "basins" | "installed-stones" | "sheet-stones" | "leads";
type AdminRole = "owner" | "staff" | "viewer";
type AdminAccess = {
  role: AdminRole;
  permissions: AdminPermission[];
  canEdit: boolean;
  canDelete: boolean;
  canManageTeam: boolean;
};
type AdminSessionPayload = {
  authenticated: boolean;
  access?: AdminAccess;
  member?: { displayName: string };
};

const allAdminPermissions: AdminPermission[] = ["basins", "installed-stones", "sheet-stones", "leads"];
const defaultAdminAccess: AdminAccess = {
  role: "owner",
  permissions: allAdminPermissions,
  canEdit: true,
  canDelete: true,
  canManageTeam: true,
};
const roleLabels: Record<AdminRole, string> = {
  owner: "เจ้าของระบบ",
  staff: "ทีมงาน",
  viewer: "ดูข้อมูล",
};

const NAV_ITEMS = [
  { href: "/admin", label: "หน้าแรก", exact: true, permission: null },
  { href: "/admin/basins", label: "อ่างล้างหน้า", exact: false, permission: "basins" },
  { href: "/admin/installed-stones", label: "หิน (พร้อมติดตั้ง)", exact: false, permission: "installed-stones" },
  { href: "/admin/sheet-stones", label: "หิน (ขายแผ่น)", exact: false, permission: "sheet-stones" },
  { href: "/admin/stock", label: "สต็อกหิน", exact: false, permission: "basins" },
  { href: "/admin/leads", label: "ลูกค้า / Lead", exact: false, permission: "leads" },
  { href: "/admin/ai-cost", label: "ต้นทุน AI", exact: false, permission: "leads" },
  { href: "/admin/calendar", label: "ปฏิทินคิวช่าง", exact: false, permission: "leads" },
  { href: "/admin/technician-teams", label: "ทีมช่างติดตั้ง", exact: false, permission: "leads" },
  { href: "/admin/voice-settings", label: "เสียงผู้ช่วยขาย (น้องไนท์)", exact: false, permission: "leads" },
  { href: "/admin/site-photos", label: "ภาพหน้างาน", exact: false, permission: "leads" },
  { href: "/admin/portfolio", label: "คลังภาพผลงานขาย", exact: false, permission: "leads" },
  { href: "/admin/backup", label: "สำรองข้อมูล", exact: false, permission: null, adminOnly: true },
  { href: "/admin/team", label: "สมาชิกทีม", exact: false, permission: null, team: true },
] as const;

const AdminAccessContext = createContext<AdminAccess>(defaultAdminAccess);

function hasPermission(access: AdminAccess, permission: AdminPermission | null) {
  return permission === null || access.permissions.includes(permission);
}

function canAccessBackupVault(access: AdminAccess) {
  return access.role === "owner" || access.canManageTeam;
}

function canShowNavItem(item: (typeof NAV_ITEMS)[number], access: AdminAccess) {
  return !("adminOnly" in item && item.adminOnly) || canAccessBackupVault(access);
}

function useAdminAccess() {
  return useContext(AdminAccessContext);
}

export default function AdminApp() {
  const { data: session, isLoading } = useGetAdminSession();
  const queryClient = useQueryClient();
  const adminSession = session as AdminSessionPayload | undefined;
  const access = useMemo(
    () => adminSession?.access ?? defaultAdminAccess,
    [adminSession?.access],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--paper)] text-[var(--ink)]">
        <Loader2 className="animate-spin w-6 h-6" />
      </div>
    );
  }

  if (!session?.authenticated) {
    return <AdminLogin />;
  }

  return (
    <AdminAccessContext.Provider value={access}>
      <div className="admin-app min-h-screen bg-[var(--paper)] text-[var(--ink)] flex flex-col">
        <header className="admin-header border-b border-[var(--line)] bg-[rgba(255,255,255,0.92)] backdrop-blur-md sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img className="admin-logo" src={knightFurnichLogo} alt="Knight Furnich" />
            <div>
              <strong className="block text-sm tracking-widest leading-none">KNIGHT ADMIN</strong>
              <small className="block text-[var(--ink-soft)] font-mono text-[12px] tracking-widest mt-1">MANAGEMENT</small>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center border border-[var(--line)] px-2 py-1 text-xs text-[var(--ink-soft)]" data-testid="admin-role">
              {adminSession?.member?.displayName ? `${adminSession.member.displayName} · ` : ""}{roleLabels[access.role]}
            </span>
            <AdminLogout />
          </div>
        </header>
        <div className="flex flex-col md:flex-row flex-1 w-full mx-auto">
           <aside className="admin-sidebar w-full md:w-64 border-b md:border-b-0 md:border-r border-[var(--line)] p-4 md:p-6">
            <MobileNavSelect />
            <nav className="hidden md:flex md:flex-col gap-2">
               {NAV_ITEMS.filter((item) => canShowNavItem(item, access)).map((item) => (
                 <NavButton key={item.href} href={item.href} exact={item.exact} permission={item.permission} team={"team" in item && item.team} adminOnly={"adminOnly" in item && item.adminOnly}>{item.label}</NavButton>
              ))}
            </nav>
          </aside>
          <main className="admin-main flex-1 p-4 md:p-10 overflow-x-hidden">
            <Switch>
              <Route path="/admin/access-denied" component={AccessDeniedRoute} />
              <Route path="/admin" component={AdminDashboardRoute} />
              <Route path="/admin/basins" component={BasinsRoute} />
              <Route path="/admin/installed-stones" component={InstalledStonesRoute} />
              <Route path="/admin/sheet-stones" component={SheetStonesRoute} />
              <Route path="/admin/stock" component={StockInventoryRoute} />
              <Route path="/admin/leads" component={LeadsRoute} />
              <Route path="/admin/ai-cost" component={AiCostCenterRoute} />
              <Route path="/admin/calendar" component={TechnicianCalendarRoute} />
              <Route path="/admin/technician-teams" component={TechnicianTeamsManagerRoute} />
              <Route path="/admin/voice-settings" component={AdminVoiceSettingsRoute} />
              <Route path="/admin/site-photos" component={AdminSitePhotosRoute} />
              <Route path="/admin/portfolio" component={AdminPortfolioRoute} />
              <Route path="/admin/backup" component={AdminBackupRoute} />
              <Route path="/admin/team" component={TeamRoute} />
            </Switch>
          </main>
        </div>
      </div>
    </AdminAccessContext.Provider>
  );
}

function NavButton({ href, children, exact, permission, team, adminOnly }: { href: string, children: ReactNode, exact?: boolean, permission: AdminPermission | null, team?: boolean, adminOnly?: boolean }) {
  const [location, setLocation] = useLocation();
  const access = useAdminAccess();
  const isActive = exact ? location === href : location.startsWith(href);
  const allowed = adminOnly ? canAccessBackupVault(access) : team ? access.canManageTeam : hasPermission(access, permission);
  return (
    <Button
      variant={isActive ? "secondary" : "ghost"} 
      className={`justify-start ${isActive ? "bg-[var(--line)] text-[var(--ink)]" : "text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--line)]/50"} ${!allowed ? "opacity-60" : ""}`}
      onClick={() => setLocation(allowed ? href : "/admin/access-denied")}
      aria-disabled={!allowed}
      title={!allowed ? "คุณไม่มีสิทธิ์เข้าถึงเมนูนี้" : undefined}
       data-testid={`nav-admin-${adminOnly ? "backup" : team ? "team" : permission ?? "home"}`}
    >
      {!allowed && <LockKeyhole className="mr-2 h-3.5 w-3.5" aria-hidden="true" />}
      {children}
    </Button>
  );
}

function MobileNavSelect() {
  const [location, setLocation] = useLocation();
  const access = useAdminAccess();
  const visibleItems = NAV_ITEMS.filter((item) => canShowNavItem(item, access));
  const activeHref = visibleItems.find((item) => item.exact ? location === item.href : location.startsWith(item.href))?.href ?? NAV_ITEMS[0].href;
  return (
    <select
      className="md:hidden w-full mb-4 border border-[var(--line)] bg-transparent px-3 py-2.5 text-sm rounded-none"
      value={activeHref}
      onChange={(event) => {
        const item = visibleItems.find((candidate) => candidate.href === event.target.value);
         const allowed = item ? canShowNavItem(item, access) && (("team" in item && item.team) ? access.canManageTeam : hasPermission(access, item.permission)) : false;
         setLocation(allowed ? event.target.value : "/admin/access-denied");
      }}
      aria-label="เมนูจัดการ"
      data-testid="select-admin-mobile-nav"
    >
       {visibleItems.map((item) => {
         const allowed = canShowNavItem(item, access) && (("team" in item && item.team) ? access.canManageTeam : hasPermission(access, item.permission));
        return <option key={item.href} value={item.href}>{!allowed ? `🔒 ${item.label}` : item.label}</option>;
       })}
    </select>
  );
}

function AdminDashboardRoute() {
  const access = useAdminAccess();
  const [, setLocation] = useLocation();
  const canNavigate = (href: string) => {
    if (href === "/admin/team") return access.canManageTeam;
    if (href === "/admin/backup") return canAccessBackupVault(access);
    const permissionByHref: Record<string, AdminPermission> = {
      "/admin/basins": "basins",
      "/admin/installed-stones": "installed-stones",
      "/admin/sheet-stones": "sheet-stones",
      "/admin/leads": "leads",
      "/admin/calendar": "leads",
    };
    const permission = permissionByHref[href];
    return permission ? hasPermission(access, permission) : false;
  };
  const onNavigate = (href: string) => {
    setLocation(canNavigate(href) ? href : "/admin/access-denied");
  };
  return <AdminDashboard canNavigate={canNavigate} onNavigate={onNavigate} />;
}

function AdminPermissionGate({ permission, resource, children }: { permission: AdminPermission; resource: string; children: ReactNode }) {
  const access = useAdminAccess();
  return hasPermission(access, permission) ? <>{children}</> : <AccessDeniedPage resource={resource} />;
}

function AccessDeniedPage({ resource = "หน้านี้" }: { resource?: string }) {
  const [, setLocation] = useLocation();
  return (
    <div className="flex min-h-[360px] items-center justify-center">
      <div className="w-full max-w-lg border border-[var(--line)] bg-[var(--card-paper)] p-8 text-center" data-testid="admin-access-denied">
        <LockKeyhole className="mx-auto h-8 w-8 text-[var(--saffron)]" aria-hidden="true" />
        <p className="mt-4 text-xs uppercase tracking-widest text-[var(--ink-soft)]">ACCESS RESTRICTED</p>
        <h1 className="mt-2 font-semibold">ไม่มีสิทธิ์เข้าถึงเมนูนี้</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--ink-soft)]">
          บัญชีของคุณยังไม่ได้รับสิทธิ์สำหรับ “{resource}”
          <br />
          กรุณาติดต่อเจ้าของระบบเพื่อขอสิทธิ์เพิ่มเติม
        </p>
        <Button type="button" variant="outline" className="mt-6 rounded-none" onClick={() => setLocation("/admin")}>
          กลับหน้าหลัก
        </Button>
      </div>
    </div>
  );
}

function AccessDeniedRoute() {
  return <AccessDeniedPage />;
}

function BasinsRoute() {
  return <AdminPermissionGate permission="basins" resource="อ่างล้างหน้า"><BasinsManager /></AdminPermissionGate>;
}

function InstalledStonesRoute() {
  return <AdminPermissionGate permission="installed-stones" resource="หิน (พร้อมติดตั้ง)"><InstalledStonesManager /></AdminPermissionGate>;
}

function SheetStonesRoute() {
  return <AdminPermissionGate permission="sheet-stones" resource="หิน (ขายแผ่น)"><SheetStonesManager /></AdminPermissionGate>;
}

function StockInventoryRoute() {
  return <AdminPermissionGate permission="basins" resource="สต็อกหิน"><StockInventoryPage /></AdminPermissionGate>;
}

function LeadsRoute() {
  return <AdminPermissionGate permission="leads" resource="ลูกค้า / Lead"><LeadsManager /></AdminPermissionGate>;
}

function AiCostCenterRoute() {
  return <AdminPermissionGate permission="leads" resource="ต้นทุน AI"><AiCostCenterPage /></AdminPermissionGate>;
}

function TechnicianCalendarRoute() {
  return <AdminPermissionGate permission="leads" resource="ปฏิทินคิวช่าง"><TechnicianCalendarPage /></AdminPermissionGate>;
}

function TechnicianTeamsManagerRoute() {
  return <AdminPermissionGate permission="leads" resource="ทีมช่างติดตั้ง"><TechnicianTeamsManager /></AdminPermissionGate>;
}

function AdminVoiceSettingsRoute() {
  return <AdminPermissionGate permission="leads" resource="เสียงผู้ช่วยขาย (น้องไนท์)"><AdminVoiceSettings /></AdminPermissionGate>;
}

function AdminSitePhotosRoute() {
  return (
    <AdminPermissionGate permission="leads" resource="ภาพหน้างานช่าง">
      <SitePhotosPage />
    </AdminPermissionGate>
  );
}

function AdminPortfolioRoute() {
  return (
    <AdminPermissionGate permission="leads" resource="คลังภาพผลงานขาย">
      <PortfolioGalleryPage />
    </AdminPermissionGate>
  );
}

function AdminBackupRoute() {
  const access = useAdminAccess();
  return canAccessBackupVault(access)
    ? <BackupVaultPage />
    : <AccessDeniedPage resource="สำรองข้อมูล" />;
}

function TeamRoute() {
  const access = useAdminAccess();
  return access.canManageTeam ? <TeamManager /> : <AccessDeniedPage resource="สมาชิกทีม" />;
}

export function AdminLogin() {
  const login = useCreateAdminSession();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  const lineLoginDenied = location.includes("adminLogin=not-approved");
  const inviteInvalid = location.includes("adminLogin=invite-invalid");
  const inviteValue = new URLSearchParams(window.location.search).get("invite") ?? "";
  const currentReturnTo = inviteValue ? `/admin?invite=${encodeURIComponent(inviteValue)}` : "/admin";
  const [inviteCode, setInviteCode] = useState("");

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { password: "" }
  });

  const onSubmit = (values: z.infer<typeof loginSchema>) => {
    login.mutate({ data: { password: values.password } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/session"] });
        setLocation("/admin");
      },
      onError: () => {
        form.setError("password", { message: "รหัสผ่านไม่ถูกต้อง" });
      }
    });
  };

  return (
    <div className="admin-login min-h-screen bg-[var(--paper)] flex flex-col items-center justify-center p-6 text-[var(--ink)]">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <img className="admin-login-logo" src={knightFurnichLogo} alt="Knight Furnich" />
        </div>
        <div className="bg-[var(--card-paper)] border border-[var(--line)] p-8 shadow-sm">
          <div className="text-center mb-6">
            <h1 className="font-semibold font-display tracking-tight">Knight Admin</h1>
            <p className="text-sm text-[var(--ink-soft)] mt-2">กรุณาเข้าสู่ระบบเพื่อจัดการข้อมูล</p>
          </div>
          {lineLoginDenied && (
            <div className="mb-5 border border-[#a24439]/30 bg-[#a24439]/5 p-3 text-sm leading-relaxed text-[#a24439]" role="alert">
              บัญชี LINE นี้ยังไม่ได้รับอนุมัติให้เข้า Admin กรุณาติดต่อเจ้าของระบบ
            </div>
          )}
          {inviteInvalid && (
            <div className="mb-5 border border-[#a24439]/30 bg-[#a24439]/5 p-3 text-sm leading-relaxed text-[#a24439]" role="alert">
              คำเชิญนี้หมดอายุ ถูกใช้ไปแล้ว หรือไม่ถูกต้อง กรุณาขอคำเชิญใหม่จากเจ้าของระบบ
            </div>
          )}
          {inviteValue && !inviteInvalid && (
            <div className="mb-5 border border-[var(--saffron)]/40 bg-[var(--saffron)]/5 p-3 text-sm leading-relaxed text-[var(--ink)]">
              พบคำเชิญเข้าทีมแล้ว กด “เข้าสู่ระบบด้วย LINE” ด้านล่างเพื่อยืนยันตัวตน
            </div>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
               <input type="text" name="username" value="admin" autoComplete="username" readOnly hidden />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider text-[var(--ink-soft)]">รหัสผ่าน</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        autoComplete="current-password"
                        placeholder="••••••••" 
                        className="bg-transparent border-[var(--line)] focus-visible:ring-0 focus-visible:border-[var(--saffron)] rounded-none"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage className="text-[#a24439] text-xs" />
                  </FormItem>
                )}
              />
              <Button 
                type="submit" 
                className="w-full bg-[var(--ink)] text-[var(--paper)] hover:bg-[#3c5056] rounded-none h-11"
                disabled={login.isPending}
              >
                {login.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "เข้าสู่ระบบ"}
              </Button>
            </form>
          </Form>
          <div className="my-5 flex items-center gap-3 text-[12px] uppercase tracking-widest text-[var(--ink-soft)]">
            <span className="h-px flex-1 bg-[var(--line)]" /> หรือ <span className="h-px flex-1 bg-[var(--line)]" />
          </div>
          <a
            href={`/api/auth/line/login?returnTo=${encodeURIComponent(currentReturnTo || "/admin")}`}
            className="flex h-11 w-full items-center justify-center border border-[var(--line)] text-sm text-[var(--ink)] transition-colors hover:bg-[var(--line)]/30"
            data-testid="link-admin-line-login"
          >
            เข้าสู่ระบบด้วย LINE
          </a>
          {!inviteValue && (
            <div className="mt-5 border-t border-[var(--line)] pt-5">
              <p className="text-xs text-[var(--ink-soft)]">มีรหัสเชิญจากเจ้าของระบบ?</p>
              <div className="mt-2 flex gap-2">
                <Input
                  value={inviteCode}
                  onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                  placeholder="เช่น A1B2C3D4E5F6"
                  className="min-w-0 rounded-none border-[var(--line)] bg-transparent font-mono text-xs"
                  data-testid="input-admin-invite-code"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 rounded-none"
                  disabled={inviteCode.trim().length < 8}
                  onClick={() => setLocation(`/admin?invite=${encodeURIComponent(inviteCode.trim())}`)}
                  data-testid="button-use-admin-invite-code"
                >
                  ใช้รหัส
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminLogout() {
  const logout = useDeleteAdminSession();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/session"] });
      }
    });
  };

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={handleLogout}
      className="text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--line)]/50"
      disabled={logout.isPending}
    >
      {logout.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
      ออกจากระบบ
    </Button>
  );
}
