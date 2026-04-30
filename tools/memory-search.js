/**
 * Memory Search Tool
 * 搜索 Obsidian vault 中的记忆
 */

import { createMemoryService } from '../lib/memory-service.js';
import { toToolError, toToolResult, formatSearchResults } from '../lib/tool-output.js';

export const name = "memory-search";
export const description = "搜索 Hanako 记忆系统（Obsidian vault），查找相关的实体、学习记录和错误记录。使用自然语言关键词查询。";

export const parameters = {
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "搜索查询，使用自然语言关键词"
    }
  },
  required: ["query"]
};

export async function execute(input = {}, ctx) {
  const service = createMemoryService(ctx);

  if (!input.query) {
    return toToolError("query 参数是必需的");
  }

  try {
    const results = service.search(input.query);
    return toToolResult(formatSearchResults(results));
  } catch (error) {
    return toToolError(error);
  }
}
