import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { layout } from '../../lib/assets';
import { fitStage, type StageFit } from '../../lib/stageFit';

const StageFitContext = createContext<StageFit>({ scale: 1, x: 0, y: 0 });

export function useStageFit(): StageFit {
  return useContext(StageFitContext);
}

function currentFit(): StageFit {
  return fitStage(window.innerWidth, window.innerHeight, layout.stage.w, layout.stage.h);
}

interface StageProps {
  children: ReactNode;    // 무대 안(무대 px, 함께 줄어듦)
  overlay?: ReactNode;    // 무대 밖(실제 화면 px)
  backdrop?: string;      // 레터박스를 채울 흐린 방 그림
}

export function Stage({ children, overlay, backdrop }: StageProps) {
  const [fit, setFit] = useState(currentFit);

  useEffect(() => {
    const update = () => setFit(currentFit());
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <StageFitContext.Provider value={fit}>
      <div className="letterbox" style={backdrop ? { backgroundImage: `url(${backdrop})` } : undefined} />
      <div
        className="stage"
        style={{
          width: layout.stage.w,
          height: layout.stage.h,
          transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.scale})`,
        }}
      >
        {children}
      </div>
      <div className="overlay">{overlay}</div>
    </StageFitContext.Provider>
  );
}
