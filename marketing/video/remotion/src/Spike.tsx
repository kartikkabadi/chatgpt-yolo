import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  useCurrentFrame,
} from 'remotion';
import {QueueScene} from './scenes/QueueScene';
import {WorkflowScene} from './scenes/WorkflowScene';

export const QUEUE_DURATION = 140;
export const TRANSITION_START = 118;
export const TRANSITION_END = 140;
export const WORKFLOW_START = TRANSITION_START;
export const TOTAL_DURATION = 225; // 7.5s @ 30fps

export const Spike: React.FC = () => {
  const frame = useCurrentFrame();

  // Directional clip-wipe transition from Queue scene to Workflow scene.
  const wipe = interpolate(frame, [TRANSITION_START, TRANSITION_END], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{backgroundColor: '#f6f6f4'}}>
      <Sequence from={0} durationInFrames={QUEUE_DURATION} name="Queue">
        <QueueScene />
      </Sequence>

      <Sequence from={WORKFLOW_START} name="Workflow">
        <AbsoluteFill
          style={{
            clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)`,
            transform: `translateX(${interpolate(wipe, [0, 1], [40, 0])}px)`,
          }}
        >
          <WorkflowScene />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
