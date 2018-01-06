import argparse
import os
import os.path
import pathlib
import subprocess

def to_mp3_path(music_path):
    return str('mp3' / pathlib.Path(*(pathlib.Path(music_path).parts[1:])))

if __name__ == '__main__':
    for root, dirs, files in os.walk('music'):
        for name in files:
            src = os.path.join(root, name)
            dst = to_mp3_path(src) + '.mp3'

            if os.path.exists(dst):
                continue

            os.makedirs(os.path.dirname(dst), exist_ok=True)

            if name.endswith('.flac'):
                subprocess.run(['ffmpeg', '-i', src, "-q:a", "0", dst])
            elif name.endswith('.mp3'):
                os.symlink(os.path.abspath(src), dst)
