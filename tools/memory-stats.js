/**
 * Memory Stats Tool
 * 获取记忆系统统计信息
 */

import { createMemoryService } from '../lib/memory-service.js';
import { toToolError, toToolResult, formatStats } from '../lib/tool-output.js';

export const name = "memory-stats";
export const description = "获取 Hanako 记忆系统统计信息，包括实体（按类型）、学习记录（按类别）、错误记录（按状态）的数量分布。";

export const parameters = {
  type: "object",
  properties: {},
  required: []
};

export async function execute(input = {}, ctx) {
  const service = createMemoryService(ctx);

  try {
    const stats = service.getStats();
    return toToolResult(formatStats(stats));
  } catch (error) {
    return toToolError(error);
  }
}
