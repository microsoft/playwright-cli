$version=$env:npm_package_version

$path = "out\zip"
If(!(test-path $path))
{
    New-Item -ItemType Directory -Force -Path $path
}

cd out\binary\mac
Compress-Archive -Force -Path * -DestinationPath ..\..\zip\playwright-cli-$version-mac.zip
cd ..\..\..

cd out\binary\linux
Compress-Archive -Force -Path * -DestinationPath ..\..\zip\playwright-cli-$version-linux.zip
cd ..\..\..

cd out\binary\win32
Compress-Archive -Force -Path * -DestinationPath ..\..\zip\playwright-cli-$version-win32.zip
cd ..\..\..

cd out\binary\win32_x64
Compress-Archive -Force -Path * -DestinationPath ..\..\zip\playwright-cli-$version-win32_x64.zip
cd ..\..\..
