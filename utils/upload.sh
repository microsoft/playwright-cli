#!/bin/bash

az storage blob upload -c builds --account-key ${AZ_ACCOUNT_KEY} --account-name ${AZ_ACCOUNT_NAME} -f out/zip/playwright-cli-${npm_package_version}-mac.zip -n "cli/playwright-cli-${npm_package_version}-mac.zip"
az storage blob upload -c builds --account-key ${AZ_ACCOUNT_KEY} --account-name ${AZ_ACCOUNT_NAME} -f out/zip/playwright-cli-${npm_package_version}-linux.zip -n "cli/playwright-cli-${npm_package_version}-linux.zip"
az storage blob upload -c builds --account-key ${AZ_ACCOUNT_KEY} --account-name ${AZ_ACCOUNT_NAME} -f out/zip/playwright-cli-${npm_package_version}-win32_x64.zip -n "cli/playwright-cli-${npm_package_version}-win32_x64.zip"
