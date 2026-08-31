import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CommentTree } from './comment-tree';
import { makeAuthor, makeComment } from '@/test/helpers';

describe('CommentTree', () => {
  it('递归渲染嵌套评论树', () => {
    const comments = [
      makeComment('c1', '配合 blame 一起用效果更好。', [
        makeComment('c2', '同感，考古效率翻倍。', [makeComment('c3', '三层回复也能渲染。')], {
          parent_id: 'c1',
        }),
      ]),
      makeComment('c4', '我们团队已经把它挂进了 CR 流程。', [], {
        author: makeAuthor({ nickname: 'Kiko' }),
      }),
    ];
    render(<CommentTree comments={comments} onReply={vi.fn().mockResolvedValue(true)} />);

    expect(screen.getAllByTestId('comment-node')).toHaveLength(4);
    expect(screen.getByText('配合 blame 一起用效果更好。')).toBeInTheDocument();
    expect(screen.getByText('同感，考古效率翻倍。')).toBeInTheDocument();
    expect(screen.getByText('三层回复也能渲染。')).toBeInTheDocument();
    expect(screen.getByText('我们团队已经把它挂进了 CR 流程。')).toBeInTheDocument();
    expect(screen.getByText('Kiko')).toBeInTheDocument();
  });

  it('回复框提交调用 onReply 并携带父评论 id', async () => {
    const onReply = vi.fn().mockResolvedValue(true);
    const comments = [makeComment('c1', '顶层评论')];
    render(<CommentTree comments={comments} onReply={onReply} />);

    fireEvent.click(screen.getByText('回复'));
    const input = screen.getByPlaceholderText(/回复 林晚/);
    fireEvent.change(input, { target: { value: '收到，感谢分享' } });
    fireEvent.click(screen.getByText('发布'));

    await vi.waitFor(() => {
      expect(onReply).toHaveBeenCalledWith('c1', '收到，感谢分享');
    });
  });

  it('空评论列表渲染为空容器', () => {
    render(<CommentTree comments={[]} onReply={vi.fn().mockResolvedValue(true)} />);
    expect(screen.getByTestId('comment-tree')).toBeEmptyDOMElement();
  });
});
