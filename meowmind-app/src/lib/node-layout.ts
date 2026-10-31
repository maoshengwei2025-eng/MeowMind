import type { MindNode } from './mind-types';
import {
  getRootNode,
  getFirstLevelNodes,
  getDirectChildren,
  isLeftSide,
} from './mind-types';

/**
 * 重排指定侧的一级节点及其子树
 * 
 * 左侧节点：右对齐（找到该侧最右的右边缘作为基准）
 * 右侧节点：左对齐（找到该侧最左的左边缘作为基准）
 */
export function rearrangeSide(
  nodes: MindNode[],
  rootId: string,
  leftSide: boolean
): MindNode[] {
  const root = nodes.find((n) => n.id === rootId);
  if (!root) return nodes;

  const firstLevelNodes = getFirstLevelNodes(nodes)
    .filter((n) => isLeftSide(nodes, n.id) === leftSide);

  if (firstLevelNodes.length === 0) return nodes;

  // 按Y坐标排序
  const sortedNodes = firstLevelNodes.sort((a, b) => a.y - b.y);

  let result = [...nodes];

  // 计算一级节点的目标X位置
  const hSpacing = 60;
  if (leftSide) {
    // 左侧：右对齐
    // 计算一级节点宽度（取最大值用于对齐）
    const maxX = root.x - hSpacing;
    // 找到该侧所有一级节点中最宽的节点
    // 一级节点的右边缘应该统一对齐
    for (const node of sortedNodes) {
      const targetRightEdge = maxX;
      const newX = targetRightEdge - node.width;
      result = result.map((n) => n.id === node.id ? { ...n, x: newX } : n);
    }
  } else {
    // 右侧：左对齐
    const minX = root.x + root.width + hSpacing;
    for (const node of sortedNodes) {
      const newX = minX;
      result = result.map((n) => n.id === node.id ? { ...n, x: newX } : n);
    }
  }

  // 递归排列子节点
  for (const fln of sortedNodes) {
    const currentfln = result.find((n) => n.id === fln.id)!;
    result = arrangeChildren(result, currentfln, leftSide);
  }

  return result;
}

/**
 * 递归排列子节点
 */
function arrangeChildren(
  nodes: MindNode[],
  parentNode: MindNode,
  leftSide: boolean
): MindNode[] {
  let result = [...nodes];
  const directChildren = getDirectChildren(result, parentNode.id)
    .sort((a, b) => a.y - b.y);

  if (directChildren.length === 0) return result;

  const vSpacing = 20;
  const hSpacing = 60;

  // 计算每个子树的高度
  const treeHeights = directChildren.map((c) => getTreeHeight(result, c.id));

  // 总高度
  const totalHeight = treeHeights.reduce((sum, h) => sum + h, 0) +
    vSpacing * (directChildren.length - 1);

  // 从父节点中心向上偏移
  let currentY = parentNode.y + parentNode.height / 2 - totalHeight / 2;

  for (let i = 0; i < directChildren.length; i++) {
    const child = directChildren[i];
    const treeHeight = treeHeights[i];

    // 设置子节点的Y坐标
    const newChildY = currentY + (treeHeight - child.height) / 2;

    // 设置子节点的X坐标
    let newChildX: number;
    if (leftSide) {
      newChildX = parentNode.x - hSpacing - child.width;
    } else {
      newChildX = parentNode.x + parentNode.width + hSpacing;
    }

    result = result.map((n) =>
      n.id === child.id ? { ...n, x: newChildX, y: newChildY } : n
    );

    // 递归排列子节点的子节点
    const updatedChild = result.find((n) => n.id === child.id)!;
    result = arrangeChildren(result, updatedChild, leftSide);

    currentY += treeHeight + vSpacing;
  }

  return result;
}

/**
 * 获取节点子树的总高度
 */
function getTreeHeight(nodes: MindNode[], nodeId: string): number {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return 0;

  const children = getDirectChildren(nodes, nodeId);
  if (children.length === 0) {
    return node.height;
  }

  const vSpacing = 20;
  const sortedChildren = children.sort((a, b) => a.y - b.y);
  let totalHeight = 0;
  for (let i = 0; i < sortedChildren.length; i++) {
    totalHeight += getTreeHeight(nodes, sortedChildren[i].id);
    if (i < sortedChildren.length - 1) {
      totalHeight += vSpacing;
    }
  }

  return Math.max(node.height, totalHeight);
}

/**
 * 获取节点子树的所有后代节点的Y范围
 */
export function getSubtreeYRange(nodes: MindNode[], nodeId: string): { minY: number; maxY: number } {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return { minY: 0, maxY: 0 };

  let minY = node.y;
  let maxY = node.y + node.height;

  const descendants = getDescendants(nodes, nodeId);
  for (const d of descendants) {
    minY = Math.min(minY, d.y);
    maxY = Math.max(maxY, d.y + d.height);
  }

  return { minY, maxY };
}

/**
 * 获取后代节点（内联在这里避免循环依赖）
 */
function getDescendants(nodes: MindNode[], id: string): MindNode[] {
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
