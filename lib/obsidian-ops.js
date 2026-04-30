/**
 * Obsidian Ops — Obsidian vault 文件操作核心库
 *
 * 职责：
 * 1. 创建/更新/读取实体笔记（.md + frontmatter）
 * 2. 管理双链关系
 * 3. 学习记录和错误记录的写入（双层模式）
 * 4. 搜索记忆
 * 5. 生成会话上下文
 *
 * 设计约束：
 * - 纯文件系统操作，无外部依赖
 * - 所有路径使用正斜杠
 * - 笔记格式兼容 Obsidian + Dataview
 */

import fs from 'fs';
import path from 'path';

// ─── 路径工具 ───────────────────────────────────────────

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function safePath(...segments) {
  return segments.join('/').replace(/\\/g, '/');
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function timestampStr() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

// ─── Frontmatter 操作 ───────────────────────────────────

/**
 * 解析 Markdown 文件的 frontmatter
 * 返回 { frontmatter: {}, body: '...' }
 */
function parseFrontmatter(content) {
  const lines = content.split('\n');
  if (lines[0]?.trim() !== '---') {
    return { frontmatter: {}, body: content };
  }

  const endIdx = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
  if (endIdx === -1) {
    return { frontmatter: {}, body: content };
  }

  const fmLines = lines.slice(1, endIdx);
  const body = lines.slice(endIdx + 1).join('\n');
  const frontmatter = {};

  for (const line of fmLines) {
    const match = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (match) {
      const key = match[1];
      let value = match[2].trim();
      // 解析 YAML 列表
      if (value.startsWith('[') && value.endsWith(']')) {
        try {
          value = JSON.parse(value.replace(/'/g, '"'));
        } catch { /* keep as string */ }
      }
      frontmatter[key] = value;
    }
  }

  return { frontmatter, body };
}

/**
 * 序列化 frontmatter 为 YAML 字符串
 */
function serializeFrontmatter(fm) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(fm)) {
    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.map(v => `'${v}'`).join(', ')}]`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

// ─── 实体笔记 CRUD ──────────────────────────────────────

/**
 * 创建实体笔记
 *
 * @param {Object} entity - { name, type, properties, tags }
 * @param {string} vaultPath - Obsidian vault 根路径
 * @returns {string} 创建的笔记路径（相对于 vault）
 */
export function createEntityNote(entity, vaultPath) {
  const { name, type, properties = {}, tags = [] } = entity;
  const dirPath = path.join(vaultPath, '记忆', '实体', type);
  ensureDir(dirPath);

  const fileName = `${name}.md`;
  const filePath = path.join(dirPath, fileName);
  const now = todayStr();

  // 如果已存在，不覆盖
  if (fs.existsSync(filePath)) {
    return safePath('记忆', '实体', type, fileName);
  }

  const allTags = [...new Set([...tags, type, 'memory'])];
  const fm = {
    type,
    created: now,
    updated: now,
    tags: allTags,
  };

  // 将 properties 转为 Markdown 表格
  let propsSection = '';
  const propKeys = Object.keys(properties);
  if (propKeys.length > 0) {
    propsSection = '\n## 属性\n\n';
    for (const key of propKeys) {
      propsSection += `- **${key}**: ${properties[key]}\n`;
    }
    propsSection += '\n';
  }

  const content =
    serializeFrontmatter(fm) +
    '\n# ' + name + '\n\n' +
    propsSection +
    '## 关系\n\n' +
    '## 相关学习\n\n' +
    '## 相关错误\n';

  fs.writeFileSync(filePath, content, 'utf-8');
  return safePath('记忆', '实体', type, fileName);
}

/**
 * 更新实体笔记——合并 frontmatter 并追加内容区块
 *
 * @param {string} entityPath - 实体笔记在 vault 中的相对路径
 * @param {Object} updates - { properties, section, content }
 * @param {string} vaultPath
 */
export function updateEntityNote(entityPath, updates, vaultPath) {
  const fullPath = path.join(vaultPath, entityPath);
  if (!fs.existsSync(fullPath)) {
    return { success: false, error: `实体笔记不存在: ${entityPath}` };
  }

  let raw = fs.readFileSync(fullPath, 'utf-8');
  const { frontmatter, body } = parseFrontmatter(raw);

  // 更新 frontmatter
  if (updates.properties) {
    Object.assign(frontmatter, updates.properties);
  }
  frontmatter.updated = todayStr();

  // 追加内容区块
  let newBody = body;
  if (updates.section && updates.content) {
    // 如果 body 中已有同名 section，追加内容；否则创建新 section
    const sectionHeader = `## ${updates.section}`;
    if (newBody.includes(sectionHeader)) {
      newBody = newBody.replace(
        sectionHeader,
        sectionHeader + '\n' + updates.content
      );
    } else {
      newBody = newBody.trimEnd() + '\n\n' + sectionHeader + '\n' + updates.content;
    }
  }

  const newContent = serializeFrontmatter(frontmatter) + '\n' + newBody;
  fs.writeFileSync(fullPath, newContent, 'utf-8');

  return { success: true };
}

