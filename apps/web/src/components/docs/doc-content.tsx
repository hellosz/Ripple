import type { CSSProperties, ReactElement, ReactNode } from 'react';

const cardStyle: CSSProperties = {
  border: '1px solid rgba(63,68,56,.1)',
  borderRadius: 14,
  padding: 18,
  background: '#ffffff',
};

const codeBlockStyle: CSSProperties = {
  marginTop: 22,
  background: 'rgba(63,68,56,.04)',
  border: '1px solid rgba(63,68,56,.08)',
  borderRadius: 12,
  padding: '18px 22px',
  fontFamily: 'var(--rp-font-mono)',
  fontSize: 13,
  lineHeight: 2.1,
  color: 'var(--rp-primary-deep)',
  whiteSpace: 'pre',
  overflowX: 'auto',
};

function InlineCode({ children }: { children: ReactNode }): ReactElement {
  return (
    <span
      style={{
        fontFamily: 'var(--rp-font-mono)',
        background: 'rgba(147,168,107,.1)',
        color: 'var(--rp-primary-deep)',
        borderRadius: 4,
        padding: '1px 6px',
        fontSize: 12,
      }}
    >
      {children}
    </span>
  );
}

function KeyValueRow({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div style={{ display: 'flex', gap: 12, fontSize: 13.5, lineHeight: 1.7, color: 'rgba(75,80,64,.7)' }}>
      <span style={{ color: 'var(--rp-primary)', fontWeight: 700, whiteSpace: 'nowrap' }}>{label}</span>
      <span>{children}</span>
    </div>
  );
}

function DocTitle({ title, intro }: { title: string; intro: ReactNode }): ReactElement {
  return (
    <>
      <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, color: 'var(--rp-ink)' }}>{title}</h1>
      <p style={{ margin: '14px 0 0', fontSize: 15, lineHeight: 1.85, color: 'rgba(75,80,64,.7)' }}>{intro}</p>
    </>
  );
}

function DocH2({ children }: { children: ReactNode }): ReactElement {
  return <h2 style={{ margin: '30px 0 6px', fontSize: 17, fontWeight: 700, color: 'var(--rp-ink)' }}>{children}</h2>;
}

export function OverviewDoc(): ReactElement {
  return (
    <div>
      <DocTitle
        title="Ripple 生态"
        intro="一套技能，三种入口。技能在 Web 社区被发现和传播，通过 CLI 进入脚本与流水线，通过桌面客户端落到本地每一个 Agent。"
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginTop: 26 }}>
        <div style={cardStyle}>
          <div style={{ fontWeight: 900, fontSize: 15, color: 'var(--rp-ink)' }}>Web 社区</div>
          <p style={{ margin: '7px 0 0', fontSize: 12.5, lineHeight: 1.7, color: 'rgba(75,80,64,.6)' }}>
            发现、预览、传播与评论，热度由社区行为实时计算。
          </p>
        </div>
        <div style={cardStyle}>
          <div style={{ fontWeight: 900, fontSize: 15, color: 'var(--rp-ink)' }}>CLI 工具</div>
          <p style={{ margin: '7px 0 0', fontSize: 12.5, lineHeight: 1.7, color: 'rgba(75,80,64,.6)' }}>
            对接服务，把搜索、安装、发布、更新纳入脚本与 CI。
          </p>
        </div>
        <div style={cardStyle}>
          <div style={{ fontWeight: 900, fontSize: 15, color: 'var(--rp-ink)' }}>桌面客户端</div>
          <p style={{ margin: '7px 0 0', fontSize: 12.5, lineHeight: 1.7, color: 'rgba(75,80,64,.6)' }}>
            对接服务，并统一管理本地多个 Agent 的技能目录。
          </p>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginTop: 26,
          border: '1px solid rgba(147,168,107,.3)',
          borderRadius: 14,
          padding: '16px 20px',
          background: 'rgba(147,168,107,.05)',
          fontSize: 13,
          color: 'var(--rp-primary-deep)',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontWeight: 700 }}>发现</span>
        <span>→</span>
        <span style={{ fontWeight: 700 }}>安装</span>
        <span>→</span>
        <span style={{ fontWeight: 700 }}>同步到本地 Agent</span>
        <span>→</span>
        <span style={{ fontWeight: 700 }}>反馈回社区</span>
      </div>
    </div>
  );
}

export function CliDoc(): ReactElement {
  return (
    <div>
      <DocTitle
        title="CLI 工具"
        intro={
          <>
            <InlineCode>ripple</InlineCode>{' '}
            命令行对接 Ripple 服务，覆盖从发现到发布的完整闭环，适合脚本化与 CI 集成。
          </>
        }
      />
      <div style={codeBlockStyle}>
        {`# 安装并登录
$ npm install -g ripple-cli
$ ripple login

# 发现与安装
$ ripple search git
$ ripple install git-archaeologist
$ ripple install git-archaeologist --agent claude-code

# 发布与更新
$ ripple publish ./my-skill
$ ripple update --all`}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22 }}>
        <KeyValueRow label="服务对接">搜索 / 安装 / 发布 / 更新 / 收藏同步，凭 token 鉴权。</KeyValueRow>
        <KeyValueRow label="目标指定">
          <InlineCode>--agent</InlineCode> 指定安装目标；缺省安装到默认 Agent。
        </KeyValueRow>
        <KeyValueRow label="CI 集成">
          <InlineCode>ripple update --all</InlineCode> 可挂到流水线，保持团队技能一致。
        </KeyValueRow>
      </div>
    </div>
  );
}

