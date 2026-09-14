import { useState, useEffect } from "react";
import { 
  useListAdminBasins, 
  useListAdminBasinCategories,
  useCreateAdminBasin, 
  useUpdateAdminBasin,
  useCreateAdminBasinCategory,
  useUpdateAdminBasinCategory,
  useDeleteAdminBasinCategory,
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
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Edit2, Search, Check, X, Archive, Tags } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { BasinCategory, BasinPrice } from "@workspace/api-client-react";
import { AdminVisibilityFilter, type AdminVisibility } from "./AdminVisibilityFilter";
import {
  createAdminArchiveMutationCallbacks,
  filterAdminItems,
  toggleAdminItemActive,
} from "./adminArchive";
import { ImageUploadField } from "./ImageUploadField";
import { VideoUploadField } from "./VideoUploadField";

const basinSchema = z.object({
  sku: z.string().min(1, "กรุณากรอก SKU"),
  colorCode: z.string().min(1, "กรุณากรอกรหัสสี"),
  colorName: z.string().min(1, "กรุณากรอกชื่อสี"),
  priceTHB: z.coerce.number().min(0, "ราคาต้องไม่ติดลบ"),
  category: z.string().min(1, "กรุณาเลือกหมวดหมู่"),
  categoryId: z.number().int().positive().nullable().optional(),
  dimensions: z.string().min(1, "กรุณากรอกขนาด"),
  basinDimensions: z.string().nullable().optional(),
  imageTone: z.string().min(1, "กรุณากรอกโทนสีภาพ"),
  imageUrl: z.string().max(2000).optional(),
  videoUrl: z.string().max(2000).nullable().optional(),
  active: z.boolean(),
  sortOrder: z.coerce.number().int().default(0),
});

