"use client";

import {
  Children,
  Fragment,
  isValidElement,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

/**
 * Themed replacement for a native <select>. It takes the same <option> and
 * <optgroup> children, so swapping one in only changes the tag; the menu is
 * drawn with the app's surface tokens, so it follows light and dark themes
 * (native option lists ignore page styles and render white-on-white).
 */

type Item =
  | { kind: "group"; label: string }
  | { kind: "option"; value: string; label: ReactNode; text: string; disabled: boolean };

type OptionProps = { value?: string | number; disabled?: boolean; children?: ReactNode };
type GroupProps = { label?: string; disabled?: boolean; children?: ReactNode };

function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

function collect(children: ReactNode, items: Item[] = [], groupDisabled = false) {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === Fragment) {
      collect((child as ReactElement<{ children?: ReactNode }>).props.children, items, groupDisabled);
    } else if (child.type === "optgroup") {
      const props = (child as ReactElement<GroupProps>).props;
      items.push({ kind: "group", label: props.label ?? "" });
      collect(props.children, items, groupDisabled || Boolean(props.disabled));
    } else if (child.type === "option") {
      const props = (child as ReactElement<OptionProps>).props;
      const text = textOf(props.children);
      items.push({
        kind: "option",
        value: String(props.value ?? text),
        label: props.children,
        text,
        disabled: groupDisabled || Boolean(props.disabled),
      });
    }
  });
  return items;
}

type Position = { left: number; top?: number; bottom?: number; width: number; maxHeight: number; above: boolean };

const GAP = 6;
const MAX_HEIGHT = 320;

function place(trigger: HTMLElement): Position {
  const rect = trigger.getBoundingClientRect();
  const below = window.innerHeight - rect.bottom - GAP - 8;
  const above = rect.top - GAP - 8;
  const openAbove = below < Math.min(MAX_HEIGHT, 200) && above > below;
  const width = Math.max(rect.width, 180);
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
  return {
    left,
    ...(openAbove
      ? { bottom: window.innerHeight - rect.top + GAP }
      : { top: rect.bottom + GAP }),
    width,
    maxHeight: Math.min(MAX_HEIGHT, openAbove ? above : below),
    above: openAbove,
  };
}

