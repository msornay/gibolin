import unittest

import mp3


class TestMP3(unittest.TestCase):

    def test_mp3_path(self):
        mp3_path = mp3.to_mp3_path("/data/music/artist/album/title.flac")
        self.assertEqual(mp3_path, "/data/mp3/artist/album/title.flac.mp3")

