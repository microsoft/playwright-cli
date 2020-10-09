#!/bin/bash

mkdir -p out/zip

cd out/binary/mac
zip -r ../../zip/playwright-cli-${npm_package_version}-mac.zip .
cd ../../..

cd out/binary/linux
zip -r ../../zip/playwright-cli-${npm_package_version}-linux.zip .
cd ../../..

cd out/binary/win32_x64
zip -r ../../zip/playwright-cli-${npm_package_version}-win32_x64.zip .
cd ../../..
