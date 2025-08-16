import React from 'react';

interface StarsProps {
  score: number; // 0-5
  max?: number;
  animated?: boolean;
}

const starContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: 4,
  alignItems: 'center'
};

export const Stars: React.FC<StarsProps> = ({ score, max = 5, animated = false }) => {
  return (
    <div role="img" aria-label={`Pontuação: ${score} de ${max}`} style={starContainerStyle}>
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < score;
        const delay = animated && filled ? `${i * 60}ms` : '0ms';
        return (
            <span
              key={i}
              aria-hidden="true"
              style={{
                fontSize: 30,
                lineHeight: '1',
                transition: 'transform 420ms ease, filter 420ms ease',
                transform: filled ? 'scale(1.15)' : 'scale(1)',
                filter: filled ? 'drop-shadow(0 0 6px rgba(255,200,0,0.9))' : 'none',
                color: filled ? '#ffc400' : '#ddd',
                animation: animated && filled ? `popIn 480ms ${delay} both` : 'none'
              }}
            >
              {filled ? '★' : '☆'}
            </span>
        );
      })}
      <style>{`@keyframes popIn {0% { transform: scale(0); opacity: 0; }60% { transform: scale(1.3); opacity: 1; }100% { transform: scale(1.15); opacity: 1; }}`}</style>
    </div>
  );
};

