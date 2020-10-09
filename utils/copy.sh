#!/bin/bash

cp node_modules/playwright/browsers.json out/binary/mac
cp node_modules/playwright/browsers.json out/binary/linux
cp node_modules/playwright/browsers.json out/binary/win32_x64

cp node_modules/playwright/third_party/ffmpeg/COPYING.GPLv3 out/binary/mac/ffmpeg.COPYING.GPLv3
cp node_modules/playwright/third_party/ffmpeg/COPYING.GPLv3 out/binary/linux/ffmpeg.COPYING.GPLv3
cp node_modules/playwright/third_party/ffmpeg/COPYING.GPLv3 out/binary/win32_x64/ffmpeg.COPYING.GPLv3

cp node_modules/playwright/third_party/ffmpeg/ffmpeg-mac out/binary/mac
cp node_modules/playwright/third_party/ffmpeg/ffmpeg-linux out/binary/linux
cp node_modules/playwright/third_party/ffmpeg/ffmpeg-win64.exe out/binary/win32_x64

cp node_modules/playwright/bin/PrintDeps.exe out/binary/win32_x64
