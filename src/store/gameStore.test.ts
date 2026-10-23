import { beforeEach, describe, expect, it } from 'vitest';
import { hasClue, useGame } from './gameStore';

describe('게임 상태: 문서와 단서', () => {
  beforeEach(() => useGame.setState({ readDocs: [], clues: [], openDocId: null }));

  it('문서를 열면 읽은 것으로 남고, 다시 열어도 한 번만 남는다', () => {
    useGame.getState().openDocument('3-2');
    useGame.getState().closeDocument();
    useGame.getState().openDocument('3-2');
    expect(useGame.getState().readDocs).toEqual(['3-2']);
    expect(useGame.getState().openDocId).toBe('3-2');
  });

  it('같은 단서를 두 번 눌러도 쪽지는 하나', () => {
    const { collectClue } = useGame.getState();
    collectClue('3-6', '공동 성명');
    collectClue('3-6', '공동 성명');
    collectClue('3-6', '적십자 회담');
    const { clues } = useGame.getState();
    expect(clues).toHaveLength(2);
    expect(hasClue(clues, '3-6', '적십자 회담')).toBe(true);
    expect(hasClue(clues, '3-5', '적십자 회담')).toBe(false);
  });
});
