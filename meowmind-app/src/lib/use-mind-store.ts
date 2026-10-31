import { useCallback, useRef, useState } from 'react';
import type { CanvasConfig, MindNode, NodeStyle } from './mind-types';
import {
  DEFAULT_CANVAS_CONFIG,
  DEFAULT_NODE_STYLE,
  ROOT_NODE_STYLE,
  genId,
  getDirectChildren,
  getRootNode,
  getFirstLevelNodes,
  getDescendants,
  getSubtree,
  isLeftSide,
} from './mind-types';
import { rearrangeSide } from './node-layout';

// 历史记录管理
interface HistoryState {
  past: MindNode[][];
  present: MindNode[];
  future: MindNode[][];
}

const MAX_HISTORY = 50;

function createHistoryManager(): {
  getState: () => HistoryState;
  setState: (s: HistoryState) => void;
  push: (nodes: MindNode[]) => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  undo: () => MindNode[] | null;
  redo: () => MindNode[] | null;
  init: (nodes: MindNode[]) => void;
} {
  const state: HistoryState = { past: [], present: [], future: [] };

  return {
    getState: () => state,
    setState: (s: HistoryState) => {
      state.past = s.past;
      state.present = s.present;
      state.future = s.future;
    },
    push: (nodes: MindNode[]) => {
      state.past = [...state.past, state.present].slice(-MAX_HISTORY);
      state.present = nodes.map((n) => ({ ...n }));
      state.future = [];
    },
    canUndo: () => state.past.length > 0,
    canRedo: () => state.future.length > 0,
    undo: (): MindNode[] | null => {
      if (state.past.length === 0) return null;
      const previous: MindNode[] = state.past[state.past.length - 1];
      state.future = [state.present, ...state.future];
      state.past = state.past.slice(0, -1);
      state.present = previous;
      return state.present.map((n) => ({ ...n }));
    },
    redo: (): MindNode[] | null => {
      if (state.future.length === 0) return null;
      const next: MindNode[] = state.future[0];
      state.past = [...state.past, state.present];
      state.future = state.future.slice(1);
      state.present = next;
      return state.present.map((n) => ({ ...n }));
    },
    init: (nodes: MindNode[]) => {
      state.past = [];
      state.present = nodes.map((n) => ({ ...n }));
      state.future = [];
    },
  };
}

// 创建初始数据
function createInitialNodes(): MindNode[] {
  const rootId = genId();
  const leftChildId = genId();
  const rightChildId = genId();
  const rightGrandChildId = genId();

  return [
    {
      id: rootId,
      parentId: null,
      text: '喵呜导图',
      x: 1900,
      y: 1450,
      width: 200,
      height: 60,
      style: { ...ROOT_NODE_STYLE },
      linkOverride: null,
    },
    {
      id: leftChildId,
      parentId: rootId,
      text: '核心功能',
      x: 1620,
      y: 1410,
      width: 160,
      height: 44,
      style: { ...DEFAULT_NODE_STYLE, bg: '#ec4899', border: '#db2777' },
      linkOverride: null,
    },
    {
      id: rightChildId,
      parentId: rootId,
      text: '技术栈',
      x: 2120,
      y: 1390,
      width: 160,
      height: 44,
      style: { ...DEFAULT_NODE_STYLE, bg: '#10b981', border: '#059669' },
      linkOverride: null,
    },
    {
      id: rightGrandChildId,
      parentId: rightChildId,
      text: 'React 19',
      x: 2320,
      y: 1400,
      width: 140,
      height: 40,
      style: { ...DEFAULT_NODE_STYLE, bg: '#f59e0b', border: '#d97706' },
      linkOverride: null,
    },
  ];
}

