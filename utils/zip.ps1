$version=$args[0]

cd out\binary\mac
Compress-Archive -Path * -DestinationPath out\zip\playwright-cli-$version-mac.zip
cd ..\..\..

cd out\binary\linux
Compress-Archive -Path * -DestinationPath out\zip\playwright-cli-$version-linux.zip
cd ..\..\..

cd out\binary\win32
Compress-Archive -Path * -DestinationPath out\zip\playwright-cli-$version-win32.zip
cd ..\..\..

cd out\binary\win64
Compress-Archive -Path * -DestinationPath out\zip\playwright-cli-$version-win32_x64.zip
cd ..\..\..