export type DropdownProps = {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  /** Classes for the trigger button; style it like the select it replaces. */
  className?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  placeholder?: string;
  onBlur?: () => void;
  /** Draw a chevron inside the trigger (for triggers without their own). */
  chevron?: boolean;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

export function Dropdown({
  value,
  onChange,
  children,
  className = "",
  disabled = false,
  required = false,
  name,
  id,
  placeholder = "Select",
  onBlur,
  chevron = false,
  ...aria
}: DropdownProps) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const [position, setPosition] = useState<Position | null>(null);
  const [active, setActive] = useState(-1);
  const open = position !== null;

  const items = collect(children);
  const selectedIndex = items.findIndex((item) => item.kind === "option" && item.value === value);
  const selected = selectedIndex >= 0 ? items[selectedIndex] : null;
  const enabled = (index: number) => {
    const item = items[index];
    return item?.kind === "option" && !item.disabled;
  };

  function show() {
    if (disabled || !triggerRef.current) return;
    setPosition(place(triggerRef.current));
    setActive(selectedIndex >= 0 ? selectedIndex : items.findIndex((_, index) => enabled(index)));
  }

  function hide(refocus = true) {
    setPosition(null);
    if (refocus) triggerRef.current?.focus({ preventScroll: true });
  }

  function choose(index: number) {
    const item = items[index];
    if (item?.kind !== "option" || item.disabled) return;
    hide();
    if (item.value !== value) onChange(item.value);
  }

  function step(from: number, direction: 1 | -1) {
    for (let index = from + direction; index >= 0 && index < items.length; index += direction) {
      if (enabled(index)) return index;
    }
    return from;
  }

  function typeAhead(key: string) {
    const now = Date.now();
    const buffer = now - typed.current.at > 700 ? key : typed.current.text + key;
    typed.current = { text: buffer, at: now };
    const start = buffer.length === 1 ? active + 1 : active;
    for (let offset = 0; offset < items.length; offset += 1) {
      const index = (Math.max(start, 0) + offset) % items.length;
      const item = items[index];
      if (enabled(index) && item.kind === "option" && item.text.toLowerCase().startsWith(buffer.toLowerCase()))
        return index;
    }
    return -1;
  }

  // Keep the menu glued to its trigger while the page scrolls or resizes.
  useLayoutEffect(() => {
    if (!open) return;
    const follow = (event: Event) => {
      if (event.target instanceof Node && listRef.current?.contains(event.target)) return;
      if (triggerRef.current) setPosition(place(triggerRef.current));
    };
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (listRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setPosition(null);
    };
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    document.addEventListener("pointerdown", outside, true);
    listRef.current?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
      document.removeEventListener("pointerdown", outside, true);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || active < 0) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function onTriggerKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      show();
      return;
    }
    if (event.key.length === 1 && /\S/.test(event.key)) {
      const match = typeAhead(event.key);
      if (match >= 0) choose(match);
    }
  }

  function onListKey(event: KeyboardEvent<HTMLDivElement>) {
    const keys: Record<string, () => void> = {
      ArrowDown: () => setActive((current) => step(current, 1)),
      ArrowUp: () => setActive((current) => step(current, -1)),
      Home: () => setActive(step(-1, 1)),
      End: () => setActive(step(items.length, -1)),
      PageDown: () => setActive((current) => step(Math.min(current + 7, items.length), -1)),
      PageUp: () => setActive((current) => step(Math.max(current - 7, -1), 1)),
      Enter: () => choose(active),
      " ": () => choose(active),
      Escape: () => hide(),
      Tab: () => hide(),
    };
    const action = keys[event.key];
    if (action) {
      if (event.key !== "Tab") event.preventDefault();
      // Escape closes only the menu, never a dialog around it.
      event.stopPropagation();
      action();
      return;
    }
    if (event.key.length === 1 && /\S/.test(event.key)) {
      const match = typeAhead(event.key);
      if (match >= 0) setActive(match);
    }
  }

  const activeItem = items[active];
  const current =
    selected?.kind === "option" ? selected.label : <span className="text-faint">{placeholder}</span>;

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={aria["aria-label"]}
        aria-describedby={aria["aria-describedby"]}
        aria-invalid={aria["aria-invalid"]}
        disabled={disabled}
        onClick={() => (open ? hide() : show())}
        onKeyDown={onTriggerKey}
        onBlur={() => {
          if (!open) onBlur?.();
        }}
        className={`text-left ${chevron ? "inline-flex items-center justify-between gap-2" : "truncate"} ${className}`}
      >
        {chevron ? (
          <>
            <span className="min-w-0 truncate">{current}</span>
            <ChevronDown
              size={15}
              className={`shrink-0 text-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`}
            />
          </>
        ) : (
          current
        )}
      </button>
      {name || required ? (
        // Lets forms submit the value and block on `required` like a select would.
        <input
          tabIndex={-1}
          aria-hidden="true"
          name={name}
          required={required}
          value={value}
          onChange={() => {}}
          onFocus={() => triggerRef.current?.focus()}
          className="pointer-events-none absolute bottom-0 left-1/2 h-px w-px opacity-0"
        />
      ) : null}
      {open
        ? createPortal(
            <div
              ref={listRef}
              id={listId}
              role="listbox"
              tabIndex={-1}
              aria-activedescendant={activeItem?.kind === "option" ? `${listId}-${active}` : undefined}
              onKeyDown={onListKey}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setPosition(null);
                  onBlur?.();
                }
              }}
              style={{
                position: "fixed",
                left: position.left,
                top: position.top,
                bottom: position.bottom,
                minWidth: position.width,
                maxHeight: position.maxHeight,
              }}
              className={`dropdown-menu z-[200] max-w-[min(420px,calc(100vw-16px))] overflow-y-auto overscroll-contain rounded-xl border border-line-strong bg-surface p-1 text-ink shadow-[0_12px_32px_-8px_rgba(0,0,0,0.28),0_2px_6px_rgba(0,0,0,0.08)] outline-none ${position.above ? "origin-bottom" : "origin-top"}`}
            >
              {items.map((item, index) =>
                item.kind === "group" ? (
                  <div
                    key={`group-${index}`}
                    role="presentation"
                    className="px-2.5 pb-1 pt-2.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-faint first:pt-1.5"
                  >
                    {item.label}
                  </div>
                ) : (
                  <div
                    key={`${item.value}-${index}`}
                    id={`${listId}-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={item.value === value}
                    aria-disabled={item.disabled || undefined}
                    onPointerMove={() => {
                      if (!item.disabled && active !== index) setActive(index);
                    }}
                    onClick={() => choose(index)}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] leading-tight transition-colors ${
                      item.disabled
                        ? "cursor-not-allowed opacity-40"
                        : index === active
                          ? "bg-sunken text-ink"
                          : "text-ink-2"
                    } ${item.value === value ? "font-semibold text-ink" : "font-medium"}`}
                  >
                    <span className="min-w-0 flex-1 whitespace-nowrap">{item.label}</span>
                    <Check
                      size={14}
                      strokeWidth={2.4}
                      className={item.value === value ? "shrink-0 text-action" : "shrink-0 opacity-0"}
                    />
                  </div>
                ),
              )}
              {items.length === 0 ? (
                <div className="px-2.5 py-2 text-[13px] text-muted">No options</div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
