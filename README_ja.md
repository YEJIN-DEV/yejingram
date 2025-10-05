# Yejingram

ウェブチャット形式の LLM 対話プラットフォーム、Yejingram（イェジングラム）です。

[한국어](./README.md) / [English](./README_en.md) / [日本語](./README_ja.md)

---

## 謝辞

本プロジェクトは [dkfk5326/ArisuTalk](https://github.com/dkfk5326/ArisuTalk) にインスパイアされて構築されました。多数の機能は元のアイデアを基に追加・改良されています。

## インストール手順

1. リポジトリをクローン:

   ```bash
   git clone https://github.com/YEJIN-DEV/yejingram.git
   cd yejingram
   ```

2. 依存関係をインストール:

   ```bash
   npm install
   ```

3. 開発サーバーを起動:
   ```bash
   npm run dev
   ```

## コントリビューション

バグ報告、機能提案、Pull Request など、あらゆる形でのご貢献を歓迎します！

フォーク後、新しいブランチを作成して作業し、変更をコミットしてから Pull Request を送ってください。できる限り早くレビューし、マージします。

> Pull Request は `dev` ブランチ宛てでお願いします。

## ライセンス

本プロジェクトは GPL-3.0 ライセンスの下で公開されています。詳細は [LICENSE](./LICENSE) をご覧ください。

## 同期サーバー（optional）

軽量な Express ベースの同期サーバーが同梱されています。保存・更新・削除などの状態変化が発生した際に、リモートサーバーへ同期します。

サーバー起動:

```
npm run server
```

デフォルト URL: http://hostname:3001

ヘルスチェック:

```
GET /api/health -> { ok: true }
```

---

ご意見・改善提案などありましたら、Issue や PR をぜひお寄せください。

ありがとうございます！
