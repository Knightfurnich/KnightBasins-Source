import { useState } from "react";
import { 
  useListAdminSheetStones, 
  useCreateAdminSheetStone, 
  useUpdateAdminSheetStone,
  useDeleteAdminSheetStone,
  getGetCatalogQueryKey,
} from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage 
} from "@/components/ui/form";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Edit2, Search, Check, X, Archive, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { SheetStonePrice } from "@workspace/api-client-react";
import { AdminVisibilityFilter, type AdminVisibility } from "./AdminVisibilityFilter";
import {
  createAdminArchiveMutationCallbacks,
  filterAdminItems,
  toggleAdminItemActive,
} from "./adminArchive";
import { ImageUploadField } from "./ImageUploadField";
import { AdminSortableHeader } from "./AdminSortableHeader";
import {
  compareAdminBoolean,
  compareAdminNumber,
  compareAdminText,
  sortAdminItems,
  toggleAdminSort,
  type AdminSortState,
} from "./adminArchive";

const stoneSchema = z.object({
  code: z.string().min(1, "กรุณากรอกรหัสสินค้า"),
  name: z.string().min(1, "กรุณากรอกชื่อสี"),
  basePriceTHB: z.coerce.number().min(0, "ราคาต้องไม่ติดลบ"),
  price10PlusTHB: z.coerce.number().min(0, "ราคาต้องไม่ติดลบ"),
  price50PlusTHB: z.coerce.number().min(0, "ราคาต้องไม่ติดลบ"),
  tone: z.string().min(1, "กรุณากรอกโทนสีภาพ"),
  imageUrl: z.string().max(2000).optional(),
  aliases: z.string(), // We will split by comma on submit
  active: z.boolean(),
  sortOrder: z.coerce.number().int().default(0),
});

