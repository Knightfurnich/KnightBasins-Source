import { Switch, Route, useLocation } from "wouter";
import { useGetAdminSession, useCreateAdminSession, useDeleteAdminSession } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { LogOut, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { BasinsManager } from "./BasinsManager";
import { InstalledStonesManager } from "./InstalledStonesManager";
import { SheetStonesManager } from "./SheetStonesManager";
import { LeadsManager } from "./LeadsManager";
import knightFurnichLogo from "@assets/Knightfurnich-logo_1789302266220.png";

const loginSchema = z.object({
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน"),
});

export default function AdminApp() {
  const { data: session, isLoading } = useGetAdminSession();
  const queryClient = useQueryClient();

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
    <div className="admin-app min-h-screen bg-[var(--paper)] text-[var(--ink)] flex flex-col font-sans">
      <header className="admin-header border-b border-[var(--line)] bg-[rgba(255,255,255,0.92)] backdrop-blur-md sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img className="admin-logo" src={knightFurnichLogo} alt="Knight Furnich" />
          <div>
            <strong className="block text-sm tracking-widest leading-none">KNIGHT ADMIN</strong>
            <small className="block text-[var(--ink-soft)] font-mono text-[8px] tracking-widest mt-1">MANAGEMENT</small>
          </div>
        </div>
        <AdminLogout />
      </header>
      <div className="flex flex-col md:flex-row flex-1 max-w-[1440px] w-full mx-auto">
         <aside className="admin-sidebar w-full md:w-64 border-b md:border-b-0 md:border-r border-[var(--line)] p-4 md:p-6 overflow-x-auto">
          <nav className="flex flex-row md:flex-col gap-2 min-w-max">
            <NavButton href="/admin" exact>หน้าแรก</NavButton>
            <NavButton href="/admin/basins">อ่างล้างหน้า</NavButton>
            <NavButton href="/admin/installed-stones">หิน (พร้อมติดตั้ง)</NavButton>
            <NavButton href="/admin/sheet-stones">หิน (ขายแผ่น)</NavButton>
            <NavButton href="/admin/leads">ลูกค้า / Lead</NavButton>
          </nav>
        </aside>
        <main className="admin-main flex-1 p-4 md:p-10 overflow-x-hidden">
          <Switch>
            <Route path="/admin" component={DashboardHome} />
            <Route path="/admin/basins" component={BasinsManager} />
            <Route path="/admin/installed-stones" component={InstalledStonesManager} />
            <Route path="/admin/sheet-stones" component={SheetStonesManager} />
            <Route path="/admin/leads" component={LeadsManager} />
          </Switch>
        </main>
      </div>
    </div>
  );
}

function NavButton({ href, children, exact }: { href: string, children: React.ReactNode, exact?: boolean }) {
  const [location, setLocation] = useLocation();
  const isActive = exact ? location === href : location.startsWith(href);
  return (
    <Button 
      variant={isActive ? "secondary" : "ghost"} 
      className={`justify-start ${isActive ? "bg-[var(--line)] text-[var(--ink)]" : "text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--line)]/50"}`}
      onClick={() => setLocation(href)}
    >
      {children}
    </Button>
  );
}

function DashboardHome() {
  const [_, setLocation] = useLocation();
  return (
    <div className="admin-dashboard space-y-6">
      <div>
        <p className="eyebrow accent">OVERVIEW</p>
        <h1 className="text-3xl font-semibold font-display tracking-tight">ระบบจัดการข้อมูล</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="admin-dashboard-card p-6 border border-[var(--line)] bg-[var(--card-paper)] hover:bg-[var(--line)]/20 transition-colors cursor-pointer" onClick={() => setLocation("/admin/basins")}>
          <h3 className="font-semibold text-lg mb-2">อ่างล้างหน้า</h3>
          <p className="text-sm text-[var(--ink-soft)]">จัดการสินค้า ราคา และข้อมูลอ่างล้างหน้าทั้งหมด</p>
        </div>
        <div className="admin-dashboard-card p-6 border border-[var(--line)] bg-[var(--card-paper)] hover:bg-[var(--line)]/20 transition-colors cursor-pointer" onClick={() => setLocation("/admin/installed-stones")}>
          <h3 className="font-semibold text-lg mb-2">หินสังเคราะห์ (ติดตั้ง)</h3>
          <p className="text-sm text-[var(--ink-soft)]">จัดการราคาหินสังเคราะห์แบบสั่งตัดและติดตั้ง</p>
        </div>
        <div className="admin-dashboard-card p-6 border border-[var(--line)] bg-[var(--card-paper)] hover:bg-[var(--line)]/20 transition-colors cursor-pointer" onClick={() => setLocation("/admin/sheet-stones")}>
          <h3 className="font-semibold text-lg mb-2">หินสังเคราะห์ (แผ่น)</h3>
          <p className="text-sm text-[var(--ink-soft)]">จัดการราคาหินสังเคราะห์แบบขายเป็นแผ่น</p>
        </div>
      </div>
    </div>
  );
}

export function AdminLogin() {
  const login = useCreateAdminSession();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { password: "" }
  });

  const onSubmit = (values: z.infer<typeof loginSchema>) => {
    login.mutate({ data: { password: values.password } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/session"] });
      },
      onError: () => {
        form.setError("password", { message: "รหัสผ่านไม่ถูกต้อง" });
      }
    });
  };

  return (
    <div className="admin-login min-h-screen bg-[var(--paper)] flex flex-col items-center justify-center p-6 text-[var(--ink)] font-sans">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <img className="admin-login-logo" src={knightFurnichLogo} alt="Knight Furnich" />
        </div>
        <div className="bg-[var(--card-paper)] border border-[var(--line)] p-8 shadow-sm">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-semibold font-display tracking-tight">Knight Admin</h1>
            <p className="text-sm text-[var(--ink-soft)] mt-2">กรุณาเข้าสู่ระบบเพื่อจัดการข้อมูล</p>
          </div>
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