export function BasinsManager() {
  const { data: basins, isLoading } = useListAdminBasins();
  const { data: categories } = useListAdminBasinCategories();
  const [search, setSearch] = useState("");
  const [editingItem, setEditingItem] = useState<BasinPrice | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState<number | null>(null);
  const [visibility, setVisibility] = useState<AdminVisibility>("active");
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  
  const queryClient = useQueryClient();
  const archiveMutation = useUpdateAdminBasin();
  const { toast } = useToast();

  const activeCount = basins?.filter((basin) => basin.active).length ?? 0;
  const archivedCount = basins?.filter((basin) => !basin.active).length ?? 0;
  const filteredBasins = filterAdminItems(
    basins,
    visibility,
    search,
    ["sku", "colorName", "colorCode"],
  );

  const handleArchive = () => {
    const basin = basins?.find((item) => item.id === isArchiveOpen);
    if (basin) {
      archiveMutation.mutate({ id: basin.id, data: {
        sku: basin.sku, colorCode: basin.colorCode, colorName: basin.colorName, priceTHB: basin.priceTHB,
         category: basin.category, categoryId: basin.categoryId ?? null, dimensions: basin.dimensions, basinDimensions: basin.basinDimensions,
         bowlMm: basin.bowlMm, imageTone: basin.imageTone, imageUrl: basin.imageUrl || null, videoUrl: basin.uploadedVideoUrl, active: toggleAdminItemActive(basin).active, sortOrder: basin.sortOrder,
       } }, createAdminArchiveMutationCallbacks({
         invalidate: () => { void queryClient.invalidateQueries({ queryKey: ["/api/admin/basins"] }); },
         closeDialog: () => setIsArchiveOpen(null),
         toast,
         successMessage: basin.active ? "ซ่อนรายการแล้ว รายการยังเก็บอยู่ใน Archived" : "กู้คืนรายการแล้ว รายการกลับมาแสดงในแคตตาล็อก",
       }));
    }
  };

  return (
    <div className="admin-manager space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <p className="eyebrow accent">01 / BASINS</p>
          <h1 className="workbench-manager-title">จัดการอ่างล้างหน้า</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setIsCategoryDialogOpen(true)} className="rounded-none border-[var(--line)] h-10">
            <Tags className="w-4 h-4 mr-2" />จัดการหมวดหมู่
          </Button>
          <Button onClick={() => setIsCreateOpen(true)} className="bg-[var(--ink)] text-[var(--paper)] hover:bg-[#3c5056] rounded-none h-10">
            <Plus className="w-4 h-4 mr-2" />เพิ่มรายการใหม่
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex max-w-sm items-center gap-2">
          <Search className="w-4 h-4 text-[var(--ink-soft)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหา SKU หรือชื่อสี..."
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
                <TableHead className="text-[var(--ink-soft)] font-mono text-xs">SKU</TableHead>
                <TableHead className="text-[var(--ink-soft)] font-mono text-xs">สี</TableHead>
                <TableHead className="text-[var(--ink-soft)] font-mono text-xs">หมวดหมู่</TableHead>
                <TableHead className="text-[var(--ink-soft)] font-mono text-xs">ภาพ HD</TableHead>
                <TableHead className="text-[var(--ink-soft)] font-mono text-xs">สื่อ</TableHead>
                <TableHead className="text-[var(--ink-soft)] font-mono text-xs text-right">ราคา (฿)</TableHead>
                <TableHead className="text-[var(--ink-soft)] font-mono text-xs text-center">สถานะ</TableHead>
                <TableHead className="text-[var(--ink-soft)] font-mono text-xs text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBasins.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-[var(--ink-soft)]">
                    ไม่พบข้อมูล
                  </TableCell>
                </TableRow>
              ) : filteredBasins.map(basin => (
                <TableRow key={basin.id} className="border-[var(--line)] hover:bg-[var(--line)]/20 transition-colors">
                  <TableCell className="font-mono text-xs font-medium">{basin.sku}</TableCell>
                  <TableCell>
                    <div>
                      <span className="block font-medium">{basin.colorName}</span>
                      <span className="text-xs text-[var(--ink-soft)]">{basin.colorCode}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-[var(--ink-soft)]">
                    {categories?.find((category) => category.id === basin.categoryId)?.name ?? basin.category}
                  </TableCell>
                  <TableCell>
                    <a href={basin.imageUrl} target="_blank" rel="noreferrer" className="inline-block">
                      <img src={basin.imageUrl} alt={`ภาพ HD ${basin.sku}`} className="h-10 w-14 rounded object-cover border border-[var(--line)]" />
                    </a>
                  </TableCell>
                  <TableCell>
                    {basin.videoUrl ? <a href={basin.videoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[var(--brand-blue)] hover:underline">เปิดวิดีโอ</a> : <span className="text-xs text-[var(--ink-soft)]">—</span>}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{basin.priceTHB.toLocaleString()}</TableCell>
                  <TableCell className="text-center">
                    {basin.active ? 
                      <span className="inline-flex items-center gap-1 text-[var(--ink)] text-xs"><Check className="w-3 h-3" /> เปิดใช้</span> : 
                      <span className="inline-flex items-center gap-1 text-[var(--ink-soft)] text-xs"><X className="w-3 h-3" /> ปิด</span>
                    }
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-[var(--ink-soft)] hover:text-[var(--ink)]" onClick={() => setEditingItem(basin)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-[var(--ink-soft)] hover:text-[#a24439]" onClick={() => setIsArchiveOpen(basin.id)} title={basin.active ? "ซ่อนรายการ" : "กู้คืนรายการ"}>
                         <Archive className="w-4 h-4" />
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
        <BasinFormDialog 
          open={true}
          initialData={editingItem || undefined}
          categories={categories ?? []}
          onManageCategories={() => {
            setIsCreateOpen(false);
            setEditingItem(null);
            setIsCategoryDialogOpen(true);
          }}
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
             {basins?.find((item) => item.id === isArchiveOpen)?.active ? "ซ่อนรายการจากแคตตาล็อก" : "กู้คืนรายการในแคตตาล็อก"}
           </DialogTitle>
          </DialogHeader>
          <div className="py-4">
             {basins?.find((item) => item.id === isArchiveOpen)?.active
               ? "รายการจะถูกเก็บไว้ในระบบและเปลี่ยนเป็น Archived แทนการลบถาวร"
               : "รายการจะกลับมาแสดงในแคตตาล็อก ลูกค้ายังเห็นข้อมูลเดิมและราคาเดิม"}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="rounded-none border-[var(--line)]" onClick={() => setIsArchiveOpen(null)}>ยกเลิก</Button>
             <Button variant={basins?.find((item) => item.id === isArchiveOpen)?.active ? "destructive" : "default"} className="rounded-none bg-[#a24439] hover:bg-[#85342a] text-white" onClick={handleArchive} disabled={archiveMutation.isPending}>
              {archiveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
               {basins?.find((item) => item.id === isArchiveOpen)?.active ? "ซ่อนรายการ" : "กู้คืนรายการ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BasinCategoryManagerDialog
        open={isCategoryDialogOpen}
        onOpenChange={setIsCategoryDialogOpen}
        categories={categories ?? []}
      />
    </div>
  );
}

function BasinFormDialog({
  open,
  onOpenChange,
  initialData,
  categories,
  onManageCategories,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialData?: BasinPrice;
  categories: BasinCategory[];
  onManageCategories: () => void;
}) {
  const queryClient = useQueryClient();
  const createMutation = useCreateAdminBasin();
  const updateMutation = useUpdateAdminBasin();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof basinSchema>>({
    resolver: zodResolver(basinSchema),
    defaultValues: initialData ? {
      sku: initialData.sku,
      colorCode: initialData.colorCode,
      colorName: initialData.colorName,
      priceTHB: initialData.priceTHB,
      category: initialData.category,
      categoryId: initialData.categoryId ?? null,
      dimensions: initialData.dimensions,
      basinDimensions: initialData.basinDimensions,
      imageTone: initialData.imageTone,
      imageUrl: initialData.imageUrl,
      videoUrl: initialData.uploadedVideoUrl,
      active: initialData.active,
      sortOrder: initialData.sortOrder,
    } : {
      sku: "",
      colorCode: "",
      colorName: "",
      priceTHB: 0,
      category: "counter basin",
      categoryId: null,
      dimensions: "",
      basinDimensions: "",
      imageTone: "#ffffff",
      imageUrl: "",
      videoUrl: null,
      active: true,
      sortOrder: 0,
    }
  });

  const onSubmit = (values: z.infer<typeof basinSchema>) => {
    const selectedCategory = values.categoryId
      ? categories.find((category) => category.id === values.categoryId)
      : undefined;
    const payload = {
      ...values,
      category: selectedCategory?.name ?? values.category,
      basinDimensions: values.basinDimensions || null,
    };
    
    if (initialData) {
      updateMutation.mutate({ id: initialData.id, data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/admin/basins"] });
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
          queryClient.invalidateQueries({ queryKey: ["/api/admin/basins"] });
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
      <DialogContent className="max-w-2xl bg-[var(--card-paper)] border-[var(--line)] rounded-none p-0 overflow-hidden max-h-[90dvh] flex flex-col">
        <DialogHeader className="px-6 py-4 border-b border-[var(--line)] bg-[var(--paper)]">
          <DialogTitle className="font-display font-semibold text-xl">
            {initialData ? "แก้ไขอ่างล้างหน้า" : "เพิ่มอ่างล้างหน้าใหม่"}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col overflow-hidden">
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="sku" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider text-[var(--ink-soft)]">SKU</FormLabel>
                    <FormControl><Input className="rounded-none border-[var(--line)] bg-[rgba(249,247,241,0.5)] focus-visible:border-[var(--saffron)]" {...field} /></FormControl>
                    <FormMessage className="text-[#a24439] text-xs" />
                  </FormItem>
                )} />
                <FormField control={form.control} name="categoryId" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider text-[var(--ink-soft)]">หมวดหมู่</FormLabel>
                    <div className="flex items-start gap-2">
                    <Select value={field.value ? String(field.value) : "uncategorized"} onValueChange={(value) => {
                      const categoryId = value === "uncategorized" ? null : Number(value);
                      field.onChange(categoryId);
                      const category = categories.find((item) => item.id === categoryId);
                      if (category) form.setValue("category", category.name);
                    }}>
                      <FormControl>
                        <SelectTrigger className="rounded-none border-[var(--line)] bg-[rgba(249,247,241,0.5)] focus:ring-0 focus:border-[var(--saffron)]">
                          <SelectValue placeholder="เลือกหมวดหมู่" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="rounded-none border-[var(--line)] bg-[var(--card-paper)]">
                         <SelectItem value="uncategorized">ยังไม่ระบุ</SelectItem>
                         {categories
                           .filter((category) => category.active || category.id === initialData?.categoryId)
                           .map((category) => (
                             <SelectItem key={category.id} value={String(category.id)}>
                               {category.name}{category.active ? "" : " (ซ่อนอยู่)"}
                             </SelectItem>
                           ))}
                      </SelectContent>
                    </Select>
                     <Button type="button" variant="outline" className="shrink-0 rounded-none border-[var(--line)] px-3 text-xs" onClick={onManageCategories}>จัดการ</Button>
                     </div>
                     <p className="text-xs text-[var(--ink-soft)]">หมวดหมู่ที่ซ่อนไว้ยังคงแสดงกับสินค้าที่ใช้อยู่</p>
                    <FormMessage className="text-[#a24439] text-xs" />
                  </FormItem>
                )} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="colorCode" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider text-[var(--ink-soft)]">รหัสสี</FormLabel>
                    <FormControl><Input className="rounded-none border-[var(--line)] bg-[rgba(249,247,241,0.5)] focus-visible:border-[var(--saffron)]" {...field} /></FormControl>
                    <FormMessage className="text-[#a24439] text-xs" />
                  </FormItem>
                )} />
                <FormField control={form.control} name="colorName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider text-[var(--ink-soft)]">ชื่อสี</FormLabel>
                    <FormControl><Input className="rounded-none border-[var(--line)] bg-[rgba(249,247,241,0.5)] focus-visible:border-[var(--saffron)]" {...field} /></FormControl>
                    <FormMessage className="text-[#a24439] text-xs" />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="priceTHB" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider text-[var(--ink-soft)]">ราคา (บาท)</FormLabel>
                    <FormControl><Input type="number" className="rounded-none border-[var(--line)] bg-[rgba(249,247,241,0.5)] focus-visible:border-[var(--saffron)] font-mono" {...field} /></FormControl>
                    <FormMessage className="text-[#a24439] text-xs" />
                  </FormItem>
                )} />
                <FormField control={form.control} name="sortOrder" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider text-[var(--ink-soft)]">ลำดับการจัดเรียง</FormLabel>
                    <FormControl><Input type="number" className="rounded-none border-[var(--line)] bg-[rgba(249,247,241,0.5)] focus-visible:border-[var(--saffron)] font-mono" {...field} /></FormControl>
                  <p className="text-xs leading-relaxed text-[var(--ink-soft)]">เลขน้อยจะแสดงก่อน ใช้เรียงรายการในหน้านี้และในแคตตาล็อกหน้าร้าน</p>
                    <FormMessage className="text-[#a24439] text-xs" />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="dimensions" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider text-[var(--ink-soft)]">ขนาดโดยรวม</FormLabel>
                    <FormControl><Input placeholder="e.g. 500 × 500 × 850 mm" className="rounded-none border-[var(--line)] bg-[rgba(249,247,241,0.5)] focus-visible:border-[var(--saffron)] font-mono text-sm" {...field} /></FormControl>
                    <FormMessage className="text-[#a24439] text-xs" />
                  </FormItem>
                )} />
                <FormField control={form.control} name="basinDimensions" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider text-[var(--ink-soft)]">ขนาดหลุม (ตัวเลือก)</FormLabel>
                    <FormControl><Input placeholder="e.g. 400 × 300 × 120 mm" value={field.value || ""} onChange={field.onChange} className="rounded-none border-[var(--line)] bg-[rgba(249,247,241,0.5)] focus-visible:border-[var(--saffron)] font-mono text-sm" /></FormControl>
                    <FormMessage className="text-[#a24439] text-xs" />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="imageUrl" render={({ field }) => (
                <FormItem>
                  <ImageUploadField label="รูปสินค้า" value={field.value} onChange={field.onChange} />
                  <FormMessage className="text-[#a24439] text-xs" />
                </FormItem>
              )} />

              <FormField control={form.control} name="videoUrl" render={({ field }) => (
                <FormItem>
                  <VideoUploadField label="วิดีโอ 3D / 360°" value={field.value} onChange={field.onChange} />
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
                      หากปิดใช้งาน สินค้านี้จะไม่แสดงในแคตตาล็อก
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

function BasinCategoryManagerDialog({
  open,
  onOpenChange,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: BasinCategory[];
}) {
  const queryClient = useQueryClient();
  const createMutation = useCreateAdminBasinCategory();
  const updateMutation = useUpdateAdminBasinCategory();
  const deleteMutation = useDeleteAdminBasinCategory();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("0");

  const resetDraft = () => {
    setEditingId(null);
    setName("");
    setSortOrder("0");
  };

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["/api/admin/basin-categories"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/admin/basins"] });
  };

  const save = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast({ description: "กรุณากรอกชื่อหมวดหมู่", variant: "destructive" });
      return;
    }
    const data = {
      name: trimmedName,
      active: editingId ? categories.find((category) => category.id === editingId)?.active ?? true : true,
      sortOrder: Number.parseInt(sortOrder, 10) || 0,
    };
    const options = {
      onSuccess: () => {
        refresh();
        resetDraft();
        toast({ description: editingId ? "แก้ไขหมวดหมู่สำเร็จ" : "เพิ่มหมวดหมู่สำเร็จ" });
      },
      onError: (error: unknown) => {
        const message = error && typeof error === "object" && "data" in error
          ? String((error as { data?: { message?: string } }).data?.message ?? "")
          : "";
        toast({ description: message || "บันทึกหมวดหมู่ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", variant: "destructive" });
      },
    };
    if (editingId) updateMutation.mutate({ id: editingId, data }, options);
    else createMutation.mutate({ data }, options);
  };

  const toggleCategory = (category: BasinCategory) => {
    if (category.active) {
      deleteMutation.mutate({ id: category.id }, {
        onSuccess: () => { refresh(); toast({ description: "ซ่อนหมวดหมู่แล้ว หมวดหมู่เดิมยังอยู่กับสินค้า" }); },
        onError: () => toast({ description: "ซ่อนหมวดหมู่ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", variant: "destructive" }),
      });
    } else {
      updateMutation.mutate({ id: category.id, data: { name: category.name, active: true, sortOrder: category.sortOrder } }, {
        onSuccess: () => { refresh(); toast({ description: "กู้คืนหมวดหมู่แล้ว" }); },
        onError: () => toast({ description: "กู้คืนหมวดหมู่ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", variant: "destructive" }),
      });
    }
  };

  const pending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) resetDraft(); onOpenChange(nextOpen); }}>
      <DialogContent className="max-w-lg bg-[var(--card-paper)] border-[var(--line)] rounded-none">
        <DialogHeader><DialogTitle className="font-display font-semibold text-xl">จัดการหมวดหมู่อ่าง</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_120px_auto] gap-2 items-end">
            <label className="grid gap-1 text-xs text-[var(--ink-soft)]">ชื่อหมวดหมู่
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="เช่น วางเคาน์เตอร์" className="rounded-none border-[var(--line)]" />
            </label>
            <label className="grid gap-1 text-xs text-[var(--ink-soft)]">ลำดับ
              <Input type="number" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} className="rounded-none border-[var(--line)] font-mono" />
            </label>
            <Button type="button" onClick={save} disabled={pending} className="rounded-none bg-[var(--ink)] text-[var(--paper)]">{editingId ? "บันทึก" : "เพิ่ม"}</Button>
          </div>
          {editingId && <button type="button" className="text-xs text-[var(--ink-soft)] underline" onClick={resetDraft}>ยกเลิกการแก้ไข</button>}
          <p className="text-xs leading-relaxed text-[var(--ink-soft)]">การซ่อนจะเก็บหมวดหมู่และการจัดหมวดหมู่เดิมไว้ สินค้าที่ใช้อยู่จะยังแสดงชื่อเดิม</p>
          <div className="max-h-64 overflow-y-auto border border-[var(--line)]">
            {categories.length === 0 ? <p className="p-4 text-sm text-[var(--ink-soft)]">ยังไม่มีหมวดหมู่</p> : categories.map((category) => (
              <div key={category.id} className="flex items-center gap-3 border-b border-[var(--line)] last:border-b-0 px-3 py-2">
                <div className="min-w-0 flex-1"><strong className="block text-sm">{category.name}</strong><span className="text-xs text-[var(--ink-soft)]">ลำดับ {category.sortOrder} · {category.active ? "เปิดใช้" : "ซ่อนอยู่"}</span></div>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setEditingId(category.id); setName(category.name); setSortOrder(String(category.sortOrder)); }} disabled={pending}>แก้ไข</Button>
                <Button type="button" variant="ghost" size="sm" className="text-[#a24439]" onClick={() => toggleCategory(category)} disabled={pending}>{category.active ? "ซ่อน" : "กู้คืน"}</Button>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter><Button type="button" variant="outline" className="rounded-none border-[var(--line)]" onClick={() => onOpenChange(false)}>ปิด</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}