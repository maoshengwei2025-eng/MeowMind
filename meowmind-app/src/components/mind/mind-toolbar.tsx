import {
  Undo2,
  Redo2,
  Plus,
  Trash2,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize,
  Cat,
} from 'lucide-react';
import type { useMindStore } from '@/lib/use-mind-store';
import { exportAsImage } from '@/lib/mind-export';
import { useRef } from 'react';

interface MindToolbarProps {
  store: ReturnType<typeof useMindStore>;
  contentRef: React.RefObject<HTMLDivElement | null>;
}

export function MindToolbar({ store, contentRef }: MindToolbarProps) {
  const {
    selectedIds,
    nodes,
    canUndo,
    canRedo,
    undo,
    redo,
    addChildNode,
    deleteNode,
    zoom,
    setZoomLevel,
    resetView,
    fitToScreen,
  } = store;

  const handleAddChild = () => {
    if (selectedIds.size === 1) {
      addChildNode(Array.from(selectedIds)[0]);
    }
  };

  const handleDelete = () => {
    if (selectedIds.size === 1) {
      deleteNode(Array.from(selectedIds)[0]);
    }
  };

  const handleExport = async () => {
    if (contentRef.current) {
      await exportAsImage(contentRef.current, 'meowmind.png');
    }
  };

  const zoomIn = () => setZoomLevel(zoom + 0.1);
  const zoomOut = () => setZoomLevel(zoom - 0.1);

  const buttonBase = "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors";
  const buttonNormal = `${buttonBase} bg-white hover:bg-slate-100 text-slate-700 border border-slate-200`;
  const buttonDisabled = `${buttonBase} bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed`;
  const buttonPrimary = `${buttonBase} bg-indigo-500 hover:bg-indigo-600 text-white`;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-slate-200 shadow-sm">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-2 pr-3 border-r border-slate-200">
        <Cat size={22} className="text-indigo-500" />
        <span className="font-bold text-slate-800">喵呜导图</span>
      </div>

      {/* 撤销/重做 */}
      <button
        className={canUndo ? buttonNormal : buttonDisabled}
        onClick={undo}
        disabled={!canUndo}
        title="撤销 (Ctrl+Z)"
      >
        <Undo2 size={16} />
      </button>
      <button
        className={canRedo ? buttonNormal : buttonDisabled}
        onClick={redo}
        disabled={!canRedo}
        title="重做 (Ctrl+Y)"
      >
        <Redo2 size={16} />
      </button>

      <div className="w-px h-6 bg-slate-200" />

      {/* 添加/删除 */}
      <button
        className={selectedIds.size === 1 ? buttonPrimary : buttonDisabled}
        onClick={handleAddChild}
        disabled={selectedIds.size !== 1}
        title="添加子节点 (Tab)"
      >
        <Plus size={16} />
        <span>子节点</span>
      </button>
      <button
        className={selectedIds.size > 0 && !selectedIds.has(nodes.find((n) => n.parentId === null)?.id || '') ? buttonNormal : buttonDisabled}
        onClick={handleDelete}
        disabled={selectedIds.size === 0}
        title="删除节点 (Delete)"
      >
        <Trash2 size={16} />
        <span>删除</span>
      </button>

      <div className="w-px h-6 bg-slate-200" />

      {/* 缩放 */}
      <button className={buttonNormal} onClick={zoomOut} title="缩小">
        <ZoomOut size={16} />
      </button>
      <span className="text-sm text-slate-600 min-w-[45px] text-center">
        {Math.round(zoom * 100)}%
      </span>
      <button className={buttonNormal} onClick={zoomIn} title="放大">
        <ZoomIn size={16} />
      </button>
      <button className={buttonNormal} onClick={resetView} title="重置视图">
        <Maximize size={16} />
      </button>
      <button className={buttonNormal} onClick={fitToScreen} title="适应屏幕">
        适应
      </button>

      <div className="w-px h-6 bg-slate-200" />

      {/* 导出 */}
      <button className={buttonNormal} onClick={handleExport} title="导出为图片">
        <Download size={16} />
        <span>导出</span>
      </button>

      <div className="flex-1" />

      {/* 提示 */}
      <div className="text-xs text-slate-400 hidden lg:flex items-center gap-3">
        <span>Tab: 子节点</span>
        <span>Enter: 同级</span>
        <span>Delete: 删除</span>
        <span>双击: 编辑</span>
        <span>中键拖拽: 整树</span>
      </div>
    </div>
  );
}
