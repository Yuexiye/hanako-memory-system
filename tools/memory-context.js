/**
 * Memory Context Tool
 * 获取记忆上下文——会话开始时自动注入
 */

import { createMemoryService } from '../lib/memory-service.js';
import { toToolError, toToolResult } from '../lib/tool-output.js';

export const name = "memory-context";
export const description = "获取 Hanako 记忆系统的上下文，用于在对话开始时加载相关记忆。返回结构化的记忆摘要，包括近期日记、高优先级学习、待修复错误等。应在每次会话开始时自动调用。";

export const parameters = {
  type: "object",
  properties: {
    maxTokens: {
      type: "number",
      description: "最大 Token 数（可选，默认 2000）"
    }
  },
  required: []
};

export async function execute(input = {}, ctx) {
  const service = createMemoryService(ctx);

  try {
    const context = service.getContext(input.maxTokens || 2000);
    return toToolResult(context);
  } catch (error) {
    return toToolError(error);
  }
}
