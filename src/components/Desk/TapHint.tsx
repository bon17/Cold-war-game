import { strings } from '../../lib/data';

// 다음에 누를 곳 위에 뜨는 '여기를 누르세요' 말풍선(무대 안, 무대 px 28). 부모(누를 물건) 위 가운데에 붙는다.
export function TapHint() {
  return (
    <span className="tap-hint" aria-hidden="true">
      {strings.pointer.tap}
    </span>
  );
}
