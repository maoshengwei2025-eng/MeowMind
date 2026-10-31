import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { MindNode, NodeStyle } from '@/lib/mind-types';
import {
  getRootNode,
  getSubtree,
  isLeftSide,
} from '@/lib/mind-types';
import { rearrangeSide } from '@/lib/node-layout';
import type { useMindStore } from '@/lib/use-mind-store';

interface MindCanvasProps {
  store: ReturnType<typeof useMindStore>;
}

interface DragState {
  type: 'node' | 'subtree' | 'box' | 'pan' | null;
  startMouseX: number;
  startMouseY: number;
  nodeId: string | null;
  nodeStartX: number;
  nodeStartY: number;
  hasMoved: boolean;
  // 框选
  boxStartX: number;
  boxStartY: number;
  boxEndX: number;
  boxEndY: number;
  // 多选拖拽
  idsToMove?: string[];
  // 增量跟踪
  lastDx?: number;
  lastDy?: number;
}

const DRAG_THRESHOLD = 3;

export function MindCanvas({ store }: MindCanvasProps) {
  const {
    nodes,
    selectedIds,
    zoom,
    pan,
    editingId,
    canvasConfig,
    selectNode,
    clearSelection,
    setMultiSelection,
    startEditing,
    stopEditing,
    updateNodeText,
    addChildNode,
    addSiblingNode,
    deleteNode,
    batchDelete,
    undo,
    redo,
    moveNodeRaw,
    batchMoveNodesRaw,
    moveSubtreeRaw,
    beginBatch,
    endBatch,
    setNodesRaw,
    syncNodes,
    setZoomLevel,
    setPanOffset,
  } = store;

  const canvasRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState>({
    type: null,
    startMouseX: 0,
    startMouseY: 0,
    nodeId: null,
    nodeStartX: 0,
    nodeStartY: 0,
    hasMoved: false,
    boxStartX: 0,
    boxStartY: 0,
    boxEndX: 0,
    boxEndY: 0,
  });
  const dragStateRef = useRef(dragState);
  dragStateRef.current = dragState;

  const [editText, setEditText] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // 屏幕坐标转画布坐标
  const screenToCanvas = useCallback((screenX: number, screenY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (screenX - rect.left - pan.x) / zoom,
      y: (screenY - rect.top - pan.y) / zoom,
    };
  }, [pan, zoom]);

  // 获取节点的连接路径（父节点到子节点）
  const getConnectionPath = useCallback((parent: MindNode, child: MindNode): string => {
    const px = parent.x + parent.width / 2;
    const py = parent.y + parent.height / 2;
    const cx = child.x + child.width / 2;
    const cy = child.y + child.height / 2;

    const dx = Math.abs(cx - px);
    const cp1x = px + (cx > px ? dx * 0.4 : -dx * 0.4);
    const cp1y = py;
    const cp2x = cx + (cx > px ? -dx * 0.4 : dx * 0.4);
    const cp2y = cy;

    return `M ${px} ${py} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${cx} ${cy}`;
  }, []);

  // 获取节点形状样式
  const getNodeShape = useCallback((style: NodeStyle): CSSProperties => {
    const base: CSSProperties = {
      backgroundColor: style.bg,
      color: style.text,
      borderColor: style.border,
      borderWidth: `${style.borderWidth}px`,
      borderStyle: 'solid',
      fontSize: `${style.fontSize}px`,
      fontFamily: style.fontFamily,
      fontWeight: style.bold ? 'bold' : 'normal',
      fontStyle: style.italic ? 'italic' : 'normal',
    };

    if (style.shape === 'rounded') {
      base.borderRadius = '10px';
    } else if (style.shape === 'ellipse') {
      base.borderRadius = '50%';
    } else {
      base.borderRadius = '0px';
    }

    return base;
  }, []);

  // 节点鼠标按下
  const onNodeMouseDown = useCallback((e: React.MouseEvent, node: MindNode) => {
    // 中键拖拽 = 整树拖拽
    if (e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
      selectNode(node.id);
      setDragState({
        type: 'subtree',
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        nodeId: node.id,
        nodeStartX: node.x,
        nodeStartY: node.y,
        hasMoved: false,
        boxStartX: 0,
        boxStartY: 0,
        boxEndX: 0,
        boxEndY: 0,
        lastDx: 0,
        lastDy: 0,
      });
      beginBatch();
      return;
    }

    // 左键拖拽 = 单节点移动 / 框选
    if (e.button === 0) {
      e.stopPropagation();
      const additive = e.shiftKey || e.ctrlKey || e.metaKey;

      if (!additive && !selectedIds.has(node.id)) {
        selectNode(node.id);
      } else if (additive) {
        selectNode(node.id, true);
      }

      // 如果已经多选且当前节点在选中中，则拖拽所有选中
      const idsToMove = selectedIds.has(node.id) && selectedIds.size > 1
        ? Array.from(selectedIds)
        : [node.id];

      setDragState({
        type: 'node',
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        nodeId: node.id,
        nodeStartX: node.x,
        nodeStartY: node.y,
        hasMoved: false,
        boxStartX: 0,
        boxStartY: 0,
        boxEndX: 0,
        boxEndY: 0,
        idsToMove: idsToMove,
        lastDx: 0,
        lastDy: 0,
      });
      beginBatch();
    }
  }, [selectedIds, selectNode, beginBatch]);

  // 画布鼠标按下
  const onCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      // 左键空白区域 = 框选或清除
      const canvasPos = screenToCanvas(e.clientX, e.clientY);
      setDragState({
        type: 'box',
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        nodeId: null,
        nodeStartX: 0,
        nodeStartY: 0,
        hasMoved: false,
        boxStartX: canvasPos.x,
        boxStartY: canvasPos.y,
        boxEndX: canvasPos.x,
        boxEndY: canvasPos.y,
      });
    } else if (e.button === 1) {
      // 中键空白区域 = 平移
      e.preventDefault();
      setDragState({
        type: 'pan',
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        nodeId: null,
        nodeStartX: pan.x,
        nodeStartY: pan.y,
        hasMoved: false,
        boxStartX: 0,
        boxStartY: 0,
        boxEndX: 0,
        boxEndY: 0,
      });
    }
  }, [screenToCanvas, pan]);

  // 鼠标移动
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
    const ds = dragStateRef.current;
    if (!ds.type) return;

    const dx = e.clientX - ds.startMouseX;
    const dy = e.clientY - ds.startMouseY;

    if (!ds.hasMoved && Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) {
      return;
    }

    if (!ds.hasMoved) {
      ds.hasMoved = true;
    }

    if (ds.type === 'node' && ds.nodeId) {
      const ddx = dx / zoom;
      const ddy = dy / zoom;
      const ids = ds.idsToMove || [ds.nodeId];
      const incDx = ddx - (ds.lastDx || 0);
      const incDy = ddy - (ds.lastDy || 0);
      if (incDx !== 0 || incDy !== 0) {
        batchMoveNodesRaw(ids, incDx, incDy);
      }
      ds.lastDx = ddx;
      ds.lastDy = ddy;
      } else if (ds.type === 'subtree' && ds.nodeId) {
        const ddx = dx / zoom;
        const ddy = dy / zoom;
        const incDx = ddx - (ds.lastDx || 0);
        const incDy = ddy - (ds.lastDy || 0);
        if (incDx !== 0 || incDy !== 0) {
          moveSubtreeRaw(ds.nodeId, incDx, incDy);
        }
        ds.lastDx = ddx;
        ds.lastDy = ddy;
      } else if (ds.type === 'pan') {
        setPanOffset(ds.nodeStartX + dx, ds.nodeStartY + dy);
      } else if (ds.type === 'box') {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);
        setDragState((prev) => ({
          ...prev,
          boxEndX: canvasPos.x,
          boxEndY: canvasPos.y,
          hasMoved: true,
        }));
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      const ds = dragStateRef.current;
      if (!ds.type) return;

      if (ds.type === 'node' || ds.type === 'subtree') {
        if (ds.hasMoved) {
          // 重排
          const nodes = store.nodesRef.current;
          const root = getRootNode(nodes);
          if (root && ds.nodeId) {
            // 检查是否有节点跨越中线（从左到右或反之）
            const movedNode = nodes.find((n) => n.id === ds.nodeId);
            if (movedNode && movedNode.parentId === root.id) {
              // 一级节点拖拽，重排两侧
              let rearranged = rearrangeSide(nodes, root.id, true);
              rearranged = rearrangeSide(rearranged, root.id, false);
              syncNodes(rearranged);
            } else if (movedNode && movedNode.parentId) {
              // 非一级节点，只重排所在侧
              const side = isLeftSide(nodes, ds.nodeId);
              // 但如果一级节点拖拽了，还是要同时重排两侧
              // 检查是否拖拽了一级节点
              const movedIds = ds.type === 'node' ? ds.idsToMove || [ds.nodeId!] : getSubtreeIds(nodes, ds.nodeId!);
              const hasFirstLevel = movedIds.some((id: string) => {
                const n = nodes.find((nn) => nn.id === id);
                return n && n.parentId === root.id;
              });

              if (hasFirstLevel) {
                let rearranged = rearrangeSide(nodes, root.id, true);
                rearranged = rearrangeSide(rearranged, root.id, false);
                syncNodes(rearranged);
              } else {
                const rearranged = rearrangeSide(nodes, root.id, side);
                syncNodes(rearranged);
              }
            }
          }
          endBatch();
        } else {
          // 点击（没移动） - 如果不是 shift+click 且不是多选中的节点
          if (ds.nodeId) {
            const additive = e.shiftKey || e.ctrlKey || e.metaKey;
            if (!additive) {
              selectNode(ds.nodeId);
            }
          }
          // 不记录历史
          store.beginBatch();
          store.endBatch();
        }
      } else if (ds.type === 'box') {
        if (ds.hasMoved) {
          // 选择框选区域内的节点
          const minX = Math.min(ds.boxStartX, ds.boxEndX);
          const maxX = Math.max(ds.boxStartX, ds.boxEndX);
          const minY = Math.min(ds.boxStartY, ds.boxEndY);
          const maxY = Math.max(ds.boxStartY, ds.boxEndY);

          const selected = store.nodesRef.current.filter((n) =>
            n.x + n.width >= minX && n.x <= maxX &&
            n.y + n.height >= minY && n.y <= maxY
          ).map((n) => n.id);

          setMultiSelection(selected);
        } else {
          clearSelection();
        }
      }

      setDragState({
        type: null,
        startMouseX: 0,
        startMouseY: 0,
        nodeId: null,
        nodeStartX: 0,
        nodeStartY: 0,
        hasMoved: false,
        boxStartX: 0,
        boxStartY: 0,
        boxEndX: 0,
        boxEndY: 0,
      });
    };

    if (dragState.type) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      return () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
    }
  }, [dragState.type, zoom, screenToCanvas, setPanOffset, batchMoveNodesRaw, moveSubtreeRaw, endBatch, selectNode, clearSelection, setMultiSelection, syncNodes, store]);

  // 键盘快捷键
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // 如果正在编辑文本，不处理快捷键
      if (editingId) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'Tab') {
        e.preventDefault();
        if (selectedIds.size === 1) {
          const id = Array.from(selectedIds)[0];
          addChildNode(id);
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIds.size === 1) {
          const id = Array.from(selectedIds)[0];
          const node = store.nodesRef.current.find((n) => n.id === id);
          if (node && node.parentId) {
            addSiblingNode(id);
          } else {
            // 根节点Enter编辑
            startEditing(id);
          }
        } else if (selectedIds.size === 1) {
          const id = Array.from(selectedIds)[0];
          startEditing(id);
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (selectedIds.size > 0) {
          if (selectedIds.size === 1) {
            deleteNode(Array.from(selectedIds)[0]);
          } else {
            batchDelete(Array.from(selectedIds));
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (((e.ctrlKey || e.metaKey) && e.key === 'y') || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        redo();
      } else if (e.key === 'F2') {
        e.preventDefault();
        if (selectedIds.size === 1) {
          startEditing(Array.from(selectedIds)[0]);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedIds, editingId, addChildNode, addSiblingNode, deleteNode, batchDelete, undo, redo, startEditing, store]);

  // 编辑文本
  useEffect(() => {
    if (editingId) {
      const node = nodes.find((n) => n.id === editingId);
      if (node) {
        setEditText(node.text);
        setTimeout(() => {
          editInputRef.current?.focus();
          editInputRef.current?.select();
        }, 0);
      }
    }
  }, [editingId, nodes]);

  // 缩放（滚轮）
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    const newZoom = Math.max(0.2, Math.min(3, zoom + delta * zoom));
    setZoomLevel(newZoom);
  }, [zoom, setZoomLevel]);

  // 双击编辑
  const onNodeDoubleClick = useCallback((e: React.MouseEvent, node: MindNode) => {
    e.stopPropagation();
    startEditing(node.id);
  }, [startEditing]);

  // 编辑输入框按键
  const onEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (editingId) {
        updateNodeText(editingId, editText);
      }
      stopEditing();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      stopEditing();
    }
    e.stopPropagation();
  }, [editingId, editText, updateNodeText, stopEditing]);

  // 计算所有连接线
  const connections: { path: string; key: string }[] = [];
  for (const node of nodes) {
    if (node.parentId) {
      const parent = nodes.find((n) => n.id === node.parentId);
      if (parent) {
        connections.push({
          path: getConnectionPath(parent, node),
          key: `${parent.id}-${node.id}`,
        });
      }
    }
  }

  // 框选矩形
  const boxStyle: CSSProperties | null = dragState.type === 'box' && dragState.hasMoved ? {
    position: 'absolute',
    left: Math.min(dragState.boxStartX, dragState.boxEndX),
    top: Math.min(dragState.boxStartY, dragState.boxEndY),
    width: Math.abs(dragState.boxEndX - dragState.boxStartX),
    height: Math.abs(dragState.boxEndY - dragState.boxStartY),
  } : null;

  return (
    <div
      ref={canvasRef}
      className="relative w-full h-full overflow-hidden"
      style={{ backgroundColor: '#f8fafc', cursor: dragState.type === 'pan' ? 'grabbing' : 'default' }}
      onMouseDown={onCanvasMouseDown}
      onWheel={onWheel}
    >
      {/* 缩放/平移容器 */}
      <div
        ref={contentRef}
        className="absolute"
        style={{
          transformOrigin: '0 0',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          width: canvasConfig.width,
          height: canvasConfig.height,
        }}
      >
        {/* 网格背景 */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, #e2e8f0 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* 连接线 */}
        <svg
          className="mind-connections"
          style={{ width: canvasConfig.width, height: canvasConfig.height }}
        >
          {connections.map((conn) => (
            <path
              key={conn.key}
              d={conn.path}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={2}
              strokeLinecap="round"
            />
          ))}
        </svg>

        {/* 节点 */}
        {nodes.map((node) => {
          const isSelected = selectedIds.has(node.id);
          const isEditing = editingId === node.id;
          const isRoot = node.parentId === null;

          return (
            <div
              key={node.id}
              className={`absolute flex items-center justify-center select-none ${isSelected ? 'ring-2 ring-indigo-400 ring-offset-2' : ''}`}
              style={{
                left: node.x,
                top: node.y,
                width: node.width,
                height: node.height,
                ...getNodeShape(node.style),
                cursor: 'move',
                boxShadow: isRoot ? '0 4px 15px rgba(0,0,0,0.15)' : '0 2px 6px rgba(0,0,0,0.08)',
                zIndex: isSelected ? 10 : 1,
                padding: '4px 8px',
                boxSizing: 'border-box',
                transition: 'box-shadow 0.15s ease',
              }}
              onMouseDown={(e) => onNodeMouseDown(e, node)}
              onDoubleClick={(e) => onNodeDoubleClick(e, node)}
            >
              {isEditing ? (
                <input
                  ref={editInputRef}
                  className="node-edit-input"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={onEditKeyDown}
                  onBlur={() => {
                    if (editingId) {
                      updateNodeText(editingId, editText);
                      stopEditing();
                    }
                  }}
                  style={{
                    textAlign: 'center',
                    color: node.style.text,
                    fontSize: node.style.fontSize,
                    fontWeight: node.style.bold ? 'bold' : 'normal',
                    fontStyle: node.style.italic ? 'italic' : 'normal',
                  }}
                />
              ) : (
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    width: '100%',
                    textAlign: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  {node.text}
                </span>
              )}
            </div>
          );
        })}

        {/* 框选区域 */}
        {boxStyle && (
          <div className="selection-box absolute" style={boxStyle} />
        )}
      </div>

      {/* 状态栏 */}
      <div className="absolute bottom-2 left-2 flex items-center gap-3 bg-white/80 backdrop-blur px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 text-xs text-slate-600">
        <span>缩放: {Math.round(zoom * 100)}%</span>
        <span className="text-slate-300">|</span>
        <span>节点: {nodes.length}</span>
        <span className="text-slate-300">|</span>
        <span>选中: {selectedIds.size}</span>
      </div>
    </div>
  );
}

// 辅助函数
function getSubtreeIds(nodes: MindNode[], id: string): string[] {
  const subtree = getSubtree(nodes, id);
  return subtree.map((n) => n.id);
}
