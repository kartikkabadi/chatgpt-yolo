# YOLO for ChatGPT

A local-first Chrome extension that adds a durable prompt queue and bounded `/goal` / `/loop` workflows to ChatGPT conversations.

## Install

1. Download `yolo-v1.1.0.zip` from the [v1.1.0 release](https://github.com/kartikkabadi/chatgpt-yolo/releases/tag/v1.1.0).
2. Optional: verify the attestation:
   ```bash
   gh attestation verify yolo-v1.1.0.zip --repo kartikkabadi/chatgpt-yolo
   ```
3. Unzip and load the `yolo` folder as an unpacked extension at `chrome://extensions` (Developer mode → Load unpacked).

## Build from source

```bash
git clone https://github.com/kartikkabadi/chatgpt-yolo.git
cd chatgpt-yolo
npm run validate:core && npm run package
```

Then load `dist/yolo` as an unpacked extension.

## Use

- Open any ChatGPT conversation at `https://chatgpt.com`.
- Click the YOLO popup to queue follow-up instructions.
- Type `/` in an empty ChatGPT composer to open the YOLO command palette.
- Use `/goal` or `/loop` to run a bounded workflow with Pause, Edit, and Stop controls.
- Visit the extension options page to adjust profiles, limits, and recovery behavior.

## Privacy

YOLO's settings, queues, templates, and workflow state are stored in `chrome.storage.local` in your browser. YOLO has no hosted backend and no telemetry. Queued prompts are sent to ChatGPT through the normal composer, exactly as if you typed them.

## License and notices

This project is licensed under the MIT License. The extension archive and runtime do not include any marketing or vendored animation code; the repository's `marketing/video/hyperframes/` source contains separately licensed GreenSock GSAP vendor files. See `NOTICE.md` for details.
