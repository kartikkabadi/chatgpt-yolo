import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {fontStack, monoStack, theme} from '../theme';

type QueueItem = {text: string; state: 'pending' | 'sending'};

const QUEUE: QueueItem[] = [
  {text: 'Review the implementation for concrete edge cases.', state: 'pending'},
  {text: 'Run the complete validation suite.', state: 'pending'},
  {text: 'Fix any reproducible failures.', state: 'pending'},
];

// Reconstructed YOLO popup, styled with the real styles.css tokens, so queue
// rows can animate (insertion / direct manipulation) rather than being baked.
export const YoloCard: React.FC<{insertStartFrame: number}> = ({
  insertStartFrame,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const visibleCount = QUEUE.filter(
    (_, i) => frame >= insertStartFrame + i * 24
  ).length;

  return (
    <div
      style={{
        width: 560,
        background: theme.canvas,
        borderRadius: theme.radiusLg + 6,
        border: `1px solid ${theme.border}`,
        boxShadow: theme.shadow,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        fontFamily: fontStack,
        color: theme.text,
      }}
    >
      {/* header */}
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
          <span
            style={{
              width: 44,
              height: 44,
              borderRadius: 13,
              display: 'grid',
              placeItems: 'center',
              background: theme.primary,
              color: theme.primaryText,
              fontSize: 18,
              fontWeight: 800,
              boxShadow: theme.shadow,
            }}
          >
            Y
          </span>
          <div>
            <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
              <span style={{fontSize: 24, fontWeight: 700}}>YOLO</span>
              <span
                style={{
                  borderRadius: 999,
                  padding: '3px 10px',
                  background: theme.successSoft,
                  color: theme.success,
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                Running
              </span>
            </div>
            <div style={{color: theme.textFaint, fontSize: 15}}>Current conversation</div>
          </div>
        </div>
        <div
          style={{
            width: 52,
            height: 30,
            borderRadius: 999,
            border: `1px solid ${theme.borderStrong}`,
            background: theme.primary,
            position: 'relative',
          }}
        >
          <span
            style={{
              position: 'absolute',
              width: 22,
              height: 22,
              borderRadius: '50%',
              top: 3,
              right: 3,
              background: theme.surface,
            }}
          />
        </div>
      </div>

      {/* control strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '10px 14px',
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: theme.radiusMd,
          fontSize: 15,
        }}
      >
        <span style={{color: theme.textSoft}}>Mode</span>
        <span style={{fontWeight: 700}}>Balanced</span>
        <span style={{width: 1, height: 18, background: theme.border}} />
        <span style={{fontWeight: 700}}>{visibleCount} queued</span>
        <span style={{flex: 1}} />
        <span style={{color: theme.textFaint, fontFamily: monoStack, fontSize: 13}}>
          ⌘/Ctrl ↵ queue
        </span>
      </div>

      {/* queue panel */}
      <div
        style={{
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: theme.radiusMd,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            padding: '14px 16px',
            borderBottom: `1px solid ${theme.border}`,
          }}
        >
          <div>
            <div style={{fontSize: 18, fontWeight: 700}}>Queue</div>
            <div style={{color: theme.textFaint, fontSize: 13}}>
              Ordered work for this conversation
            </div>
          </div>
          <div style={{display: 'flex', gap: 8}}>
            {['Pause', 'Send next'].map((label) => {
              const isSend = label === 'Send next';
              // "Send next" pulses once toward the end of the scene.
              const pulse = isSend
                ? interpolate(
                    frame,
                    [insertStartFrame + 84, insertStartFrame + 96, insertStartFrame + 108],
                    [1, 1.08, 1],
                    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
                  )
                : 1;
              return (
                <span
                  key={label}
                  style={{
                    padding: '6px 12px',
                    borderRadius: theme.radiusSm,
                    border: `1px solid ${theme.border}`,
                    background: isSend ? theme.primary : theme.surface,
                    color: isSend ? theme.primaryText : theme.textSoft,
                    fontSize: 13,
                    fontWeight: 600,
                    transform: `scale(${pulse})`,
                  }}
                >
                  {label}
                </span>
              );
            })}
          </div>
        </div>

        <div style={{display: 'flex', flexDirection: 'column'}}>
          {QUEUE.map((item, i) => {
            const start = insertStartFrame + i * 24;
            const enter = spring({frame: frame - start, fps, config: {damping: 200}});
            const opacity = interpolate(enter, [0, 1], [0, 1]);
            const y = interpolate(enter, [0, 1], [26, 0]);
            const x = interpolate(enter, [0, 1], [40, 0]);
            // Top row gets a controlled highlight sweep near the end.
            const highlight =
              i === 0
                ? interpolate(
                    frame,
                    [insertStartFrame + 84, insertStartFrame + 96, insertStartFrame + 108],
                    [0, 1, 0],
                    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
                  )
                : 0;
            return (
              <div
                key={item.text}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '14px 16px',
                  borderBottom: i < QUEUE.length - 1 ? `1px solid ${theme.border}` : 'none',
                  opacity,
                  transform: `translate(${x}px, ${y}px)`,
                  background: `rgba(36,120,75,${0.06 * highlight})`,
                }}
              >
                <span style={{color: theme.textFaint, fontSize: 18, lineHeight: '20px'}}>⋮⋮</span>
                <div style={{flex: 1}}>
                  <div style={{fontSize: 16, fontWeight: 600, lineHeight: 1.35}}>{item.text}</div>
                  <div style={{display: 'flex', gap: 10, marginTop: 6, fontSize: 13, color: theme.textFaint}}>
                    <span>#{i + 1}</span>
                    <span>{item.state}</span>
                  </div>
                </div>
                <div style={{display: 'flex', gap: 10, color: theme.textFaint, fontSize: 14}}>
                  <span>↑</span>
                  <span>↓</span>
                  <span>Edit</span>
                  <span style={{color: theme.danger}}>×</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
