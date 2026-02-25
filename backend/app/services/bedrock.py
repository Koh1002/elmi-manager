"""
Amazon Bedrock (Claude) を使った AI 分析サービス。
TODO(AWS): Bedrock InvokeModel の IAM 権限を App Runner ロールに付与後に有効化。
"""

import json

from app.config import settings


class BedrockService:
    def __init__(self) -> None:
        self.model_id = settings.BEDROCK_MODEL_ID
        self._client = None

    @property
    def client(self):
        if self._client is None:
            if settings.ENVIRONMENT == "local":
                return None
            # TODO(AWS): 実接続時に有効化
            # import boto3
            # self._client = boto3.client(
            #     "bedrock-runtime", region_name=settings.AWS_REGION
            # )
        return self._client

    def analyze_error(
        self,
        query: str,
        generated_sql: str,
        error_message: str,
    ) -> dict:
        """
        エラーの原因分析と改善提案を生成。
        Returns: {"analysis": str, "suggestions": list[str]}
        """
        if self.client is None:
            # ローカル開発用モック応答
            return {
                "analysis": (
                    f"■ 原因\n"
                    f"リクエスト「{query}」に対して生成されたSQLでエラーが発生しました。\n"
                    f"エラー内容: {error_message}\n\n"
                    f"■ 推定原因\n"
                    f"カラムマッピング定義またはテーブルスキーマに不足がある可能性があります。\n"
                    f"Bedrockが推測でカラム名を生成しましたが、実テーブルに該当しませんでした。"
                ),
                "suggestions": [
                    "config/column_mapping.json に不足しているマッピングを追加",
                    "prompts/sql_generation.json のルールにカラム存在チェックのヒントを追加",
                    "テーブルスキーマ定義を最新の状態に更新",
                ],
            }

        # TODO(AWS): 実Bedrock呼び出し
        # prompt = f"""以下のエラーを分析し、改善提案をJSON形式で返してください。
        #
        # ユーザーリクエスト: {query}
        # 生成されたSQL: {generated_sql}
        # エラーメッセージ: {error_message}
        #
        # 以下のJSON形式で返答:
        # {{"analysis": "原因の説明", "suggestions": ["提案1", "提案2"]}}
        # """
        #
        # response = self.client.invoke_model(
        #     modelId=self.model_id,
        #     contentType="application/json",
        #     accept="application/json",
        #     body=json.dumps({
        #         "anthropic_version": "bedrock-2023-05-31",
        #         "max_tokens": 2048,
        #         "messages": [{"role": "user", "content": prompt}],
        #     }),
        # )
        # result = json.loads(response["body"].read())
        # content = result["content"][0]["text"]
        # return json.loads(content)
        raise NotImplementedError("Bedrock not configured")


bedrock_service = BedrockService()