export function SheetStonesManager() {
  const { data: stones, isLoading } = useListAdminSheetStones();
  const [search, setSearch] = useState("");
  const [editingItem, setEditingItem] = useState<SheetStonePrice | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState<number | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState<number | null>(null);
  const [visibility, setVisibility] = useState<AdminVisibility>("active");
  const [sort, setSort] = useState<AdminSortState<"code" | "name" | "price" | "active">>(null);
  
  const queryClient = useQueryClient();
  const archiveMutation = useUpdateAdminSheetStone();
  const deleteMutation = useDeleteAdminSheetStone();
  const { toast } = useToast();

  const activeCount = stones?.filter((stone) => stone.active).length ?? 0;
  const archivedCount = stones?.filter((stone) => !stone.active).length ?? 0;
  const filteredStones = filterAdminItems(
    stones,
    visibility,
    search,
    ["code", "name"],
  );
  const sortedStones = sortAdminItems(filteredStones, sort, (left, right, key) => {
    if (key === "code") return compareAdminText(left.code, right.code);
    if (key === "name") return compareAdminText(left.name, right.name);
    if (key === "price") return compareAdminNumber(left.basePriceTHB, right.basePriceTHB);
    return compareAdminBoolean(left.active, right.active);
  });

  const handleArchive = () => {
    const stone = stones?.find((item) => item.id === isArchiveOpen);
    if (stone) {
      archiveMutation.mutate({ id: stone.id, data: {
        code: stone.code, name: stone.name, basePriceTHB: stone.basePriceTHB, price10PlusTHB: stone.price10PlusTHB,
        price50PlusTHB: stone.price50PlusTHB, tone: stone.tone, aliases: stone.aliases, imageUrl: stone.imageUrl || null, active: toggleAdminItemActive(stone).active, sortOrder: stone.sortOrder,
      } }, createAdminArchiveMutationCallbacks({
        invalidate: () => {
          void queryClient.invalidateQueries({ queryKey: ["/api/admin/sheet-stones"] });
          void queryClient.invalidateQueries({ queryKey: getGetCatalogQueryKey() });
        },
        closeDialog: () => setIsArchiveOpen(null),
        toast,
        successMessage: stone.active ? "ซ่อนรายการแล้ว รายการยังเก็บอยู่ใน Archived" : "กู้คืนรายการแล้ว รายการกลับมาแสดงในแคตตาล็อก",
      }));
    }
  };

  const handleDelete = () => {
    const stone = stones?.find((item) => item.id === isDeleteOpen);
    if (!stone) return;
    deleteMutation.mutate({ id: stone.id }, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ["/api/admin/sheet-stones"] });
        void queryClient.invalidateQueries({ queryKey: getGetCatalogQueryKey() });
        setIsDeleteOpen(null);
        toast({ description: `ลบ ${stone.code} ออกจากระบบถาวรแล้ว` });
      },
      onError: () => toast({ description: "ลบสีหินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", variant: "destructive" }),
    });
  };

  return (
    <div className="admin-manager space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <p className="eyebrow accent">03 / SHEET STONES</p>
          <h1 className="workbench-manager-title">จัดการหินสังเคราะห์ (แผ่น)</h1>
        </div>
        <Button 
          onClick={() => setIsCreateOpen(true)}
          className="bg-[var(--ink)] text-[var(--paper)] hover:bg-[#3c5056] rounded-none h-10"
        >
          <Plus className="w-4 h-4 mr-2" />
          เพิ่มรายการใหม่
        </Button>
      </div>

      <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex max-w-sm items-center gap-2">
          <Search className="w-4 h-4 text-[var(--ink-soft)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหารหัสหรือชื่อสี..."
            className="bg-transparent border-none outline-none text-sm w-full"
          />
        </div>
        <AdminVisibilityFilter value={visibility} onChange={setVisibility} activeCount={activeCount} archivedCount={archivedCount} />
      </div>

      {isLoading ? (
        <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--ink-soft)]" /></div>
      ) : (
        <div className="border border-[var(--line)] bg-[var(--card-paper)] overflow-x-auto">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow className="border-[var(--line)] hover:bg-transparent">
                <TableHead className="text-[var(--ink-soft)] font-mono text-xs"><AdminSortableHeader label="รหัสสินค้า" active={sort?.key === "code"} direction={sort?.key === "code" ? sort.direction : undefined} onClick={() => setSort((current) => toggleAdminSort(current, "code"))} /></TableHead>
                <TableHead className="text-[var(--ink-soft)] font-mono text-xs"><AdminSortableHeader label="ชื่อสี" active={sort?.key === "name"} direction={sort?.key === "name" ? sort.direction : undefined} onClick={() => setSort((current) => toggleAdminSort(current, "name"))} /></TableHead>
                <TableHead className="text-[var(--ink-soft)] font-mono text-xs">ภาพ HD</TableHead>
                <TableHead className="text-[var(--ink-soft)] font-mono text-xs text-right"><AdminSortableHeader label="ราคา/แผ่น" align="right" active={sort?.key === "price"} direction={sort?.key === "price" ? sort.direction : undefined} onClick={() => setSort((current) => toggleAdminSort(current, "price"))} /></TableHead>
                <TableHead className="text-[var(--ink-soft)] font-mono text-xs text-center"><AdminSortableHeader label="สถานะ" align="center" active={sort?.key === "active"} direction={sort?.key === "active" ? sort.direction : undefined} onClick={() => setSort((current) => toggleAdminSort(current, "active"))} /></TableHead>
                <TableHead className="text-[var(--ink-soft)] font-mono text-xs text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStones.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-[var(--ink-soft)]">
                    ไม่พบข้อมูล
                  </TableCell>
                </TableRow>
              ) : sortedStones.map(stone => (
                <TableRow key={stone.id} className="border-[var(--line)] hover:bg-[var(--line)]/20 transition-colors">
                  <TableCell className="font-mono text-xs font-medium">{stone.code}</TableCell>
                  <TableCell className="font-medium">
                      {stone.name}
                  </TableCell>
                  <TableCell>
                    {stone.imageUrl ? <a href={stone.imageUrl} target="_blank" rel="noreferrer"><img src={stone.imageUrl} alt="" className="h-8 w-12 rounded object-cover" /></a> : <span className="text-xs text-[var(--ink-soft)]">—</span>}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{stone.basePriceTHB.toLocaleString()}</TableCell>
                  <TableCell className="text-center">
                    {stone.active ? 
                      <span className="inline-flex items-center gap-1 text-[var(--ink)] text-xs"><Check className="w-3 h-3" /> เปิดใช้</span> : 
                      <span className="inline-flex items-center gap-1 text-[var(--ink-soft)] text-xs"><X className="w-3 h-3" /> ปิด</span>
                    }
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-[var(--ink-soft)] hover:text-[var(--ink)]" onClick={() => setEditingItem(stone)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-[var(--ink-soft)] hover:text-[#a24439]" onClick={() => setIsArchiveOpen(stone.id)} title={stone.active ? "ซ่อนรายการ" : "กู้คืนรายการ"}>
                         <Archive className="w-4 h-4" />
                      </Button>
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-[var(--ink-soft)] hover:text-[#a24439]" onClick={() => setIsDeleteOpen(stone.id)} title="ลบถาวร">
                          <Trash2 className="w-4 h-4 mr-1" />ลบ
                        </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {(isCreateOpen || editingItem) && (
        <StoneFormDialog 
          open={true}
          initialData={editingItem || undefined}
          onOpenChange={(open) => {
            if (!open) {
              setIsCreateOpen(false);
              setEditingItem(null);
            }
          }}
        />
      )}

      <Dialog open={!!isArchiveOpen} onOpenChange={(open) => !open && setIsArchiveOpen(null)}>
        <DialogContent className="bg-[var(--card-paper)] border-[var(--line)] rounded-none">
          <DialogHeader>
           <DialogTitle className="font-display font-semibold text-xl">
             {stones?.find((item) => item.id === isArchiveOpen)?.active ? "ซ่อนรายการจากแคตตาล็อก" : "กู้คืนรายการในแคตตาล็อก"}
           </DialogTitle>
          </DialogHeader>
          <div className="py-4">
             {stones?.find((item) => item.id === isArchiveOpen)?.active
               ? "รายการจะถูกเก็บไว้ในระบบและเปลี่ยนเป็น Archived แทนการลบถาวร"
               : "รายการจะกลับมาแสดงในแคตตาล็อก ลูกค้ายังเห็นข้อมูลเดิมและราคาเดิม"}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="rounded-none border-[var(--line)]" onClick={() => setIsArchiveOpen(null)}>ยกเลิก</Button>
             <Button variant={stones?.find((item) => item.id === isArchiveOpen)?.active ? "destructive" : "default"} className="rounded-none bg-[#a24439] hover:bg-[#85342a] text-white" onClick={handleArchive} disabled={archiveMutation.isPending}>
              {archiveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
               {stones?.find((item) => item.id === isArchiveOpen)?.active ? "ซ่อนรายการ" : "กู้คืนรายการ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!isDeleteOpen} onOpenChange={(open) => !open && setIsDeleteOpen(null)}>
        <DialogContent className="bg-[var(--card-paper)] border-[var(--line)] rounded-none">
          <DialogHeader>
            <DialogTitle className="font-display font-semibold text-xl">ลบสีหินออกจากระบบถาวร?</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm leading-relaxed">
            รายการ <strong>{stones?.find((item) => item.id === isDeleteOpen)?.code}</strong> จะถูกลบจากฐานข้อมูลจริงพร้อมข้อมูลราคา และไม่สามารถกู้คืนได้
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="rounded-none border-[var(--line)]" onClick={() => setIsDeleteOpen(null)}>ยกเลิก</Button>
            <Button variant="destructive" className="rounded-none bg-[#a24439] hover:bg-[#85342a] text-white" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              ลบถาวร
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StoneFormDialog({ open, onOpenChange, initialData }: { open: boolean, onOpenChange: (o: boolean) => void, initialData?: SheetStonePrice }) {
  const queryClient = useQueryClient();
  const createMutation = useCreateAdminSheetStone();
  const updateMutation = useUpdateAdminSheetStone();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof stoneSchema>>({
    resolver: zodResolver(stoneSchema),
    defaultValues: initialData ? {
      code: initialData.code,
      name: initialData.name,
      basePriceTHB: initialData.basePriceTHB,
      price10PlusTHB: initialData.price10PlusTHB,
      price50PlusTHB: initialData.price50PlusTHB,
      tone: initialData.tone,
      imageUrl: initialData.imageUrl,
      aliases: initialData.aliases.join(", "),
      active: initialData.active,
      sortOrder: initialData.sortOrder,
    } : {
      code: "",
      name: "",
      basePriceTHB: 0,
      price10PlusTHB: 0,
      price50PlusTHB: 0,
      tone: "#ffffff",
      imageUrl: "",
      aliases: "",
      active: true,
      sortOrder: 0,
    }
  });

  const onSubmit = (values: z.infer<typeof stoneSchema>) => {
    const payload = {
      ...values,
      aliases: values.aliases.split(",").map(s => s.trim()).filter(Boolean),
    };
    
    if (initialData) {
      updateMutation.mutate({ id: initialData.id, data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/admin/sheet-stones"] });
          onOpenChange(false);
          toast({ description: "บันทึกข้อมูลสำเร็จ" });
        },
        onError: () => {
          toast({ description: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง", variant: "destructive" });
        }
      });
    } else {
      createMutation.mutate({ data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/admin/sheet-stones"] });
          onOpenChange(false);
          toast({ description: "เพิ่มข้อมูลสำเร็จ" });
        },
        onError: () => {
          toast({ description: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง", variant: "destructive" });
        }
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-[var(--card-paper)] border-[var(--line)] rounded-none p-0 overflow-hidden max-h-[90dvh] flex flex-col">
        <DialogHeader className="px-6 py-4 border-b border-[var(--line)] bg-[var(--paper)]">
          <DialogTitle className="font-display font-semibold text-xl">
            {initialData ? "แก้ไขหินสังเคราะห์ (แผ่น)" : "เพิ่มหินสังเคราะห์ (แผ่น) ใหม่"}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col overflow-hidden">
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="code" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider text-[var(--ink-soft)]">รหัสสินค้า</FormLabel>
                    <FormControl><Input className="rounded-none border-[var(--line)] bg-[rgba(249,247,241,0.5)] focus-visible:border-[var(--saffron)] font-mono" {...field} /></FormControl>
                    <FormMessage className="text-[#a24439] text-xs" />
                  </FormItem>
                )} />
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider text-[var(--ink-soft)]">ชื่อสี</FormLabel>
                    <FormControl><Input className="rounded-none border-[var(--line)] bg-[rgba(249,247,241,0.5)] focus-visible:border-[var(--saffron)]" {...field} /></FormControl>
                    <FormMessage className="text-[#a24439] text-xs" />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="imageUrl" render={({ field }) => (
                <FormItem>
                  <ImageUploadField label="รูปภาพ HD" value={field.value} onChange={field.onChange} />
                  <FormMessage className="text-[#a24439] text-xs" />
                </FormItem>
              )} />

              <div className="grid grid-cols-1 gap-4">
                <FormField control={form.control} name="basePriceTHB" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider text-[var(--ink-soft)]">ราคา/แผ่น (บาท)</FormLabel>
                    <FormControl><Input type="number" className="rounded-none border-[var(--line)] bg-[rgba(249,247,241,0.5)] focus-visible:border-[var(--saffron)] font-mono" {...field} /></FormControl>
                    <FormMessage className="text-[#a24439] text-xs" />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="price10PlusTHB" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider text-[var(--ink-soft)]">ราคา/แผ่น 10+ (บาท)</FormLabel>
                    <FormControl><Input type="number" className="rounded-none border-[var(--line)] bg-[rgba(249,247,241,0.5)] focus-visible:border-[var(--saffron)] font-mono" {...field} /></FormControl>
                    <FormMessage className="text-[#a24439] text-xs" />
                  </FormItem>
                )} />
                <FormField control={form.control} name="price50PlusTHB" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider text-[var(--ink-soft)]">ราคา/แผ่น 50+ (บาท)</FormLabel>
                    <FormControl><Input type="number" className="rounded-none border-[var(--line)] bg-[rgba(249,247,241,0.5)] focus-visible:border-[var(--saffron)] font-mono" {...field} /></FormControl>
                    <FormMessage className="text-[#a24439] text-xs" />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 gap-4">
                <FormField control={form.control} name="sortOrder" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider text-[var(--ink-soft)]">ลำดับการจัดเรียง</FormLabel>
                    <FormControl><Input type="number" className="rounded-none border-[var(--line)] bg-[rgba(249,247,241,0.5)] focus-visible:border-[var(--saffron)] font-mono" {...field} /></FormControl>
                    <p className="text-xs leading-relaxed text-[var(--ink-soft)]">เลขน้อยจะแสดงก่อน ใช้เรียงรายการในหน้านี้และในแคตตาล็อกหน้าร้าน</p>
                    <FormMessage className="text-[#a24439] text-xs" />
                  </FormItem>
                )} />
              </div>
              
              <FormField control={form.control} name="aliases" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-wider text-[var(--ink-soft)]">นามแฝง (คั่นด้วยลูกน้ำ)</FormLabel>
                  <FormControl><Input placeholder="e.g. WH01, WH01-G" className="rounded-none border-[var(--line)] bg-[rgba(249,247,241,0.5)] focus-visible:border-[var(--saffron)]" {...field} /></FormControl>
                    <p className="text-xs leading-relaxed text-[var(--ink-soft)]">รหัสหรือชื่ออื่นของสินค้านี้ ใช้ช่วยค้นหาและจับคู่กับรหัสในเอกสารราคา</p>
                  <FormMessage className="text-[#a24439] text-xs" />
                </FormItem>
              )} />

              <FormField control={form.control} name="active" render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 border border-[var(--line)] bg-[var(--paper)]">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} className="rounded-sm border-[var(--ink-soft)] data-[state=checked]:bg-[var(--ink)] data-[state=checked]:text-[var(--paper)]" />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="text-sm font-medium">เปิดใช้งานสินค้า</FormLabel>
                    <p className="text-xs text-[var(--ink-soft)]">
                      หากปิดใช้งาน สินค้านี้จะไม่แสดงในเครื่องมือคำนวณราคา
                    </p>
                  </div>
                </FormItem>
              )} />
            </div>

            <DialogFooter className="px-6 py-4 border-t border-[var(--line)] bg-[var(--paper)] gap-2 sm:gap-0">
              <Button type="button" variant="outline" className="rounded-none border-[var(--line)]" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
              <Button type="submit" className="rounded-none bg-[var(--ink)] text-[var(--paper)] hover:bg-[#3c5056]" disabled={isPending}>
                {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                บันทึกข้อมูล
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
