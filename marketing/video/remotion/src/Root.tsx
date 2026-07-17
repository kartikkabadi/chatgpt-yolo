import React from 'react';
import {Composition} from 'remotion';
import {Spike, TOTAL_DURATION} from './Spike';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Spike"
      component={Spike}
      durationInFrames={TOTAL_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
