"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  name: string;
  iconFile?: string;
  onRemove: () => void;
};

export default function SelectedClassChip({ name, iconFile, onRemove }: Props) {
  const tooltipId = useId();
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    if (!position) return;
    const dismiss = () => setPosition(null);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [position]);
  const showName = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 168)), top: rect.top - 6 });
  };

  return (
    <div className="sidebar-selected-chip"
      onMouseEnter={(event) => showName(event.currentTarget)}
      onMouseLeave={() => setPosition(null)}
      onFocus={(event) => showName(event.currentTarget)}
      onBlur={() => setPosition(null)}
      onWheel={() => setPosition(null)}
    >
      {iconFile ? <img src={iconFile} alt="" draggable={false} /> : <span>{name.slice(0, 1)}</span>}
      <button
        type="button"
        className="sidebar-chip-remove"
        aria-label={`取消选择${name}`}
        aria-describedby={position ? tooltipId : undefined}
        onClick={onRemove}
      >
        <span aria-hidden="true" />
      </button>
      {position && createPortal(
        <span id={tooltipId} role="tooltip" className="sidebar-chip-name" style={{ left: position.left, top: position.top }}>{name}</span>,
        document.body,
      )}
    </div>
  );
}
