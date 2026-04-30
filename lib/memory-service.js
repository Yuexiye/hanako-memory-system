/**
 * Hanako Memory Service v2
 *
 * 记忆系统核心服务。纯文件系统操作，无外部 Python 依赖。
 * 存储层：Obsidian vault（.md 文件 + 双链 + frontmatter）
 *
 * 设计参考：
 * - graph-memory（adoresever）：三元组提取模式
 * - self-improving-agent（peterskoett）：学习/错误双层记录
 * - openclaw/skills：SKILL.md 标准化组织
 */

import * as ObsidianOps from './obsidian-ops.js';

export class MemoryService {
  constructor(ctx) {
    this.ctx = ctx;
    this.config = ctx?.config || {};
    // Obsidian vault 路径
    this.vaultPath = this.config.vaultPath || 'W:/Games/Obsidian/Work/无极限';
  }

  // ─── 实体管理 ────────────────────────────────────────

  /**
   * 创建实体笔记
   * @param {Object} entity - { name, type, properties, tags }
   */
  createEntity(entity) {
    if (!entity.name || !entity.type) {
      throw new Error('实体必须包含 name 和 type');
    }
    return ObsidianOps.createEntityNote(entity, this.vaultPath);
  }

  /**
   * 更新实体笔记
   * @param {string} entityPath - 实体在 vault 中的相对路径
   * @param {Object} updates - { properties, section, content }
   */
  updateEntity(entityPath, updates) {
    return ObsidianOps.updateEntityNote(entityPath, updates, this.vaultPath);
  }

  /**
   * 读取实体笔记
   */
  readEntity(entityPath) {
    return ObsidianOps.readEntityNote(entityPath, this.vaultPath);
  }

  // ─── 关系管理 ────────────────────────────────────────

  /**
   * 添加关系
   * @param {string} fromEntityPath
   * @param {string} toEntity
   * @param {string} relationType
   */
  addRelation(fromEntityPath, toEntity, relationType) {
    return ObsidianOps.addRelation(fromEntityPath, toEntity, relationType, this.vaultPath);
  }

  // ─── 学习与错误 ──────────────────────────────────────

  /**
   * 添加学习记录
   * @param {Object} learning - { content, category, priority, source }
   */
  addLearning(learning) {
    return ObsidianOps.addLearning(learning, this.vaultPath);
  }

  /**
   * 添加错误记录（双层模式）
   * @param {Object} error - { content, severity, relatedEntity, relatedEntityPath }
   */
  addError(error) {
    return ObsidianOps.addError(error, this.vaultPath);
  }

  // ─── 查询 ────────────────────────────────────────────

  /**
   * 获取会话上下文
   * @param {number} maxTokens
   */
  getContext(maxTokens = 2000) {
    return ObsidianOps.generateContext(this.vaultPath, maxTokens);
  }

  /**
   * 搜索记忆
   * @param {string} query
   */
  search(query) {
    return ObsidianOps.searchMemory(query, this.vaultPath);
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return ObsidianOps.getStats(this.vaultPath);
  }

  // ─── 初始化 ──────────────────────────────────────────

  /**
   * 初始化记忆系统目录
   */
  init() {
    return ObsidianOps.initMemorySystem(this.vaultPath);
  }

  // ─── 批量提取（核心入口） ─────────────────────────────

  /**
   * 从 LLM 提取的结构化 JSON 中批量写入记忆
   *
   * 输入格式（三元组）：
   * {
   *   entities: [{ name, type, properties?, tags? }],
   *   relations: [{ from, to, type }],
   *   learnings: [{ content, category, priority, source? }],
   *   errors: [{ content, severity, relatedEntity?, relatedEntityPath? }]
   * }
   *
   * @param {Object} extraction - LLM 提取的结构化数据
   * @returns {Object} 执行结果统计
   */
  extractFromLLM(extraction) {
    const result = {
      entities: { created: 0, skipped: 0 },
      relations: { added: 0 },
      learnings: { added: 0 },
      errors: { added: 0 },
    };

    // 1. 处理实体：先创建，记住路径
    const entityPathMap = new Map();
    if (extraction.entities && Array.isArray(extraction.entities)) {
      for (const entity of extraction.entities) {
        try {
          const notePath = this.createEntity(entity);
          entityPathMap.set(entity.name, notePath);
          // 如果实体已存在，createEntityNote 不会覆盖，但路径仍记录
          result.entities.created++;
        } catch (err) {
          result.entities.skipped++;
        }
      }
    }

    // 2. 处理关系
    if (extraction.relations && Array.isArray(extraction.relations)) {
      for (const rel of extraction.relations) {
        const fromPath = entityPathMap.get(rel.from) ||
          `记忆/实体/${this._guessEntityPath(rel.from, extraction.entities)}`;
        try {
          const ok = this.addRelation(fromPath, rel.to, rel.type);
          if (ok) result.relations.added++;
        } catch { /* skip */ }
      }
    }

    // 3. 处理学习
    if (extraction.learnings && Array.isArray(extraction.learnings)) {
      for (const learning of extraction.learnings) {
        try {
          this.addLearning(learning);
          result.learnings.added++;
        } catch { /* skip */ }
      }
    }

    // 4. 处理错误（双层模式）
    if (extraction.errors && Array.isArray(extraction.errors)) {
      for (const error of extraction.errors) {
        try {
          this.addError(error);
          result.errors.added++;
        } catch { /* skip */ }
      }
    }

    return result;
  }

  /**
   * 从实体列表中推测实体路径
   */
  _guessEntityPath(name, entities) {
    if (!entities) return '概念';
    const found = entities.find(e => e.name === name);
    return found?.type || '概念';
  }
}

/**
 * 创建记忆服务实例
 */
export function createMemoryService(ctx) {
  return new MemoryService(ctx);
}
