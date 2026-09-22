import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

/**
 * ConfirmDialog - Styled inline confirmation dialog.
 * Replaces browser window.confirm() with a proper design.
 *
 * Props:
 *   isOpen      - boolean: whether to show the dialog
 *   title       - string: dialog heading
 *   description - string: body text
 *   confirmLabel - string: label on the confirm button (default "Delete")
 *   onConfirm   - fn: called when confirmed
 *   onCancel    - fn: called when cancelled
 */
export default function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-surface-850 border border-surface-border rounded-xl max-w-sm w-full p-5 space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon + Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4.5 h-4.5 text-rose-400" />
            </div>
            <h4 className="text-sm font-bold text-white leading-snug">{title}</h4>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-lg hover:bg-surface-800 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Description */}
        {description && (
          <p className="text-xs text-slate-400 leading-relaxed pl-12">
            {description}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:bg-surface-800 border border-surface-border transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
