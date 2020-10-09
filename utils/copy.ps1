copy node_modules\playwright\browsers.json out\binary\mac
copy node_modules\playwright\browsers.json out\binary\linux
copy node_modules\playwright\browsers.json out\binary\win32
copy node_modules\playwright\browsers.json out\binary\win32_x64

copy node_modules\playwright\third_party\ffmpeg\COPYING.GPLv3 out\binary\mac\ffmpeg.COPYING.GPLv3
copy node_modules\playwright\third_party\ffmpeg\COPYING.GPLv3 out\binary\linux\ffmpeg.COPYING.GPLv3
copy node_modules\playwright\third_party\ffmpeg\COPYING.GPLv3 out\binary\win32\ffmpeg.COPYING.GPLv3
copy node_modules\playwright\third_party\ffmpeg\COPYING.GPLv3 out\binary\win32_x64\ffmpeg.COPYING.GPLv3

copy node_modules\playwright\third_party\ffmpeg\ffmpeg-mac out\binary\mac
copy node_modules\playwright\third_party\ffmpeg\ffmpeg-linux out\binary\linux
copy node_modules\playwright\third_party\ffmpeg\ffmpeg-win32.exe out\binary\win32
copy node_modules\playwright\third_party\ffmpeg\ffmpeg-win64.exe out\binary\win32_x64

copy node_modules\playwright\bin\PrintDeps.exe out\binary\win32
copy node_modules\playwright\bin\PrintDeps.exe out\binary\win32_x64
