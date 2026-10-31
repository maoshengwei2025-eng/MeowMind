import { type CSSProperties } from 'react';
import {
  Bold,
  Italic,
  Square,
  Squircle,
  Circle,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import type { useMindStore } from '@/lib/use-mind-store';
import { ColorPicker } from './color-picker';
import type { NodeStyle } from '@/lib/mind-types';

interface PropertyPanelProps {
  store: ReturnType<typeof useMindStore>;
}

export function PropertyPanel({ store }: PropertyPanelProps) {
  const {
    nodes,
    selectedIds,
    updateNodeStyle,
    batchUpdateStyle,
    batchUpdateSize,
    syncNodes,
  } = store;

  const selectedNodes = nodes.filter((n) => selectedIds.has(n.id));
  const isMulti = selectedNodes.length > 1;
  const singleNode = selectedNodes[0];

  if (selectedNodes.length === 0) {
    return (
      <div className="w-64 h-full bg-white border-l border-slate-200 overflow-y-auto p-4">
        <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
          <div className="text-4xl mb-3">🐱</div>
          <p className="text-sm">选择一个节点来编辑样式</p>
          <p className="text-xs mt-2 text-slate-300">或者拖拽框选多个节点</p>
        </div>
      </div>
    );
  }

  const currentStyle: NodeStyle = singleNode?.style || {
    bg: '#6366f1',
    text: '#ffffff',
    border: '#4f46e5',
    borderWidth: 2,
    fontSize: 14,
    fontFamily: 'system-ui, sans-serif',
    bold: false,
    italic: false,
    shape: 'rounded',
  };

  const ids = selectedNodes.map((n) => n.id);

  const setStyle = (style: Partial<NodeStyle>) => {
    if (isMulti) {
      batchUpdateStyle(ids, style);
    } else if (singleNode) {
      updateNodeStyle(singleNode.id, style);
    }
  };

  // 批量对齐
  const alignNodes = (type: 'left' | 'center' | 'right') => {
    if (selectedNodes.length < 2) return;
    let newNodes = [...store.nodesRef.current];
    if (type === 'left') {
      const minX = Math.min(...selectedNodes.map((n) => n.x));
      newNodes = newNodes.map((n) =>
        selectedIds.has(n.id) ? { ...n, x: minX } : n
      );
    } else if (type === 'center') {
      const centerX = Math.min(...selectedNodes.map((n) => n.x + n.width / 2));
      newNodes = newNodes.map((n) =>
        selectedIds.has(n.id) ? { ...n, x: centerX - n.width / 2 } : n
      );
    } else {
      const maxX = Math.max(...selectedNodes.map((n) => n.x + n.width));
      newNodes = newNodes.map((n) =>
        selectedIds.has(n.id) ? { ...n, x: maxX - n.width } : n
      );
    }
    syncNodes(newNodes);
  };

  const labelClass = "text-xs font-medium text-slate-500 mb-1";
  const sectionClass = "mb-4 pb-4 border-b border-slate-100";

  return (
    <div className="w-64 h-full bg-white border-l border-slate-200 overflow-y-auto">
      <div className="p-4">
        <div className="text-sm font-bold text-slate-700 mb-3">
          {isMulti ? `已选 ${selectedNodes.length} 个节点` : '节点属性'}
        </div>

        {/* 尺寸 */}
        <div className={sectionClass}>
          <div className={labelClass}>尺寸</div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">宽</label>
            <input
              type="number"
              value={Math.round(singleNode?.width || 140)}
              onChange={(e) => {
                const w = parseInt(e.target.value) || 140;
                if (isMulti) batchUpdateSize(ids, w, null);
                else if (singleNode) batchUpdateSize([singleNode.id], w, null);
              }}
              className="flex-1 px-2 py-1 text-sm border border-slate-200 rounded"
              style={{ width: '60px' } as CSSProperties}
            />
            <label className="text-xs text-slate-500">高</label>
            <input
              type="number"
              value={Math.round(singleNode?.height || 40)}
              onChange={(e) => {
                const h = parseInt(e.target.value) || 40;
                if (isMulti) batchUpdateSize(ids, null, h);
                else if (singleNode) batchUpdateSize([singleNode.id], null, h);
              }}
              className="flex-1 px-2 py-1 text-sm border border-slate-200 rounded"
              style={{ width: '60px' } as CSSProperties}
            />
          </div>
        </div>

        {/* 颜色 */}
        <div className={sectionClass}>
          <div className={labelClass}>颜色</div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ColorPicker
                value={currentStyle.bg}
                onChange={(c) => setStyle({ bg: c })}
                label="背景"
              />
              <span className="text-xs text-slate-400">{currentStyle.bg}</span>
            </div>
            <div className="flex items-center gap-2">
              <ColorPicker
                value={currentStyle.text}
                onChange={(c) => setStyle({ text: c })}
                label="文字"
              />
              <span className="text-xs text-slate-400">{currentStyle.text}</span>
            </div>
            <div className="flex items-center gap-2">
              <ColorPicker
                value={currentStyle.border}
                onChange={(c) => setStyle({ border: c })}
                label="边框"
              />
              <span className="text-xs text-slate-400">{currentStyle.border}</span>
            </div>
          </div>
        </div>

        {/* 字体 */}
        <div className={sectionClass}>
          <div className={labelClass}>字体</div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={currentStyle.fontSize}
                onChange={(e) => setStyle({ fontSize: parseInt(e.target.value) || 14 })}
                className="px-2 py-1 text-sm border border-slate-200 rounded w-16"
                min={8}
                max={48}
              />
              <span className="text-xs text-slate-500">字号</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={currentStyle.borderWidth}
                onChange={(e) => setStyle({ borderWidth: parseInt(e.target.value) || 0 })}
                className="px-2 py-1 text-sm border border-slate-200 rounded w-16"
                min={0}
                max={10}
              />
              <span className="text-xs text-slate-500">边框粗细</span>
            </div>
            <div className="flex gap-1">
              <button
                className={`flex-1 flex items-center justify-center py-1.5 rounded border text-sm transition-colors ${
                  currentStyle.bold
                    ? 'bg-indigo-500 text-white border-indigo-500'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
                onClick={() => setStyle({ bold: !currentStyle.bold })}
              >
                <Bold size={14} />
              </button>
              <button
                className={`flex-1 flex items-center justify-center py-1.5 rounded border text-sm transition-colors ${
                  currentStyle.italic
                    ? 'bg-indigo-500 text-white border-indigo-500'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
                onClick={() => setStyle({ italic: !currentStyle.italic })}
              >
                <Italic size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* 形状 */}
        <div className={sectionClass}>
          <div className={labelClass}>形状</div>
          <div className="flex gap-1">
            {[
              { value: 'rect' as const, icon: Square, label: '矩形' },
              { value: 'rounded' as const, icon: Squircle, label: '圆角' },
              { value: 'ellipse' as const, icon: Circle, label: '椭圆' },
            ].map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                className={`flex-1 flex flex-col items-center gap-1 py-2 rounded border text-xs transition-colors ${
                  currentStyle.shape === value
                    ? 'bg-indigo-500 text-white border-indigo-500'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
                onClick={() => setStyle({ shape: value })}
                title={label}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 批量对齐 */}
        {isMulti && (
          <div className={sectionClass}>
            <div className={labelClass}>对齐</div>
            <div className="flex gap-1">
              <button
                className="flex-1 flex items-center justify-center py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
                onClick={() => alignNodes('left')}
                title="左对齐"
              >
                <AlignLeft size={16} />
              </button>
              <button
                className="flex-1 flex items-center justify-center py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
                onClick={() => alignNodes('center')}
                title="居中对齐"
              >
                <AlignCenter size={16} />
              </button>
              <button
                className="flex-1 flex items-center justify-center py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
                onClick={() => alignNodes('right')}
                title="右对齐"
              >
                <AlignRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
