/**
 * Tool Output Formatter v2
 * 格式化工具输出——适配 Obsidian 记忆系统
 */

/**
 * 格式化成功结果
 */
export function toToolResult(data) {
  if (typeof data === 'string') {
    return data;
  }
  return JSON.stringify(data, null, 2);
}

/**
 * 格式化错误结果
 */
export function toToolError(error) {
  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }
  return `Error: ${String(error)}`;
}

/**
 * 格式化记忆统计
 */
export function formatStats(stats) {
  const lines = [
    '## 记忆系统统计',
    '',
    `- 实体总数: ${stats.entities?.total || 0}`,
    `- 学习总数: ${stats.learnings?.total || 0}`,
    `- 错误总数: ${stats.errors?.total || 0}（待修复: ${stats.errors?.pending || 0}）`,
    '',
  ];

  if (stats.entities?.byType && Object.keys(stats.entities.byType).length > 0) {
    lines.push('### 实体分类');
    lines.push('');
    for (const [type, count] of Object.entries(stats.entities.byType)) {
      lines.push(`- ${type}: ${count}`);
    }
    lines.push('');
  }

  if (stats.learnings?.byCategory && Object.keys(stats.learnings.byCategory).length > 0) {
    lines.push('### 学习分类');
    lines.push('');
    for (const [category, count] of Object.entries(stats.learnings.byCategory)) {
      lines.push(`- ${category}: ${count}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 格式化搜索结果
 */
export function formatSearchResults(results) {
  const lines = ['## 记忆搜索结果', ''];

  if (results.entities && results.entities.length > 0) {
    lines.push('### 实体');
    lines.push('');
    for (const entity of results.entities.slice(0, 10)) {
      lines.push(`- [${entity.type}] [[${entity.name}]] — ${entity.snippet.slice(0, 80)}`);
    }
    lines.push('');
  }

  if (results.learnings && results.learnings.length > 0) {
    lines.push('### 学习记录');
    lines.push('');
    for (const learning of results.learnings.slice(0, 10)) {
      lines.push(`- ${learning.snippet.slice(0, 100)}`);
    }
    lines.push('');
  }

  if (results.errors && results.errors.length > 0) {
    lines.push('### 错误记录');
    lines.push('');
    for (const error of results.errors.slice(0, 5)) {
      lines.push(`- ${error.snippet.slice(0, 100)}`);
    }
    lines.push('');
  }

  if (lines.length === 2) {
    lines.push('没有找到相关记忆。');
  }

  return lines.join('\n');
}

/**
 * 格式化提取结果
 */
export function formatExtractResult(result) {
  const lines = [
    '## 记忆提取完成',
    '',
    `- 新建实体: ${result.entities?.created || 0}`,
    `- 添加关系: ${result.relations?.added || 0}`,
    `- 添加学习: ${result.learnings?.added || 0}`,
    `- 添加错误: ${result.errors?.added || 0}`,
    `- 跳过实体: ${result.entities?.skipped || 0}`,
    '',
  ];

  return lines.join('\n');
}

/**
 * 格式化实体读取结果
 */
export function formatEntityResult(entity) {
  if (!entity) return '实体不存在。';

  const lines = [
    `## ${entity.name}`,
    '',
    `- 类型: ${entity.type || '未知'}`,
    '',
    entity.body.slice(0, 2000),
  ];

  return lines.join('\n');
}
