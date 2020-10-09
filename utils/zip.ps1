$version=$env:npm_package_version

$path = "out\zip"
If(!(test-path $path))
{
    New-Item -ItemType Directory -Force -Path $path
}

cd out\binary\win32
Compress-Archive -Force -Path * -DestinationPath ..\..\zip\playwright-cli-$version-win32.zip
cd ..\..\..
