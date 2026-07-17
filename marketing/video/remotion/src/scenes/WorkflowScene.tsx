import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {fontStack, monoStack, theme} from '../theme';

// Scene 4 (Bounded workflow): progress segments fill 1/4 -> 2/4, then pause.
export const WorkflowScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const cardIn = spring({frame, fps, config: {damping: 200}});
  const cardY = interpolate(cardIn, [0, 1], [40, 0]);

  const seg1 = interpolate(frame, [18, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const seg2 = interpolate(frame, [36, 48], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const paused = frame >= 58;
  const running = seg2 >= 1 ? 2 : seg1 >= 1 ? 1 : 0;
  const runColor = paused ? theme.warning : theme.success;
  const subline = paused
    ? 'paused · iteration 2/4'
    : `running · iteration ${Math.max(running, 1)}/4`;

  const headline = spring({frame: frame - 6, fps, config: {damping: 200}});

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 70% 25%, #ffffff 0%, ${theme.canvas} 60%)`,
        fontFamily: fontStack,
      }}
    >
      <div style={{position: 'absolute', top: 120, left: 120, maxWidth: 720}}>
        <div
          style={{
            fontSize: 62,
            fontWeight: 800,
            letterSpacing: -1.5,
            lineHeight: 1.1,
            color: theme.text,
            opacity: headline,
            transform: `translateY(${interpolate(headline, [0, 1], [26, 0])}px)`,
          }}
        >
          Bounded workflows. Visible state. Your controls.
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          right: 170,
          top: 300,
          width: 620,
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: theme.radiusLg,
          boxShadow: theme.shadow,
          padding: 24,
          opacity: cardIn,
          transform: `translateY(${cardY}px)`,
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
          <span
            style={{
              padding: '4px 12px',
              borderRadius: 999,
              background: theme.surfaceHover,
              color: theme.textSoft,
              fontFamily: monoStack,
              fontSize: 15,
              fontWeight: 700,
            }}
          >
            loop
          </span>
          <span style={{fontSize: 22, fontWeight: 700, color: theme.text}}>
            Audit reliability gaps
          </span>
        </div>

        <div style={{marginTop: 10, color: paused ? theme.warning : theme.textSoft, fontSize: 17, fontWeight: 600}}>
          {subline}
        </div>

        {/* four progress segments: bound established up front */}
        <div style={{display: 'flex', gap: 10, marginTop: 20}}>
          {[seg1, seg2, 0, 0].map((fill, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 12,
                borderRadius: 6,
                background: theme.surfaceHover,
                border: `1px solid ${theme.border}`,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.round(fill * 100)}%`,
                  height: '100%',
                  background: runColor,
                }}
              />
            </div>
          ))}
        </div>

        <div style={{display: 'flex', gap: 12, marginTop: 24}}>
          {[paused ? 'Resume' : 'Pause', 'Edit', 'Stop'].map((label, i) => (
            <span
              key={label}
              style={{
                padding: '10px 22px',
                borderRadius: theme.radiusSm,
                border: `1px solid ${theme.border}`,
                background: i === 0 && paused ? theme.warningSoft : theme.surface,
                color: i === 0 && paused ? theme.warning : theme.textSoft,
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
