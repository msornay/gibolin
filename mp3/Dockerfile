FROM ubuntu:16.04

RUN mkdir /app
ADD mp3.py /app/
WORKDIR /app

RUN apt-get update && apt-get install -y ffmpeg

CMD ["python3 mp3.py $MP3_ROOT $MP3_DEST"]
