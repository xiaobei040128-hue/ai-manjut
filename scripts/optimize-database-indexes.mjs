#!/usr/bin/env node
/**
 * 数据库索引优化脚本
 * 为高频查询字段添加索引，提升查询性能
 */

import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dataDir = resolve(process.env.DRAMA_DATA_DIR || resolve(__dirname, '..', 'runtime-data'));
const dbPath = resolve(dataDir, 'workspace.sqlite');

console.log('🔧 开始优化数据库索引...');
console.log(`📍 数据库路径: ${dbPath}`);

try {
  const db = new DatabaseSync(dbPath);

  // 启用 WAL 模式（如果未启用）
  db.exec('PRAGMA journal_mode=WAL');
  console.log('✓ WAL 模式已启用');

  // 设置 busy_timeout
  db.exec('PRAGMA busy_timeout=30000');
  console.log('✓ Busy timeout 已设置为 30 秒');

  // 需要添加的索引列表
  const indexes = [
    // 账本相关（财务查询）
    {
      name: 'idx_ledger_owner_created',
      sql: 'CREATE INDEX IF NOT EXISTS idx_ledger_owner_created ON ledger(owner_id, created_at DESC)',
      description: '用户账本查询（按时间倒序）'
    },
    {
      name: 'idx_ledger_kind',
      sql: 'CREATE INDEX IF NOT EXISTS idx_ledger_kind ON ledger(kind, created_at DESC)',
      description: '按类型查询账本'
    },
    
    // 通知相关
    {
      name: 'idx_notifications_owner_unread',
      sql: 'CREATE INDEX IF NOT EXISTS idx_notifications_owner_unread ON notifications(owner_id, is_read, created_at DESC)',
      description: '用户未读通知查询'
    },
    {
      name: 'idx_notifications_owner_time',
      sql: 'CREATE INDEX IF NOT EXISTS idx_notifications_owner_time ON notifications(owner_id, created_at DESC)',
      description: '用户通知时间线'
    },

    // 任务分配相关
    {
      name: 'idx_assignments_owner_status',
      sql: 'CREATE INDEX IF NOT EXISTS idx_assignments_owner_status ON assignments(owner_id, status, created_at DESC)',
      description: '用户任务分配查询（按状态）'
    },
    {
      name: 'idx_assignments_task_status',
      sql: 'CREATE INDEX IF NOT EXISTS idx_assignments_task_status ON assignments(task_id, status)',
      description: '任务分配状态查询'
    },
    {
      name: 'idx_assignments_deadline',
      sql: 'CREATE INDEX IF NOT EXISTS idx_assignments_deadline ON assignments(deadline, status)',
      description: '截止日期查询'
    },

    // 任务相关
    {
      name: 'idx_tasks_active',
      sql: 'CREATE INDEX IF NOT EXISTS idx_tasks_active ON tasks(active, created_at DESC)',
      description: '活跃任务查询'
    },
    {
      name: 'idx_tasks_stage',
      sql: 'CREATE INDEX IF NOT EXISTS idx_tasks_stage ON tasks(stage, active)',
      description: '按阶段查询任务'
    },
    {
      name: 'idx_tasks_genre',
      sql: 'CREATE INDEX IF NOT EXISTS idx_tasks_genre ON tasks(genre, active)',
      description: '按类型查询任务'
    },

    // 创作者账户相关
    {
      name: 'idx_creator_accounts_email',
      sql: 'CREATE INDEX IF NOT EXISTS idx_creator_accounts_email ON creator_accounts(email)',
      description: '邮箱查询'
    },
    {
      name: 'idx_creator_accounts_invite',
      sql: 'CREATE INDEX IF NOT EXISTS idx_creator_accounts_invite ON creator_accounts(invite_id)',
      description: '邀请关系查询'
    },
    {
      name: 'idx_creator_accounts_created',
      sql: 'CREATE INDEX IF NOT EXISTS idx_creator_accounts_created ON creator_accounts(created_at DESC)',
      description: '按注册时间查询'
    },

    // 邀请相关
    {
      name: 'idx_invitations_owner',
      sql: 'CREATE INDEX IF NOT EXISTS idx_invitations_owner ON invitations(owner_id, used)',
      description: '用户邀请查询'
    },
    {
      name: 'idx_invitations_code',
      sql: 'CREATE INDEX IF NOT EXISTS idx_invitations_code ON invitations(code_hash)',
      description: '邀请码查询'
    },

    // 提交相关
    {
      name: 'idx_submissions_assignment',
      sql: 'CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions(assignment_id, version DESC)',
      description: '任务提交历史'
    },
    {
      name: 'idx_submissions_status',
      sql: 'CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status, created_at DESC)',
      description: '按状态查询提交'
    },

    // 上传相关
    {
      name: 'idx_uploads_assignment',
      sql: 'CREATE INDEX IF NOT EXISTS idx_uploads_assignment ON uploads(assignment_id, created_at DESC)',
      description: '任务上传记录'
    },
    {
      name: 'idx_uploads_path',
      sql: 'CREATE INDEX IF NOT EXISTS idx_uploads_path ON uploads(path)',
      description: '按路径查询上传'
    },

    // 事件相关
    {
      name: 'idx_events_assignment',
      sql: 'CREATE INDEX IF NOT EXISTS idx_events_assignment ON events(assignment_id, created_at DESC)',
      description: '任务事件历史'
    },

    // 素材相关
    {
      name: 'idx_materials_task',
      sql: 'CREATE INDEX IF NOT EXISTS idx_materials_task ON materials(task_id, active, created_at DESC)',
      description: '任务素材查询'
    },

    // 收藏相关
    {
      name: 'idx_creator_bookmarks_user',
      sql: 'CREATE INDEX IF NOT EXISTS idx_creator_bookmarks_user ON creator_bookmarks(user_id, created_at DESC)',
      description: '用户收藏查询'
    },

    // 管理员审计
    {
      name: 'idx_admin_audit_time',
      sql: 'CREATE INDEX IF NOT EXISTS idx_admin_audit_time ON admin_audit(created_at DESC)',
      description: '审计日志时间线'
    },
    {
      name: 'idx_admin_audit_actor',
      sql: 'CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON admin_audit(actor, created_at DESC)',
      description: '按操作者查询审计日志'
    }
  ];

  let created = 0;
  let failed = 0;

  for (const index of indexes) {
    try {
      db.exec(index.sql);
      console.log(`✓ ${index.name}: ${index.description}`);
      created++;
    } catch (error) {
      console.error(`✗ ${index.name}: ${error.message}`);
      failed++;
    }
  }

  console.log('\n📊 索引优化统计:');
  console.log(`   成功创建: ${created}`);
  console.log(`   创建失败: ${failed}`);
  console.log(`   总计: ${indexes.length}`);

  // 查询索引数量
  const indexCount = db.prepare(
    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='index'"
  ).get();
  
  console.log(`\n📈 数据库当前共有 ${indexCount.count} 个索引`);

  // 优化数据库
  console.log('\n🔧 执行数据库优化...');
  db.exec('PRAGMA optimize');
  console.log('✓ 数据库优化完成');

  db.close();
  console.log('\n✅ 数据库索引优化完成！');
  console.log('\n💡 建议:');
  console.log('   1. 定期执行此脚本（每周一次）');
  console.log('   2. 监控查询性能，根据需要添加更多索引');
  console.log('   3. 删除不使用的索引（会占用空间）');

} catch (error) {
  console.error('\n❌ 数据库优化失败:', error.message);
  console.error(error.stack);
  process.exit(1);
}
