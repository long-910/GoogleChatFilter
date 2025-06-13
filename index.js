require('dotenv').config();
const express = require('express');
const axios = require('axios');
const WebSocket = require('ws');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// EJSをテンプレートエンジンとして設定
app.set('view engine', 'ejs');

// Google Chat BotのWebhook URL（Apps ScriptのデプロイURL）
const BOT_WEBHOOK_URL = process.env.BOT_WEBHOOK_URL;

// 静的ファイルの提供
app.use(express.static("public"));

// WebSocketサーバーの設定
const wss = new WebSocket.Server({ noServer: true });

// 接続中のクライアントを管理
const clients = new Set();

wss.on("connection", (ws) => {
  clients.add(ws);
  ws.on("close", () => {
    clients.delete(ws);
  });
});

// ログを全クライアントに送信
function broadcastLog(type, message, details = null) {
  const log = {
    type,
    message,
    details,
    timestamp: new Date().toISOString()
  };
  
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(log));
    }
  });
}

// ログ出力用の関数
function logRequest(req, message) {
  console.log("\n[リクエスト]", message);
  console.log("- タイムスタンプ:", new Date().toLocaleString());
  console.log("- リクエスト内容:", JSON.stringify(req.body));
  
  broadcastLog("request", message, {
    timestamp: new Date().toLocaleString(),
    requestBody: req.body
  });
}

function logProcessing(message, details) {
  console.log("\n[処理]", message);
  Object.entries(details).forEach(([key, value]) => {
    console.log("-", key + ":", value);
  });
  
  broadcastLog("processing", message, details);
}

function logResponse(message, details) {
  console.log("\n[レスポンス]", message);
  Object.entries(details).forEach(([key, value]) => {
    console.log("-", key + ":", value);
  });
  
  broadcastLog("response", message, details);
}

function logError(message, error, req) {
  console.error("\n[エラー]", message);
  console.error("- ステータスコード:", error.response?.status);
  console.error("- エラー内容:", error.message);
  console.error("- 送信先:", error.config?.url?.includes("chat.googleapis.com") ? "Google Chat" : "Slack");
  console.error("- Webhook URL:", error.config?.url);
  console.error("- 送信内容:", req.body.text);
  if (error.response?.data) {
    console.error("- レスポンス:", JSON.stringify(error.response.data));
  }
  console.error("\n");
  
  broadcastLog("error", message, {
    statusCode: error.response?.status,
    errorMessage: error.message,
    destination: error.config?.url?.includes("chat.googleapis.com") ? "Google Chat" : "Slack",
    webhookUrl: error.config?.url,
    requestText: req.body.text,
    response: error.response?.data
  });
}

// トップページの表示
app.get('/', (req, res) => {
  res.render('index');
});

// 設定ページの表示
app.get('/settings', (req, res) => {
  res.render('settings');
});

// 現在の設定を取得
app.get('/api/settings', (req, res) => {
  try {
    const fs = require('fs');
    const envPath = '.env';
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    const settings = {
      accessToken: process.env.ACCESS_TOKEN || '',
      webhookUrl: process.env.BOT_WEBHOOK_URL || ''
    };
    
    res.json(settings);
  } catch (error) {
    console.error('設定の読み込みに失敗:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 設定の保存
app.post('/api/settings', (req, res) => {
  try {
    const { token, webhookUrl } = req.body;
    if (!webhookUrl) {
      throw new Error('Webhook URLが指定されていません');
    }

    // 設定を.envファイルに保存
    const fs = require('fs');
    const envPath = '.env';
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // 既存の設定を更新または追加
    const settings = {
      BOT_WEBHOOK_URL: webhookUrl,
      ACCESS_TOKEN: token || ''
    };
    
    Object.entries(settings).forEach(([key, value]) => {
      if (envContent.includes(`${key}=`)) {
        envContent = envContent.replace(new RegExp(`${key}=.*`), `${key}=${value}`);
      } else {
        envContent += `\n${key}=${value}`;
      }
    });
    
    fs.writeFileSync(envPath, envContent);
    
    // 環境変数を更新
    process.env.BOT_WEBHOOK_URL = webhookUrl;
    process.env.ACCESS_TOKEN = token || '';
    
    res.json({ success: true, message: '設定を保存しました' });
  } catch (error) {
    console.error('設定の保存に失敗:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Webhook受信エンドポイント
app.post('/webhook', async (req, res) => {
  try {
    logRequest(req, "メッセージを受信");

    const { text } = req.body;
    if (!text) {
      throw new Error("テキストが指定されていません");
    }

    // Authorizationヘッダーからトークンを取得
    const authHeader = req.headers.authorization;
    console.log('Authorization Header:', authHeader);

    // アクセストークンが設定されている場合のみ認証をチェック
    if (process.env.ACCESS_TOKEN) {
      if (!authHeader) {
        throw new Error("認証トークンが指定されていません");
      }

      if (!authHeader.startsWith('Bearer ')) {
        throw new Error("認証トークンの形式が不正です");
      }

      // Base64デコード
      const encodedToken = authHeader.split(' ')[1];
      let token;
      try {
        token = Buffer.from(encodedToken, 'base64').toString('utf-8');
      } catch (error) {
        throw new Error("認証トークンのデコードに失敗しました");
      }

      // トークンの検証
      if (token !== process.env.ACCESS_TOKEN) {
        throw new Error("認証トークンが一致しません");
      }
    }

    console.log('Decoded Token:', token ? '存在します' : '存在しません');

    logProcessing("メッセージの処理を開始", {
      text: text,
      "送信先": "GAS Bot",
      "URL": process.env.BOT_WEBHOOK_URL,
      "認証": process.env.ACCESS_TOKEN ? "Bearer認証を使用" : "認証なし"
    });

    // GASのBotに転送（トークンをヘッダーに含める）
    const response = await axios.post(process.env.BOT_WEBHOOK_URL, { text }, {
      headers: {
        'Authorization': process.env.ACCESS_TOKEN ? `Bearer ${Buffer.from(process.env.ACCESS_TOKEN).toString('base64')}` : undefined,
        'Content-Type': 'application/json'
      }
    });
    
    logResponse("処理結果", {
      status: "成功",
      response: JSON.stringify(response.data)
    });

    res.json({ success: true, message: "送信成功" });
  } catch (error) {
    logError("メッセージ送信に失敗しました", error, req);

    res.status(500).json({
      success: false,
      error: "送信失敗: " + error.message,
      details: {
        status: error.response?.status,
        message: error.message,
        response: error.response?.data
      }
    });
  }
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  const message = `サーバーが起動しました: http://localhost:${PORT}`;
  console.log(`\n[起動] ${message}`);
  broadcastLog("startup", message);
});

// WebSocketサーバーをHTTPサーバーに統合
server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
}); 
