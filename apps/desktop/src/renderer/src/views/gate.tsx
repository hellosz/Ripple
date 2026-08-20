import type { ReactElement } from 'react';
import { useStore } from '../store.js';
import { INK, dim, gradBtn } from '../ui.js';

/** 未登录访问市场 / 更新中心时的门控页 */
export function GateView({ kind }: { kind: 'market' | 'updates' }): ReactElement {
  const store = useStore();
  const title = kind === 'market' ? '技能市场需要登录' : '更新检查需要登录';
  const what = kind === 'market' ? '浏览和安装社区技能' : '检查与拉取新版本';
  return (
    <div style={{ textAlign: 'center', padding: '110px 0', color: dim(0.5) }}>
      <div style={{ fontSize: 32, marginBottom: 14 }}>🔒</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>{title}</div>
      <p style={{ margin: '8px auto 20px', fontSize: 13, lineHeight: 1.8, color: dim(0.5), maxWidth: 340 }}>
        当前为本地模式：可管理本地技能，但{what}需要连接远程服务。
      </p>
      <span
        className="rp-btn-grad"
        onClick={() => store.setLoginOpen(true)}
        style={{
          ...gradBtn,
          display: 'inline-block',
          fontSize: 13,
          borderRadius: 10,
          padding: '10px 26px',
          boxShadow: '0 2px 8px rgba(147,168,107,.3)',
        }}
      >
        配置服务并登录
      </span>
    </div>
  );
}
