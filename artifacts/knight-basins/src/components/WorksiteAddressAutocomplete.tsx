import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Loader2, MapPin } from "lucide-react";
import { useGetWorksiteAddressSuggestions } from "@workspace/api-client-react";

type WorksiteAddressAutocompleteProps = {
  value: string;
  selectedPlaceId: string | null;
  required?: boolean;
  onValueChange: (value: string) => void;
  onPlaceSelect: (placeId: string) => void;
  onClearPlace: () => void;
};

export function WorksiteAddressAutocomplete({
  value,
  selectedPlaceId,
  required = false,
  onValueChange,
  onPlaceSelect,
  onClearPlace,
}: WorksiteAddressAutocompleteProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState(value.trim());
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selectedText, setSelectedText] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(value.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [value]);

  const normalizedValue = value.trim();
  const queryMatchesValue = normalizedValue === debouncedQuery;
  const canSearch = isOpen && queryMatchesValue && debouncedQuery.length >= 3 && !selectedPlaceId;
  const { data, isError, isFetching } = useGetWorksiteAddressSuggestions(
    { input: debouncedQuery.slice(0, 250) },
    {
      query: {
        enabled: canSearch,
        staleTime: 0,
        gcTime: 0,
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  );
  const suggestions = data?.suggestions ?? [];
  const showPanel = isOpen && normalizedValue.length >= 3 && !selectedPlaceId;

  const selectSuggestion = (index: number) => {
    const suggestion = suggestions[index];
    if (!suggestion) return;
    onPlaceSelect(suggestion.placeId);
    setSelectedText(suggestion.text);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => Math.min(current + 1, suggestions.length - 1));
    } else if (event.key === "ArrowUp" && suggestions.length > 0) {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current <= 0 ? 0 : current - 1, 0));
    } else if (event.key === "Enter" && isOpen && activeIndex >= 0) {
      event.preventDefault();
      selectSuggestion(activeIndex);
    } else if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div ref={rootRef} className="studio-contact-wide grid gap-1">
      <label className="grid gap-1">
        <span>ที่อยู่ / สถานที่ติดตั้ง{required && <span> *</span>}</span>
        <div className="relative">
          <input
            required={required}
            type="text"
            maxLength={250}
            autoComplete="street-address"
            placeholder="พิมพ์ที่อยู่เต็ม เช่น 99 ถนนสุขุมวิท เขตวัฒนา กรุงเทพฯ"
            value={value}
            onChange={(event) => {
              onValueChange(event.target.value);
              onClearPlace();
              setSelectedText("");
              setActiveIndex(-1);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onBlur={(event) => {
              if (event.relatedTarget instanceof Node && rootRef.current?.contains(event.relatedTarget)) return;
              window.setTimeout(() => setIsOpen(false), 100);
            }}
            onKeyDown={handleKeyDown}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showPanel}
            aria-controls={listboxId}
            aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
            aria-describedby={`${listboxId}-help`}
            data-testid="input-studio-address"
          />
          {showPanel && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden border border-[var(--line)] bg-[var(--card-paper)] shadow-xl">
              {isFetching || !queryMatchesValue ? (
                <div className="flex items-center gap-2 px-3 py-3 text-sm text-[var(--ink-soft)]" role="status">
                  <Loader2 className="h-4 w-4 animate-spin" /> กำลังค้นหาตำแหน่ง…
                </div>
              ) : isError ? (
                <div className="px-3 py-3 text-sm text-[var(--ink-soft)]" role="status" data-testid="status-studio-address-autocomplete">
                  ค้นหาตำแหน่งไม่ได้ในขณะนี้ แต่ยังกรอกที่อยู่เองได้ตามปกติ
                </div>
              ) : suggestions.length > 0 ? (
                <>
                  <div id={listboxId} role="listbox" aria-label="ตำแหน่งที่แนะนำ">
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={suggestion.placeId}
                        id={`${listboxId}-option-${index}`}
                        type="button"
                        role="option"
                        aria-selected={activeIndex === index}
                        className={`block w-full border-b border-[var(--line)] px-3 py-2.5 text-left last:border-b-0 hover:bg-[var(--line)]/20 ${activeIndex === index ? "bg-[var(--line)]/20" : ""}`}
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => selectSuggestion(index)}
                        data-testid={`option-studio-address-${index}`}
                      >
                        <span className="block text-sm font-medium text-[var(--ink)]">{suggestion.primaryText}</span>
                        {suggestion.secondaryText && (
                          <span className="mt-0.5 block text-xs text-[var(--ink-soft)]">{suggestion.secondaryText}</span>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-[var(--line)] px-3 py-1.5 text-right text-[10px] text-[var(--ink-soft)]">
                    Google Maps
                  </div>
                </>
              ) : (
                <div className="px-3 py-3 text-sm text-[var(--ink-soft)]" role="status">
                  ไม่พบตำแหน่งที่ตรงกัน ลองเพิ่มชื่อถนนหรือเขต หรือกรอกที่อยู่เองได้
                </div>
              )}
            </div>
          )}
        </div>
      </label>
      <p id={`${listboxId}-help`} className="text-[11px] leading-relaxed text-[var(--ink-soft)]">
        ที่อยู่ที่พิมพ์จะถูกบันทึก ส่วนตำแหน่งที่เลือกใช้ให้ทีมช่างเปิดเส้นทาง
      </p>
      {selectedPlaceId && selectedText && (
        <div className="flex items-start justify-between gap-3 border border-[var(--line)] bg-[var(--line)]/10 px-3 py-2 text-xs">
          <span className="flex min-w-0 items-start gap-1.5 text-[var(--ink)]">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--brand-blue)]" />
            <span><strong>ตำแหน่งเส้นทาง:</strong> {selectedText}<span className="ml-1 text-[10px] text-[var(--ink-soft)]">Google Maps</span></span>
          </span>
          <button
            type="button"
            className="shrink-0 text-[var(--brand-blue)] underline underline-offset-2"
            onClick={() => {
              onClearPlace();
              setSelectedText("");
              setIsOpen(true);
            }}
            data-testid="button-change-studio-address-place"
          >
            เปลี่ยน
          </button>
        </div>
      )}
    </div>
  );
}