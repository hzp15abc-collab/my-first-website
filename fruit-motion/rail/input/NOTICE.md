# Rail Motion public test: third-party notices

All shipped third-party files are a byte-identical subset of the pinned W4 B01 experiment. Only MoveNet is included. No old game runtime or proprietary assets are reused. Original minified-file copyright and license headers are retained. The included Apache-2.0 text is `vendor/LICENSE-Apache-2.0.txt`.

| Runtime | Pin | Source/license |
|---|---|---|
| TensorFlow.js and WASM backend (ES2017 UMD) | 4.22.0 | [TFJS Apache-2.0](https://github.com/tensorflow/tfjs/blob/master/LICENSE) |
| TFJS pose detection | 2.1.3 | [TFJS models Apache-2.0](https://github.com/tensorflow/tfjs-models/blob/master/LICENSE) |
| MoveNet SinglePose Lightning | TFJS v4 | [official archive entry](https://www.kaggle.com/api/v1/models/google/movenet/tfJs/singlepose-lightning/4/download), [Google model card](https://storage.googleapis.com/movenet/MoveNet.SinglePose%20Model%20Card.pdf), Apache-2.0 |

`provenance/copied-runtime.json` lists the actual copied subset with SHA-256 and byte counts. Broader validation evidence is retained in the private development archive.

This is a public-playtest validation build, not a selected production model or stable release. Runtime resources are served from the same origin only. Camera frames are processed locally; no microphone, recording, storage or image upload. Device inference and iPad/Safari/TV acceptance remain unverified.
