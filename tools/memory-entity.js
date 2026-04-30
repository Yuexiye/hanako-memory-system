/**
 * Memory Entity Tool
 * 管理单个实体笔记——创建、读取、更新
 */

import { createMemoryService } from '../lib/memory-service.js';
import { toToolError, toToolResult, formatEntityResult } from '../lib/tool-output.js';

export const name = "memory-entity";
export const description = "管理记忆系统中的单个实体笔记。支持创建（create）、读取（read）、更新（update）实体。" +
  "创建实体时自动生成带有 frontmatter 和标准区块（属性、关系、相关学习、相关错误）的 Obsidian 笔记。" +
  "更新实体时可追加内容到指定区块，或更新 frontmatter 属性。" +
  "读取实体时返回笔记的完整内容。";

export const parameters = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: ["create", "read", "update"],
      description: "操作类型：create 创建实体，read 读取实体，update 更新实体"
    },
    name: {
      type: "string",
      description: "实体名称（create 时必需，将作为笔记文件名）"
    },
    type: {
      type: "string",
      description: "实体类型（create 时必需），如 人物、项目、技能、概念"
    },
    properties: {
      type: "object",
      description: "实体属性（create/update 时可选），键值对，将写入 frontmatter 或属性区块"
    },
    tags: {
      type: "array",
      items: { type: "string" },
      description: "标签（create 时可选）"
    },
    path: {
      type: "string",
      description: "实体笔记在 vault 中的相对路径（read/update 时必需）"
    },
    section: {
      type: "string",
      description: "要更新的区块名（update 时可选），如 关系、相关学习"
    },
    content: {
      type: "string",
      description: "要追加的内容（update 时可选）"
    }
  },
  required: ["action"]
};

export async function execute(input = {}, ctx) {
  const service = createMemoryService(ctx);

  try {
    switch (input.action) {
      case 'create': {
        if (!input.name || !input.type) {
          return toToolError("create 操作需要 name 和 type 参数");
        }
        const notePath = service.createEntity({
          name: input.name,
          type: input.type,
          properties: input.properties || {},
          tags: input.tags || [],
        });
        return toToolResult(`实体已创建: ${notePath}`);
      }

      case 'read': {
        if (!input.path) {
          return toToolError("read 操作需要 path 参数");
        }
        const entity = service.readEntity(input.path);
        return toToolResult(formatEntityResult(entity));
      }

      case 'update': {
        if (!input.path) {
          return toToolError("update 操作需要 path 参数");
        }
        const result = service.updateEntity(input.path, {
          properties: input.properties,
          section: input.section,
          content: input.content,
        });
        return toToolResult(result.success ? '实体已更新' : result.error);
      }

      default:
        return toToolError(`未知操作: ${input.action}`);
    }
  } catch (error) {
    return toToolError(error);
  }
}
