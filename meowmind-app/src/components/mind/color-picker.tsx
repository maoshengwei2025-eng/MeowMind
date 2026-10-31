import { useState, type CSSProperties } from 'react';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}

const PRESET_COLORS = [
  '#1e293b', '#6366f1', '#ec4899', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316',
  '#ffffff', '#f1f5f9', '#e2e8f0', '#94a3b8', '#475569',
];

export function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      {label && (
        <span className="text-xs text-slate-500 mr-2">{label}</span>
      )}
      <button
        className="w-7 h-7 rounded-md border-2 border-slate-200 shadow-sm cursor-pointer hover:scale-105 transition-transform"
        style={{ backgroundColor: value } as CSSProperties}
        onClick={() => setOpen(!open)}
      />
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute z-50 mt-2 p-3 bg-white rounded-lg shadow-xl border border-slate-200">
            <div className="grid grid-cols-5 gap-2 mb-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  className="w-6 h-6 rounded border border-slate-200 cursor-pointer hover:scale-110 transition-transform"
                  style={{ backgroundColor: color } as CSSProperties}
                  onClick={() => {
                    onChange(color);
                    setOpen(false);
                  }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <input
                type="color"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0"
              />
              <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="flex-1 text-xs px-2 py-1 border border-slate-200 rounded font-mono"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