/**
 * 读取实体笔记
 *
 * @returns {Object|null} { name, type, frontmatter, body }
 */
export function readEntityNote(entityPath, vaultPath) {
  const fullPath = path.join(vaultPath, entityPath);
  if (!fs.existsSync(fullPath)) return null;

  const raw = fs.readFileSync(fullPath, 'utf-8');
  const { frontmatter, body } = parseFrontmatter(raw);
  const name = path.basename(entityPath, '.md');

  return { name, type: frontmatter.type, frontmatter, body };
}

// ─── 关系管理 ──────────────────────────────────────────

/**
 * 在实体笔记的「关系」区块中添加一条 Dataview 兼容的关系记录
 *
 * @param {string} fromEntityPath - 源实体笔记路径
 * @param {string} toEntity - 目标实体名称（将转为 [[wikilink]]）
 * @param {string} relationType - 关系类型，如 belongs_to, designed_by
 * @param {string} vaultPath
 */
export function addRelation(fromEntityPath, toEntity, relationType, vaultPath) {
  const fullPath = path.join(vaultPath, fromEntityPath);
  if (!fs.existsSync(fullPath)) return false;

  let raw = fs.readFileSync(fullPath, 'utf-8');
  const relationLine = `- ${relationType}:: [[${toEntity}]]\n`;

  // 在「## 关系」区块追加
  const sectionHeader = '## 关系';
  if (raw.includes(sectionHeader)) {
    // 检查是否已存在相同关系，防重
    if (raw.includes(`[[${toEntity}]]`)) return true;
    raw = raw.replace(sectionHeader, sectionHeader + '\n' + relationLine);
  } else {
    raw = raw.trimEnd() + '\n\n' + sectionHeader + '\n' + relationLine;
  }

  fs.writeFileSync(fullPath, raw, 'utf-8');
  return true;
}

// ─── 学习与错误记录（双层模式） ─────────────────────────

/**
 * 添加学习记录
 * 写入「记忆/学习/」目录下的独立笔记
 *
 * @param {Object} learning - { content, category, priority, source }
 * @param {string} vaultPath
 */
export function addLearning(learning, vaultPath) {
  const { content, category = 'insight', priority = 'medium', source } = learning;
  const dirPath = path.join(vaultPath, '记忆', '学习');
  ensureDir(dirPath);

  const ts = timestampStr();
  const fileName = `${todayStr()}-${category}-${ts.slice(11, 19).replace(/-/g, '')}.md`;
  const filePath = path.join(dirPath, fileName);

  const fm = serializeFrontmatter({
    category,
    priority,
    date: todayStr(),
    source: source || '',
  });

  const body = fm + '\n# ' + content.slice(0, 60) + '\n\n' + content + '\n';
  fs.writeFileSync(filePath, body, 'utf-8');

  return safePath('记忆', '学习', fileName);
}

/**
 * 添加错误记录（双层模式）
 *
 * 层1：独立错误笔记 — 写入「记忆/错误/」
 * 层2：实体引用 — 在相关实体笔记的「相关错误」区块添加双链
 *
 * @param {Object} error - { content, severity, relatedEntity, relatedEntityPath }
 * @param {string} vaultPath
 */
export function addError(error, vaultPath) {
  const { content, severity = 'medium', relatedEntity, relatedEntityPath } = error;
  const dirPath = path.join(vaultPath, '记忆', '错误');
  ensureDir(dirPath);

  const ts = timestampStr();
  const fileName = `${todayStr()}-error-${ts.slice(11, 19).replace(/-/g, '')}.md`;
  const filePath = path.join(dirPath, fileName);

  // 层1：独立错误笔记
  const fm = serializeFrontmatter({
    severity,
    date: todayStr(),
    related: relatedEntity || '',
  });

  const errorNotePath = safePath('记忆', '错误', fileName);
  const body = fm +
    '\n# 错误记录\n\n' +
    content + '\n\n' +
    (relatedEntity ? `关联实体: [[${relatedEntity}]]\n` : '') +
    `状态: 待修复\n`;

  fs.writeFileSync(filePath, body, 'utf-8');

  // 层2：在实体笔记中引用
  if (relatedEntityPath) {
    const entityFullPath = path.join(vaultPath, relatedEntityPath);
    if (fs.existsSync(entityFullPath)) {
      let raw = fs.readFileSync(entityFullPath, 'utf-8');
      const refLine = `- [[${errorNotePath.replace('.md', '')}|${content.slice(0, 50)}...]]（${severity}）\n`;
      const sectionHeader = '## 相关错误';
      if (raw.includes(sectionHeader)) {
        raw = raw.replace(sectionHeader, sectionHeader + '\n' + refLine);
      } else {
        raw = raw.trimEnd() + '\n\n' + sectionHeader + '\n' + refLine;
      }
      fs.writeFileSync(entityFullPath, raw, 'utf-8');
    }
  }

  return errorNotePath;
}

