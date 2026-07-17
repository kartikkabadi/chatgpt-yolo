import {Config} from '@remotion/cli/config';

// Deterministic, launch-spec render settings.
// PNG frames keep the encoder in limited-range yuv420p (not full-range yuvj420p).
Config.setVideoImageFormat('png');
Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
Config.overrideWebpackConfig((c) => c);

// Chrome on this environment must run without a sandbox.
Config.setChromiumHeadlessMode(true);
