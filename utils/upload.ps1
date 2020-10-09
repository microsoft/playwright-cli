$version=$args[0]
Compress-Archive -Path out\binary\mac -DestinationPath out\zip\playwright-cli-$version-mac.zip
Compress-Archive -Path out\binary\linux -DestinationPath out\zip\playwright-cli-$version-linux.zip
Compress-Archive -Path out\binary\win32 -DestinationPath out\zip\playwright-cli-$version-win32.zip
Compress-Archive -Path out\binary\win64 -DestinationPath out\zip\playwright-cli-$version-win64.zip
az storage blob upload -c builds --account-key $env:AZ_ACCOUNT_KEY --account-name $env:AZ_ACCOUNT_NAME -f out\zip\playwright-cli-$version-mac.zip -n "cli\playwright-cli-$version-mac.zip"
az storage blob upload -c builds --account-key $env:AZ_ACCOUNT_KEY --account-name $env:AZ_ACCOUNT_NAME -f out\zip\playwright-cli-$version-linux.zip -n "cli\playwright-cli-$version-mac.zip"
az storage blob upload -c builds --account-key $env:AZ_ACCOUNT_KEY --account-name $env:AZ_ACCOUNT_NAME -f out\zip\playwright-cli-$version-win32.zip -n "cli\playwright-cli-$version-win32.zip"
az storage blob upload -c builds --account-key $env:AZ_ACCOUNT_KEY --account-name $env:AZ_ACCOUNT_NAME -f out\zip\playwright-cli-$version-win32_x64.zip -n "cli\playwright-cli-$version-win32_x64.zip"
