FROM python:3.12-slim

WORKDIR /app

# 依存関係インストール
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションコード
COPY backend/ ./backend/

# 環境変数デフォルト
ENV ENVIRONMENT=production
ENV PORT=8000

EXPOSE 8000

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
