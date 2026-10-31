// 节点类型
export interface MindNode {
  id: string;
  parentId: string | null;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  style: NodeStyle;
  linkOverride: string | null;
  resizeCount?: number;
}

// 节点样式
export interface NodeStyle {
  bg: string;
  text: string;
  border: string;
  borderWidth: number;
  fontSize: number;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
  shape: 'rect' | 'rounded' | 'ellipse';
}

// 画布配置
export interface CanvasConfig {
  width: number;
  height: number;
  autoFit: boolean;
  nodeVerticalSpacing: number;
  nodeHorizontalSpacing: number;
  autoAdjustSpacing: boolean;
}

// 默认样式
export const DEFAULT_NODE_STYLE: NodeStyle = {
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

export const ROOT_NODE_STYLE: NodeStyle = {
  bg: '#1e293b',
  text: '#f8fafc',
  border: '#0f172a',
  borderWidth: 3,
  fontSize: 18,
  fontFamily: 'system-ui, sans-serif',
  bold: true,
  italic: false,
  shape: 'rounded',
};

export const DEFAULT_CANVAS_CONFIG: CanvasConfig = {
  width: 4000,
  height: 3000,
  autoFit: true,
  nodeVerticalSpacing: 20,
  nodeHorizontalSpacing: 60,
  autoAdjustSpacing: true,
};

// 生成唯一ID
export function genId(): string {
  return `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// 获取节点的所有后代节点ID
export function getDescendants(nodes: MindNode[], id: string): MindNode[] {
  const result: MindNode[] = [];
  const queue = [id];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = nodes.filter((n) => n.parentId === currentId);
    for (const child of children) {
      result.push(child);
      queue.push(child.id);
    }
  }
  return result;
}

// 获取节点的所有祖先节点ID
export function getAncestors(nodes: MindNode[], id: string): string[] {
  const result: string[] = [];
  let current = nodes.find((n) => n.id === id);
  while (current && current.parentId) {
    result.push(current.parentId);
    current = nodes.find((n) => n.id === current!.parentId);
  }
  return result;
}

// 获取节点的子树（含自身）
export function getSubtree(nodes: MindNode[], id: string): MindNode[] {
  const result: MindNode[] = [];
  const node = nodes.find((n) => n.id === id);
  if (!node) return result;
  result.push(node);
  const descendants = getDescendants(nodes, id);
  result.push(...descendants);
  return result;
}

// 判断节点是否在左侧
export function isLeftSide(nodes: MindNode[], nodeId: string): boolean {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return false;
  if (!node.parentId) return false;
  const parent = nodes.find((n) => n.id === node.parentId);
  if (!parent) return false;
  if (!parent.parentId) {
    // 父节点是根节点，根据x位置判断左右
    return node.x < parent.x;
  }
  // 递归向上找
  return isLeftSide(nodes, parent.id);
}

// 获取根节点
export function getRootNode(nodes: MindNode[]): MindNode | undefined {
  return nodes.find((n) => n.parentId === null);
}

// 获取一级子节点（根节点的直接子节点）
export function getFirstLevelNodes(nodes: MindNode[]): MindNode[] {
  const root = getRootNode(nodes);
  if (!root) return [];
  return nodes.filter((n) => n.parentId === root.id);
}

// 获取节点的直接子节点
export function getDirectChildren(nodes: MindNode[], parentId: string): MindNode[] {
  return nodes.filter((n) => n.parentId === parentId);
}

// 获取节点树的总高度
export function getTreeHeight(nodes: MindNode[], nodeId: string): number {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return 0;
  const children = getDirectChildren(nodes, nodeId);
  if (children.length === 0) {
    return node.height;
  }
  // 按Y坐标排序子节点
  const sortedChildren = children.sort((a, b) => a.y - b.y);
  let totalHeight = 0;
  for (let i = 0; i < sortedChildren.length; i++) {
    const childHeight = getTreeHeight(nodes, sortedChildren[i].id);
    totalHeight += childHeight;
    if (i < sortedChildren.length - 1) {
      totalHeight += 20; // 子节点间距
    }
  }
  return Math.max(node.height, totalHeight);
}