const AGENTS: { glyph: string; name: string; path: string; supported: boolean }[] = [
  { glyph: 'C', name: 'Claude Code', path: '~/.claude/skills', supported: true },
  { glyph: 'X', name: 'Codex', path: '~/.codex/skills', supported: true },
  { glyph: 'O', name: 'OpenCode', path: '~/.opencode/skill', supported: true },
  { glyph: 'H', name: 'Hermes', path: '~/.hermes/skills', supported: true },
  { glyph: 'D', name: 'DeepSeek Harness', path: '~/.deepseek/harness/skills', supported: true },
  { glyph: 'W', name: 'OpenClaw', path: '~/.openclaw/skills', supported: false },
  { glyph: 'π', name: 'Pi', path: '~/.pi/skills', supported: false },
];

export function DesktopDoc(): ReactElement {
  return (
    <div>
      <DocTitle
        title="桌面客户端"
        intro="同时对接 Ripple 服务与本地环境：在线浏览安装，离线统一管理本地多个 Agent 的技能。"
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 22 }}>
        <div style={cardStyle}>
          <div style={{ fontWeight: 900, fontSize: 14, color: 'var(--rp-ink)', marginBottom: 10 }}>服务侧</div>
          <div style={{ fontSize: 13, lineHeight: 2, color: 'rgba(75,80,64,.65)' }}>
            浏览与搜索社区技能
            <br />
            一键安装 / 批量更新
            <br />
            收藏与热度同步
            <br />
            发布与版本管理
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontWeight: 900, fontSize: 14, color: 'var(--rp-ink)', marginBottom: 10 }}>本地侧</div>
          <div style={{ fontSize: 13, lineHeight: 2, color: 'rgba(75,80,64,.65)' }}>
            扫描各 Agent 技能目录
            <br />
            启用 / 禁用 / 卸载
            <br />
            版本对比与冲突检测
            <br />
            一键同步到多个 Agent
          </div>
        </div>
      </div>
      <DocH2>本地 Skill 管理机制</DocH2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 8 }}>
        <KeyValueRow label="中心存储">
          技能统一存放于 SSOT 目录（内置 <InlineCode>~/.ripple/skills</InlineCode> 或共享{' '}
          <InlineCode>~/.agents/skills</InlineCode>
          ），默认以 symlink 分发到各 Agent 与项目目录，也可切换为文件复制。
        </KeyValueRow>
        <KeyValueRow label="多种来源">
          Ripple 服务、自定义 GitHub 仓库（支持分支与子目录）、ZIP 离线导入；GitHub 与 ZIP
          来源在未登录的本地模式下同样可用。
        </KeyValueRow>
        <KeyValueRow label="Deep Link">
          网页端点击安装即唤起客户端：<InlineCode>ripple://install?skill=…</InlineCode>
        </KeyValueRow>
        <KeyValueRow label="备份回退">
          更新 / 同步 / 卸载前自动备份（保留最近 20 份），备份管理器支持恢复到任意版本与清理旧备份。
        </KeyValueRow>
      </div>
      <DocH2>支持的 Agent</DocH2>
      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--rp-muted)' }}>
        包括但不限于以下环境，通过适配器机制持续扩展。
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {AGENTS.map((ag) => (
          <div
            key={ag.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              border: '1px solid rgba(63,68,56,.09)',
              borderRadius: 12,
              padding: '12px 16px',
              background: '#ffffff',
            }}
          >
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: 'rgba(147,168,107,.1)',
                color: 'var(--rp-primary)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 900,
                flex: 'none',
              }}
            >
              {ag.glyph}
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--rp-ink)', whiteSpace: 'nowrap' }}>
                {ag.name}
              </div>
              <div
                style={{
                  fontFamily: 'var(--rp-font-mono)',
                  fontSize: 11,
                  color: 'rgba(75,80,64,.45)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {ag.path}
              </div>
            </div>
            <span
              style={{
                fontSize: 10.5,
                padding: '3px 9px',
                borderRadius: 999,
                whiteSpace: 'nowrap',
                flex: 'none',
                background: ag.supported ? 'rgba(22,163,74,.1)' : 'rgba(63,68,56,.06)',
                color: ag.supported ? '#16a34a' : 'rgba(75,80,64,.55)',
              }}
            >
              {ag.supported ? '已支持' : '规划中'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SpecDoc(): ReactElement {
  return (
    <div>
      <DocTitle
        title="Skill 规范"
        intro="技能包是一个带 SKILL.md 的目录。SKILL.md 是通用入口，CLI 与客户端负责按各 Agent 的目录规范落盘。"
      />
      <div style={{ ...codeBlockStyle, lineHeight: 2 }}>
        {`my-skill/
├── SKILL.md        # 必需 · frontmatter: name + description
├── references/     # 详细流程文档，Agent 按需加载
├── scripts/        # 可执行脚本，确定性任务交给代码
└── assets/         # 输出模板与静态资源`}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22 }}>
        <KeyValueRow label="frontmatter">
          <InlineCode>name</InlineCode> 全局唯一（即安装名），<InlineCode>description</InlineCode>{' '}
          描述能力与触发时机。
        </KeyValueRow>
        <KeyValueRow label="按需加载">正文保持精炼，细节放 references/，不占用 Agent 上下文。</KeyValueRow>
        <KeyValueRow label="跨 Agent">
          同一份技能包适配多 Agent；差异（目录位置、清单格式）由安装器抹平。
        </KeyValueRow>
      </div>
    </div>
  );
}