// ─── 上下文生成 ─────────────────────────────────────────

/**
 * 生成会话上下文摘要
 * 扫描近期日记 + 高优先级学习 + 未修复错误
 *
 * @param {string} vaultPath
 * @param {number} maxTokens - 最大 token 数（粗估：1 token ≈ 0.75 英文词 ≈ 2 中文字符）
 * @returns {string} 上下文文本
 */
export function generateContext(vaultPath, maxTokens = 2000) {
  const sections = [];

  // 1. 读取上下文文件（如果存在）
  const contextFile = path.join(vaultPath, '记忆', 'context.md');
  if (fs.existsSync(contextFile)) {
    const content = fs.readFileSync(contextFile, 'utf-8');
    sections.push(content);
  }

  // 2. 读取最近 3 天的日记
  const diaryDir = path.join(vaultPath, '03-日记');
  if (fs.existsSync(diaryDir)) {
    const files = fs.readdirSync(diaryDir)
      .filter(f => f.endsWith('.md') && f.match(/^\d{4}-\d{2}-\d{2}\.md$/))
      .sort()
      .reverse()
      .slice(0, 3);

    if (files.length > 0) {
      sections.push('## 近期日记摘要\n');
      for (const file of files) {
        const filePath = path.join(diaryDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        // 提取「重点内容」部分
        const keyMatch = content.match(/## 重点内容\n\n([\s\S]*?)(?=\n## |$)/);
        if (keyMatch) {
          sections.push(`### ${file.replace('.md', '')}\n${keyMatch[1].slice(0, 500)}`);
        }
      }
    }
  }

  // 3. 读取高优先级学习记录
  const learningDir = path.join(vaultPath, '记忆', '学习');
  if (fs.existsSync(learningDir)) {
    const files = fs.readdirSync(learningDir)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse()
      .slice(0, 10);

    if (files.length > 0) {
      const learnings = [];
      for (const file of files) {
        const content = fs.readFileSync(path.join(learningDir, file), 'utf-8');
        const { frontmatter } = parseFrontmatter(content);
        if (frontmatter.priority === 'high' || frontmatter.priority === 'critical') {
          // 提取正文（跳过 frontmatter 和标题）
          const body = content.replace(/^---[\s\S]*?---\n/, '').replace(/^#.*\n/, '').trim();
          learnings.push(`- [${frontmatter.category}] ${body.slice(0, 200)}`);
        }
      }
      if (learnings.length > 0) {
        sections.push('## 高优先级学习\n\n' + learnings.join('\n'));
      }
    }
  }

  // 4. 读取未修复错误
  const errorDir = path.join(vaultPath, '记忆', '错误');
  if (fs.existsSync(errorDir)) {
    const files = fs.readdirSync(errorDir)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse()
      .slice(0, 5);

    if (files.length > 0) {
      const errors = [];
      for (const file of files) {
        const content = fs.readFileSync(path.join(errorDir, file), 'utf-8');
        if (content.includes('状态: 待修复')) {
          const { frontmatter } = parseFrontmatter(content);
          const body = content.replace(/^---[\s\S]*?---\n/, '').replace(/^#.*\n/, '').trim();
          errors.push(`- [${frontmatter.severity}] ${body.slice(0, 200)}`);
        }
      }
      if (errors.length > 0) {
        sections.push('## 待修复错误\n\n' + errors.join('\n'));
      }
    }
  }

  const fullContext = sections.join('\n\n---\n\n');

  // 粗截断（简单按字符数估算，实际平台会精确计 token）
  const estimatedMax = maxTokens * 2; // 中文约 2 字符/token
  if (fullContext.length > estimatedMax) {
    return fullContext.slice(0, estimatedMax) + '\n\n[上下文已截断]';
  }

  return fullContext;
}

// ─── 搜索 ───────────────────────────────────────────────

/**
 * 在记忆目录中搜索
 * 简单实现：遍历 .md 文件，标题和内容匹配
 *
 * @param {string} query - 搜索词
 * @param {string} vaultPath
 * @returns {Object} { entities: [], learnings: [], errors: [] }
 */
export function searchMemory(query, vaultPath) {
  const results = { entities: [], learnings: [], errors: [] };
  const memoryDir = path.join(vaultPath, '记忆');
  if (!fs.existsSync(memoryDir)) return results;

  const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);

  function matches(content) {
    const lower = content.toLowerCase();
    return keywords.some(kw => lower.includes(kw));
  }

  function walkDir(dir, category) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(entryPath, category);
      } else if (entry.name.endsWith('.md')) {
        const content = fs.readFileSync(entryPath, 'utf-8');
        if (matches(content)) {
          const { frontmatter } = parseFrontmatter(content);
          const snippet = content.replace(/^---[\s\S]*?---\n/, '').slice(0, 200);
          const relativePath = path.relative(vaultPath, entryPath).replace(/\\/g, '/');
          results[category].push({
            path: relativePath,
            name: entry.name.replace('.md', ''),
            type: frontmatter.type || frontmatter.category || '',
            snippet,
          });
        }
      }
    }
  }

  walkDir(path.join(memoryDir, '实体'), 'entities');
  walkDir(path.join(memoryDir, '学习'), 'learnings');
  walkDir(path.join(memoryDir, '错误'), 'errors');

  return results;
}

