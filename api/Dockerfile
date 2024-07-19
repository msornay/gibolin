FROM python:3.12-bookworm

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

RUN pip install --upgrade pip

COPY . /app/

RUN mkdir -p /app/staticfiles/

RUN pip install -r requirements.txt

EXPOSE 8000

CMD ["./manage.py", "runserver", "0.0.0.0:8000"]
