/**
 * 动画引擎 - 节点动画效果
 */

export interface RevealConfig {
  duration: number;
  stagger: number;
}

const DEFAULT_CONFIG: RevealConfig = {
  duration: 300,
  stagger: 50,
};

/**
 * 获取节点的动画延迟
 */
export function getRevealDelay(depth: number, index: number, config: RevealConfig = DEFAULT_CONFIG): number {
  return depth * config.stagger + index * 20;
}

/**
 * 创建节点入场动画样式
 */
export function getNodeAnimationStyle(delay: number): React.CSSProperties {
  return {
    animation: `nodeEnter 0.3s ease-out ${delay}ms both`,
  };
}
