import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {fontStack, theme} from '../theme';
import {YoloCard} from '../components/YoloCard';

// Kinetic headline: words rise + fade in, staggered.
const KineticHeadline: React.FC<{text: string; startFrame: number}> = ({
  text,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const words = text.split(' ');
  return (
    <div style={{display: 'flex', flexWrap: 'wrap', gap: '0 16px', maxWidth: 620}}>
      {words.map((word, i) => {
        const s = spring({
          frame: frame - startFrame - i * 4,
          fps,
          config: {damping: 200},
        });
        return (
          <span
            key={`${word}-${i}`}
            style={{
              display: 'inline-block',
              fontFamily: fontStack,
              fontSize: 68,
              fontWeight: 800,
              letterSpacing: -1.5,
              color: theme.text,
              opacity: s,
              transform: `translateY(${interpolate(s, [0, 1], [28, 0])}px)`,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

export const QueueScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();

  // Controlled camera push-in across the whole scene.
  const camera = interpolate(frame, [0, durationInFrames], [1, 1.035], {
    extrapolateRight: 'clamp',
  });

  // Mask reveal (clip-path inset) for the real capture panel.
  const maskT = interpolate(frame, [6, 26], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const inset = interpolate(maskT, [0, 1], [100, 0]);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 30% 20%, #ffffff 0%, ${theme.canvas} 60%)`,
      }}
    >
      <AbsoluteFill style={{transform: `scale(${camera})`}}>
        {/* headline */}
        <div style={{position: 'absolute', top: 110, left: 120}}>
          <KineticHeadline text="Queue what should happen next." startFrame={12} />
        </div>

        {/* real product capture (mask reveal + subtle drift) */}
        <div
          style={{
            position: 'absolute',
            left: 150,
            bottom: 90,
            width: 360,
            borderRadius: 18,
            overflow: 'hidden',
            border: `1px solid ${theme.border}`,
            boxShadow: theme.shadow,
            clipPath: `inset(0 0 ${inset}% 0 round 18px)`,
          }}
        >
          <Img
            src={staticFile('product-queue.png')}
            style={{width: '100%', display: 'block'}}
          />
          <div
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              padding: '5px 10px',
              borderRadius: 999,
              background: 'rgba(24,24,23,0.82)',
              color: '#fff',
              fontSize: 13,
              fontFamily: fontStack,
              fontWeight: 600,
            }}
          >
            Real capture · popup.html
          </div>
        </div>

        {/* live reconstructed card with animated queue insertion */}
        <div style={{position: 'absolute', right: 150, top: 150}}>
          <YoloCard insertStartFrame={24} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
