"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  expandable?: boolean;
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Search skills...",
  expandable = false,
}: SearchBarProps) {
  const [local, setLocal] = useState(value);
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const expandedInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const handleChange = (val: string) => {
    setLocal(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(val), 300);
  };

  // Immediately commit current value and close overlay
  const handleSubmit = useCallback(() => {
    clearTimeout(timerRef.current);
    onChange(local);
    setExpanded(false);
  }, [local, onChange]);

  const handleFocus = () => {
    if (expandable) {
      setExpanded(true);
    }
  };

  const handleClose = useCallback(() => {
    // Flush pending value before closing
    clearTimeout(timerRef.current);
    onChange(local);
    setExpanded(false);
  }, [local, onChange]);

  useEffect(() => {
    if (!expanded) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [expanded, handleClose]);

  // Focus the expanded input after transition
  useEffect(() => {
    if (expanded) {
      const timer = setTimeout(() => expandedInputRef.current?.focus(), 80);
      return () => clearTimeout(timer);
    }
  }, [expanded]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <>
      {/* Static search bar */}
      <div className="relative">
        <Search
          size={20}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60"
        />
        <input
          ref={inputRef}
          type="text"
          value={local}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="w-full pl-12 pr-10 py-3.5 rounded-full border border-white/[0.2] bg-white/[0.06] text-white/90 placeholder-white/50 focus:outline-none focus:border-ripple-400/70 hover:border-white/[0.28] hover:bg-white/[0.08] text-base transition-all cursor-pointer"
          readOnly={expandable}
        />
        {local && !expandable && (
          <button
            onClick={() => handleChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/[0.08]"
          >
            <X size={16} className="text-white/30" />
          </button>
        )}
      </div>

      {/* Expandable overlay — always mounted, toggled via CSS */}
      {expandable && mounted && createPortal(
        <div
          className={`search-overlay ${expanded ? "search-overlay--active" : ""}`}
          onClick={handleClose}
        >
          <div
            className={`search-panel ${expanded ? "search-panel--active" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <Search
                size={20}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60"
              />
              <input
                ref={expandedInputRef}
                type="text"
                value={local}
                onChange={(e) => handleChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="w-full pl-12 pr-12 py-3.5 rounded-full border border-ripple-400/60 bg-white/[0.06] text-white placeholder-white/30 focus:outline-none focus:border-ripple-400/80 focus:shadow-[0_0_20px_rgba(139,92,246,0.15)] text-base transition-all"
              />
              {/* Search / Clear button */}
              <button
                onClick={local ? () => { handleChange(""); expandedInputRef.current?.focus(); } : handleSubmit}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-white/[0.08] transition-colors"
              >
                {local ? (
                  <X size={16} className="text-white/40" />
                ) : (
                  <Search size={16} className="text-white/30" />
                )}
              </button>
            </div>
            <p className="text-center text-white/15 text-xs mt-4">
              Enter to search · ESC to close
            </p>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
