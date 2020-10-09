$version=$env:npm_package_version

az storage blob upload -c builds --account-key $env:AZ_ACCOUNT_KEY --account-name $env:AZ_ACCOUNT_NAME -f out\zip\playwright-cli-$version-win32.zip -n "cli\playwright-cli-$version-win32.zip"
