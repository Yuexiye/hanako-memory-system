/**
 * Memory Extract Tool
 * 从对话中提取结构化记忆（三元组模式）
 *
 * 这是记忆系统的核心入口。接收 LLM 生成的 JSON，
 * 批量写入实体、关系、学习、错误到 Obsidian vault。
 *
 * 参考：
 * - graph-memory：三元组提取
 * - self-improving-agent：学习/错误双层记录
 */

import { createMemoryService } from '../lib/memory-service.js';
import { toToolError, toToolResult, formatExtractResult } from '../lib/tool-output.js';

export const name = "memory-extract";
export const description = "从对话内容中提取结构化记忆（实体、关系、学习记录、错误记录），写入 Obsidian vault 记忆系统。接收 LLM 生成的三元组 JSON。应在重要对话结束时调用。";

export const parameters = {
  type: "object",
  properties: {
    extraction: {
      type: "object",
      description: "LLM 提取的结构化数据，格式：{ entities: [{name, type, properties?, tags?}], relations: [{from, to, type}], learnings: [{content, category, priority, source?}], errors: [{content, severity, relatedEntity?, relatedEntityPath?}] }"
    }
  },
  required: ["extraction"]
};

export async function execute(input = {}, ctx) {
  const service = createMemoryService(ctx);

  if (!input.extraction) {
    return toToolError("extraction 参数是必需的");
  }

  // 确保记忆目录存在
  try {
    service.init();
  } catch { /* 可能已存在 */ }

  try {
    const result = service.extractFromLLM(input.extraction);
    return toToolResult(formatExtractResult(result));
  } catch (error) {
    return toToolError(error);
  }
}