export function useMindStore() {
  const [nodes, setNodes] = useState<MindNode[]>(() => createInitialNodes());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [canvasConfig, setCanvasConfig] = useState<CanvasConfig>(DEFAULT_CANVAS_CONFIG);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const batchStartStateRef = useRef<MindNode[] | null>(null);

  const historyManagerRef = useRef(createHistoryManager());
  // 初始化历史
  if (historyManagerRef.current.getState().present.length === 0) {
    historyManagerRef.current.init(nodes);
  }

  // 同步状态
  const syncNodes = useCallback((newNodes: MindNode[], pushHistory: boolean = true) => {
    nodesRef.current = newNodes;
    setNodes(newNodes);
    if (pushHistory) {
      historyManagerRef.current.push(newNodes);
      setHistoryVersion((v) => v + 1);
    }
  }, []);

  // 选择节点
  const selectNode = useCallback((id: string, additive: boolean = false) => {
    setSelectedIds((prev) => {
      if (additive) {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }
      return new Set([id]);
    });
    setEditingId(null);
  }, []);

  // 清除选择
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setEditingId(null);
  }, []);

  // 设置多选
  const setMultiSelection = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
    setEditingId(null);
  }, []);

  // 开始编辑
  const startEditing = useCallback((id: string) => {
    setSelectedIds(new Set([id]));
    setEditingId(id);
  }, []);

  // 结束编辑
  const stopEditing = useCallback(() => {
    setEditingId(null);
  }, []);

  // 更新节点文本
  const updateNodeText = useCallback((id: string, text: string) => {
    const newNodes = nodesRef.current.map((n) =>
      n.id === id ? { ...n, text } : n
    );
    syncNodes(newNodes);
  }, [syncNodes]);

  // 更新节点样式
  const updateNodeStyle = useCallback((id: string, style: Partial<NodeStyle>) => {
    const newNodes = nodesRef.current.map((n) =>
      n.id === id ? { ...n, style: { ...n.style, ...style } } : n
    );
    syncNodes(newNodes);
  }, [syncNodes]);

  // 批量更新节点样式
  const batchUpdateStyle = useCallback((ids: string[], style: Partial<NodeStyle>) => {
    const idSet = new Set(ids);
    const newNodes = nodesRef.current.map((n) =>
      idSet.has(n.id) ? { ...n, style: { ...n.style, ...style } } : n
    );
    syncNodes(newNodes);
  }, [syncNodes]);

  // 更新节点尺寸
  const updateNodeSize = useCallback((id: string, width: number, height: number) => {
    const newNodes = nodesRef.current.map((n) =>
      n.id === id ? { ...n, width, height, resizeCount: (n.resizeCount || 0) + 1 } : n
    );
    syncNodes(newNodes);
  }, [syncNodes]);

  // 批量更新节点尺寸
  const batchUpdateSize = useCallback((ids: string[], width: number | null, height: number | null) => {
    const idSet = new Set(ids);
    const newNodes = nodesRef.current.map((n) =>
      idSet.has(n.id)
        ? {
            ...n,
            width: width !== null ? width : n.width,
            height: height !== null ? height : n.height,
            resizeCount: (n.resizeCount || 0) + 1,
          }
        : n
    );
    syncNodes(newNodes);
  }, [syncNodes]);

  // 移动节点（不记录历史）
  const moveNodeRaw = useCallback((id: string, dx: number, dy: number) => {
    const newNodes = nodesRef.current.map((n) =>
      n.id === id ? { ...n, x: n.x + dx, y: n.y + dy } : n
    );
    nodesRef.current = newNodes;
    setNodes(newNodes);
  }, []);

  // 批量移动节点（不记录历史）
  const batchMoveNodesRaw = useCallback((ids: string[], dx: number, dy: number) => {
    const idSet = new Set(ids);
    const newNodes = nodesRef.current.map((n) =>
      idSet.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n
    );
    nodesRef.current = newNodes;
    setNodes(newNodes);
  }, []);

  // 移动子树（不记录历史）
  const moveSubtreeRaw = useCallback((id: string, dx: number, dy: number) => {
    const subtree = getSubtree(nodesRef.current, id);
    const idSet = new Set(subtree.map((n) => n.id));
    const newNodes = nodesRef.current.map((n) =>
      idSet.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n
    );
    nodesRef.current = newNodes;
    setNodes(newNodes);
  }, []);

  // 开始批量操作
  const beginBatch = useCallback(() => {
    batchStartStateRef.current = nodesRef.current.map((n) => ({ ...n }));
  }, []);

  // 结束批量操作
  const endBatch = useCallback(() => {
    const startState = batchStartStateRef.current;
    if (!startState) return;
    const endState = nodesRef.current;
    // 比较是否有变化
    const hasChanges = startState.some((sn, i) => {
      const en = endState[i];
      if (!en) return true;
      return sn.x !== en.x || sn.y !== en.y || sn.width !== en.width || sn.height !== en.height;
    }) || startState.length !== endState.length;

    if (hasChanges) {
      historyManagerRef.current.push(endState);
      setHistoryVersion((v) => v + 1);
    }
    batchStartStateRef.current = null;
  }, []);

  // 直接设置节点（不记录历史）
  const setNodesRaw = useCallback((newNodes: MindNode[]) => {
    nodesRef.current = newNodes;
    setNodes(newNodes);
  }, []);

  // 添加子节点（Tab）
  const addChildNode = useCallback((parentId: string) => {
    const parent = nodesRef.current.find((n) => n.id === parentId);
    if (!parent) return;

    const newId = genId();
    const width = 140;
    const height = 40;
    const isLeft = isLeftSide(nodesRef.current, parentId) || (parent.parentId === null ? false : false);

    // 新子节点位置：父节点旁边
    let newX: number;
    let newY: number;

    if (parent.parentId === null) {
      // 父节点是根节点
      const existingChildren = getDirectChildren(nodesRef.current, parentId);
      const rightChildren = existingChildren.filter((c) => c.x >= parent.x);
      const leftChildren = existingChildren.filter((c) => c.x < parent.x);

      if (rightChildren.length <= leftChildren.length) {
        // 右侧
        newX = parent.x + parent.width + 60;
      } else {
        // 左侧
        newX = parent.x - 60 - width;
      }
      // 垂直位置
      if (existingChildren.length === 0) {
        newY = parent.y + parent.height / 2 - height / 2;
      } else {
        const maxY = existingChildren.reduce((max, c) => Math.max(max, c.y + c.height), 0);
        newY = maxY + 20;
      }
    } else {
      // 非根节点
      const side = isLeftSide(nodesRef.current, parentId);
      if (side) {
        newX = parent.x - 60 - width;
      } else {
        newX = parent.x + parent.width + 60;
      }
      const siblings = getDirectChildren(nodesRef.current, parentId);
      if (siblings.length === 0) {
        newY = parent.y + parent.height / 2 - height / 2;
      } else {
        const maxY = siblings.reduce((max, c) => Math.max(max, c.y + c.height), 0);
        newY = maxY + 20;
      }
    }

    const newNode: MindNode = {
      id: newId,
      parentId,
      text: '新节点',
      x: newX,
      y: newY,
      width,
      height,
      style: { ...DEFAULT_NODE_STYLE },
      linkOverride: null,
    };

    const newNodes = [...nodesRef.current, newNode];
    syncNodes(newNodes);

    // 重排
    const root = getRootNode(newNodes);
    if (root) {
      const rearranged = rearrangeSide(newNodes, root.id, isLeftSide(newNodes, newId));
      const finalNodes = rearrangeSide(rearranged, root.id, !isLeftSide(newNodes, newId));
      syncNodes(finalNodes);
    }

    setSelectedIds(new Set([newId]));
    setEditingId(newId);
  }, [syncNodes]);

  // 添加同级节点（Enter）
  const addSiblingNode = useCallback((nodeId: string) => {
    const node = nodesRef.current.find((n) => n.id === nodeId);
    if (!node || !node.parentId) return; // 不能给根节点添加同级

    const parent = nodesRef.current.find((n) => n.id === node.parentId);
    if (!parent) return;

    const newId = genId();
    const width = node.width;
    const height = node.height;
    const isLeft = isLeftSide(nodesRef.current, nodeId);

    // X坐标对齐
    const newNodeX = isLeft ? node.x : node.x;

    // Y坐标：选中节点底部 + 间距
    const siblings = getDirectChildren(nodesRef.current, parent.id);
    const nodeIndex = siblings.findIndex((s) => s.id === nodeId);
    const nodeTreeHeight = getTreeHeightOfNode(nodesRef.current, nodeId);

    let newNodeY: number;
    if (nodeIndex === siblings.length - 1) {
      newNodeY = node.y + nodeTreeHeight + 20;
    } else {
      // 在中间插入
      const nextSibling = siblings[nodeIndex + 1];
      newNodeY = (node.y + nodeTreeHeight + 20 + nextSibling.y) / 2;
    }

    const newNode: MindNode = {
      id: newId,
      parentId: node.parentId,
      text: '新节点',
      x: newNodeX,
      y: newNodeY,
      width,
      height,
      style: { ...node.style },
      linkOverride: null,
    };

    const newNodes = [...nodesRef.current, newNode];
    syncNodes(newNodes);

    // 重排
    const root = getRootNode(newNodes);
    if (root) {
      const rearranged = rearrangeSide(newNodes, root.id, isLeft);
      syncNodes(rearranged);
    }

    setSelectedIds(new Set([newId]));
    setEditingId(newId);
  }, [syncNodes]);

  // 删除节点（Delete）
  const deleteNode = useCallback((nodeId: string) => {
    const node = nodesRef.current.find((n) => n.id === nodeId);
    if (!node || node.parentId === null) return; // 不能删除根节点

    const descendants = getDescendants(nodesRef.current, nodeId);
    const idSet = new Set([nodeId, ...descendants.map((d) => d.id)]);
    const newNodes = nodesRef.current.filter((n) => !idSet.has(n.id));
    syncNodes(newNodes);

    // 重排两侧
    const root = getRootNode(newNodes);
    if (root) {
      let rearranged = rearrangeSide(newNodes, root.id, true);
      rearranged = rearrangeSide(rearranged, root.id, false);
      syncNodes(rearranged);
    }

    setSelectedIds(new Set());
  }, [syncNodes]);

  // 批量删除
  const batchDelete = useCallback((ids: string[]) => {
    const root = getRootNode(nodesRef.current);
    if (!root) return;
    // 不能删根节点
    const safeIds = ids.filter((id) => id !== root.id);
    if (safeIds.length === 0) return;

    const allIds = new Set<string>();
    for (const id of safeIds) {
      allIds.add(id);
      const desc = getDescendants(nodesRef.current, id);
      desc.forEach((d) => allIds.add(d.id));
    }

    const newNodes = nodesRef.current.filter((n) => !allIds.has(n.id));
    syncNodes(newNodes);

    let rearranged = rearrangeSide(newNodes, root.id, true);
    rearranged = rearrangeSide(rearranged, root.id, false);
    syncNodes(rearranged);

    setSelectedIds(new Set());
  }, [syncNodes]);

  // 撤销
  const undo = useCallback(() => {
    const result = historyManagerRef.current.undo();
    if (result) {
      nodesRef.current = result;
      setNodes(result);
      setHistoryVersion((v) => v + 1);
      setSelectedIds(new Set());
    }
  }, []);

  // 重做
  const redo = useCallback(() => {
    const result = historyManagerRef.current.redo();
    if (result) {
      nodesRef.current = result;
      setNodes(result);
      setHistoryVersion((v) => v + 1);
      setSelectedIds(new Set());
    }
  }, []);

  // 缩放
  const setZoomLevel = useCallback((z: number) => {
    setZoom(Math.max(0.2, Math.min(3, z)));
  }, []);

  // 平移
  const setPanOffset = useCallback((x: number, y: number) => {
    setPan({ x, y });
  }, []);

  // 重置视图
  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // 适应屏幕
  const fitToScreen = useCallback(() => {
    const root = getRootNode(nodesRef.current);
    if (!root) return;
    setZoom(1);
    setPan({ x: -root.x + 300, y: -root.y + 200 });
  }, []);

  return {
    nodes,
    selectedIds,
    canvasConfig,
    zoom,
    pan,
    editingId,
    historyVersion,
    canUndo: historyManagerRef.current.canUndo(),
    canRedo: historyManagerRef.current.canRedo(),
    nodesRef,
    selectedIdsRef,
    selectNode,
    clearSelection,
    setMultiSelection,
    startEditing,
    stopEditing,
    updateNodeText,
    updateNodeStyle,
    batchUpdateStyle,
    updateNodeSize,
    batchUpdateSize,
    moveNodeRaw,
    batchMoveNodesRaw,
    moveSubtreeRaw,
    beginBatch,
    endBatch,
    setNodesRaw,
    syncNodes,
    addChildNode,
    addSiblingNode,
    deleteNode,
    batchDelete,
    undo,
    redo,
    setZoomLevel,
    setPanOffset,
    resetView,
    fitToScreen,
    setCanvasConfig,
  };
}

// 辅助函数：获取节点子树高度
function getTreeHeightOfNode(nodes: MindNode[], nodeId: string): number {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return 0;
  const children = getDirectChildren(nodes, nodeId);
  if (children.length === 0) {
    return node.height;
  }
  const sortedChildren = children.sort((a, b) => a.y - b.y);
  let totalHeight = 0;
  for (let i = 0; i < sortedChildren.length; i++) {
    const childHeight = getTreeHeightOfNode(nodes, sortedChildren[i].id);
    totalHeight += childHeight;
    if (i < sortedChildren.length - 1) {
      totalHeight += 20;
    }
  }
  return Math.max(node.height, totalHeight);
}
