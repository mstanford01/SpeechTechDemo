# Third-party notices

## Chatterbox

MIT License

Copyright (c) 2025 Resemble AI

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Experis branding

The logo in `public/experis-logo.svg` was retrieved from the official Experis website for this requested demo. It is not covered by the Chatterbox MIT license. Experis and its logo remain trademarks of their respective owner.

Source: https://www.experis.com/-/jssmedia/project/manpowergroup/admin/logos/experis-blue-logo.svg

Other bundled dependencies retain their own licenses.

## Fixed voice presets (VCTK)

`server/presets/female.wav` and `server/presets/male.wav` are the p329_023 and p311_023 mic1 recordings, respectively, from the CSTR VCTK Corpus, mirrored by Kyutai. Both speakers are listed as American in the corpus speaker metadata (p329 female, p311 male from Iowa). They are included unchanged and used as fixed conditioning presets; users cannot upload voices.

Attribution: Yamagishi, Junichi; Veaux, Christophe; MacDonald, Kirsten. (2019). CSTR VCTK Corpus: English Multi-speaker Corpus for CSTR Voice Cloning Toolkit (version 0.92), [sound]. University of Edinburgh, Centre for Speech Technology Research (CSTR). https://doi.org/10.7488/ds/2645.

License: Creative Commons Attribution 4.0 International: https://creativecommons.org/licenses/by/4.0/

Sources:
- https://huggingface.co/kyutai/tts-voices/resolve/main/vctk/p225_023.wav
- https://huggingface.co/kyutai/tts-voices/resolve/main/vctk/p226_023.wav
- https://huggingface.co/kyutai/tts-voices/blob/main/README.md

Podcast audio is newly generated speech conditioned on these presets, with volume normalization, slight tempo adjustment and pauses. The recordings do not imply endorsement by the corpus creators or speakers.

## Local discussion model

Qwen3-4B-Instruct-2507 (Qwen), converted to 4-bit MLX format by mlx-community. Apache License 2.0. Weights are downloaded to the local cache and are not included in this repository.

- https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507
- https://huggingface.co/mlx-community/Qwen3-4B-Instruct-2507-4bit
- https://www.apache.org/licenses/LICENSE-2.0
