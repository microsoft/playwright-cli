# Copyright (c) Microsoft Corporation.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import inspect
import os
import stat
import subprocess
import sys
from pathlib import Path


def get_file_dirname() -> Path:
    """Returns the callee (`__file__`) directory name"""
    frame = inspect.stack()[1]
    module = inspect.getmodule(frame[0])
    assert module
    return Path(module.__file__).parent.absolute()

def make_file_executable(file_path: Path) -> Path:
    """Makes a file executable."""
    file_path.chmod(file_path.stat().st_mode | stat.S_IEXEC)
    return file_path

def compute_driver_executable() -> Path:
    package_path = get_file_dirname()
    platform = sys.platform
    if platform == "darwin":
        path = package_path / "driver-darwin"
        return make_file_executable(path)
    elif platform == "linux":
        path = package_path / "driver-linux"
        return make_file_executable(path)
    elif platform == "win32":
        result = package_path / "driver-win32-amd64.exe"
        if result.exists():
            return result
        return package_path / "driver-win32.exe"

    path = package_path / "driver-linux"
    return make_file_executable(path)

driver_executable = compute_driver_executable()
my_env = os.environ.copy()
my_env["PLAYWRIGHT_CLI_TARGET_LANG"] = "python"
subprocess.run([driver_executable, *sys.argv[1:]], env=my_env)
