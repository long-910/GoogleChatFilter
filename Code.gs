// 設定を管理するクラス
class Config {
  constructor() {
    const scriptProperties = PropertiesService.getScriptProperties();
    const spreadsheetId = scriptProperties.getProperty("SPREADSHEET_ID");
    if (!spreadsheetId) {
      throw new Error(
        "SPREADSHEET_IDが設定されていません。スクリプトプロパティを確認してください。"
      );
    }
    this.spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    this.filterSheet = this.spreadsheet.getSheetByName("フィルター設定");
    this.channelSheet = this.spreadsheet.getSheetByName("チャネル設定");
    Logger.log("Config initialized with spreadsheet ID: " + spreadsheetId);
  }

  // フィルター設定を取得
  getFilterRules() {
    const data = this.filterSheet.getDataRange().getValues();
    const rules = [];
    // ヘッダー行をスキップ
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][1]) {
        rules.push({
          pattern: data[i][0],
          channel: data[i][1],
        });
      }
    }
    Logger.log("Filter rules loaded: " + rules.length + " rules found");
    return rules;
  }

  // チャネル設定を取得
  getChannelConfig(channelId) {
    const data = this.channelSheet.getDataRange().getValues();
    // ヘッダー行をスキップ
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === channelId) {
        const config = {
          googleChat: data[i][1] !== "-" ? data[i][1] : null,
          slack: data[i][2] !== "-" ? data[i][2] : null,
        };
        Logger.log(
          "Channel config loaded for " +
            channelId +
            ": " +
            JSON.stringify(config)
        );
        return config;
      }
    }
    Logger.log("No channel config found for: " + channelId);
    return null;
  }
}

// 設定インスタンスを作成
const config = new Config();

function doPost(e) {
  try {
    Logger.log("Received webhook request: " + e.postData.contents);
    var params = JSON.parse(e.postData.contents);
    var text = params.text;

    // メッセージ内容に基づいてチャネルを決定
    var channel = getChannelByMessage(text);
    if (!channel) {
      Logger.log("No matching channel found for message: " + text);
      throw new Error(
        "メッセージにマッチするチャネルが見つかりません: " + text
      );
    }
    Logger.log("Selected channel: " + channel);

    // チャネルのWebhook URLを取得
    var webhookUrls = config.getChannelConfig(channel);
    if (!webhookUrls) {
      Logger.log("No webhook URLs found for channel: " + channel);
      throw new Error("チャネルのWebhook URLが見つかりません: " + channel);
    }

    // Google Chatに送信
    if (webhookUrls.googleChat) {
      Logger.log("Sending to Google Chat...");
      sendToGoogleChat(webhookUrls.googleChat, text);
      Logger.log("Successfully sent to Google Chat");
    } else {
      Logger.log("Skipping Google Chat (URL not configured)");
    }

    // Slackに送信
    if (webhookUrls.slack) {
      Logger.log("Sending to Slack...");
      sendToSlack(webhookUrls.slack, text);
      Logger.log("Successfully sent to Slack");
    } else {
      Logger.log("Skipping Slack (URL not configured)");
    }

    Logger.log("Message processing completed successfully");
    return ContentService.createTextOutput("OK");
  } catch (error) {
    Logger.log("Error occurred: " + error.toString());
    Logger.log("Request content: " + e.postData.contents);
    return ContentService.createTextOutput("エラー: " + error.toString());
  }
}

// メッセージ内容に基づいてチャネルを決定する関数
function getChannelByMessage(message) {
  const rules = config.getFilterRules();
  for (const rule of rules) {
    if (new RegExp(rule.pattern).test(message)) {
      Logger.log("Message matched pattern: " + rule.pattern);
      return rule.channel;
    }
  }
  Logger.log("No pattern matched, using default channel");
  return "normal-channel"; // デフォルトチャネル
}

// Google Chatにメッセージを送信する関数
function sendToGoogleChat(webhookUrl, text) {
  if (!webhookUrl) {
    Logger.log("Google Chat webhook URL is null, skipping");
    return;
  }

  var payload = {
    text: text,
  };

  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
  };

  try {
    Logger.log("Sending to Google Chat webhook: " + webhookUrl);
    UrlFetchApp.fetch(webhookUrl, options);
    Logger.log("Successfully sent to Google Chat");
  } catch (error) {
    Logger.log("Failed to send to Google Chat:");
    Logger.log("- Error: " + error.toString());
    Logger.log("- URL: " + webhookUrl);
    Logger.log("- Content: " + text);
    throw new Error("Google Chatへの送信に失敗しました: " + error.toString());
  }
}

// Slackにメッセージを送信する関数
function sendToSlack(webhookUrl, text) {
  if (!webhookUrl) {
    Logger.log("Slack webhook URL is null, skipping");
    return;
  }

  var payload = {
    text: text,
  };

  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
  };

  try {
    Logger.log("Sending to Slack webhook: " + webhookUrl);
    UrlFetchApp.fetch(webhookUrl, options);
    Logger.log("Successfully sent to Slack");
  } catch (error) {
    Logger.log("Failed to send to Slack:");
    Logger.log("- Error: " + error.toString());
    Logger.log("- URL: " + webhookUrl);
    Logger.log("- Content: " + text);
    throw new Error("Slackへの送信に失敗しました: " + error.toString());
  }
}