// ─── 统计 ───────────────────────────────────────────────

/**
 * 获取记忆系统统计
 */
export function getStats(vaultPath) {
  const memoryDir = path.join(vaultPath, '记忆');
  const stats = {
    entities: { total: 0, byType: {} },
    learnings: { total: 0, byCategory: {} },
    errors: { total: 0, resolved: 0, pending: 0 },
  };

  if (!fs.existsSync(memoryDir)) return stats;

  // 实体
  const entityDir = path.join(memoryDir, '实体');
  if (fs.existsSync(entityDir)) {
    const types = fs.readdirSync(entityDir, { withFileTypes: true }).filter(d => d.isDirectory());
    for (const type of types) {
      const files = fs.readdirSync(path.join(entityDir, type.name)).filter(f => f.endsWith('.md'));
      stats.entities.byType[type.name] = files.length;
      stats.entities.total += files.length;
    }
  }

  // 学习
  const learningDir = path.join(memoryDir, '学习');
  if (fs.existsSync(learningDir)) {
    const files = fs.readdirSync(learningDir).filter(f => f.endsWith('.md'));
    stats.learnings.total = files.length;
    for (const file of files) {
      const content = fs.readFileSync(path.join(learningDir, file), 'utf-8');
      const { frontmatter } = parseFrontmatter(content);
      const cat = frontmatter.category || 'uncategorized';
      stats.learnings.byCategory[cat] = (stats.learnings.byCategory[cat] || 0) + 1;
    }
  }

  // 错误
  const errorDir = path.join(memoryDir, '错误');
  if (fs.existsSync(errorDir)) {
    const files = fs.readdirSync(errorDir).filter(f => f.endsWith('.md'));
    stats.errors.total = files.length;
    for (const file of files) {
      const content = fs.readFileSync(path.join(errorDir, file), 'utf-8');
      if (content.includes('状态: 待修复')) {
        stats.errors.pending++;
      } else {
        stats.errors.resolved++;
      }
    }
  }

  return stats;
}

// ─── 初始化 ─────────────────────────────────────────────

/**
 * 初始化记忆系统目录结构
 */
export function initMemorySystem(vaultPath) {
  const dirs = [
    '记忆',
    '记忆/实体',
    '记忆/实体/人物',
    '记忆/实体/项目',
    '记忆/实体/技能',
    '记忆/实体/概念',
    '记忆/关系',
    '记忆/学习',
    '记忆/错误',
  ];

  for (const dir of dirs) {
    ensureDir(path.join(vaultPath, dir));
  }

  // 创建初始 context.md
  const contextFile = path.join(vaultPath, '记忆', 'context.md');
  if (!fs.existsSync(contextFile)) {
    const content = [
      '---',
      'type: context',
      'updated: ' + todayStr(),
      '---',
      '# 会话上下文',
      '',
      '此文件在每次会话开始时自动注入 system context。',
      '包含近期关键信息、活跃项目、偏好摘要。',
      '',
      '## 当前活跃项目',
      '',
      '（由记忆系统自动维护）',
      '',
      '## 近期偏好与纠正',
      '',
      '（由记忆系统自动维护）',
    ].join('\n');
    fs.writeFileSync(contextFile, content, 'utf-8');
  }

  return { success: true, vaultPath };
}
