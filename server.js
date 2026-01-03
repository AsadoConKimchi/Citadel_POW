import express from "express";
import session from "express-session";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_REDIRECT_URI,
  DISCORD_GUILD_ID,
  DISCORD_ROLE_ID,
  DISCORD_GUILD_NAME = "citadel.sx",
  DISCORD_WEBHOOK_URL,
  BLINK_LIGHTNING_ADDRESS,
  SESSION_SECRET,
  PORT = 3000,
} = process.env;

const hasDiscordConfig =
  DISCORD_CLIENT_ID &&
  DISCORD_CLIENT_SECRET &&
  DISCORD_REDIRECT_URI &&
  DISCORD_GUILD_ID &&
  DISCORD_ROLE_ID;

app.use(express.json({ limit: "10mb" }));
app.use(
  session({
    secret: SESSION_SECRET || "citadel-idioma-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
    },
  })
);

app.use(express.static(__dirname));

const pendingDonations = new Map();

const createDonationId = () => crypto.randomUUID();

const buildDonationComment = (note, donationId, maxLength) => {
  const base = note?.trim() ? note.trim() : "기부";
  const suffix = ` donation:${donationId}`;
  const max = maxLength ? Math.max(0, maxLength) : 160;
  const trimmedBase = base.length + suffix.length > max ? base.slice(0, max - suffix.length) : base;
  return `${trimmedBase}${suffix}`;
};

const parseLightningAddress = (address) => {
  if (!address || !address.includes("@")) {
    return null;
  }
  const [name, domain] = address.split("@");
  if (!name || !domain) {
    return null;
  }
  return { name, domain };
};

const sendDiscordShare = async ({ dataUrl, plan, studyTime, goalRate, minutes, sats, donationMode, wordCount, username, donationNote }) => {
  if (!DISCORD_WEBHOOK_URL) {
    throw new Error("DISCORD_WEBHOOK_URL이 설정되지 않았습니다.");
  }
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    throw new Error("이미지 포맷이 올바르지 않습니다.");
  }
  const form = new FormData();
  const noteLabel = donationNote?.trim() ? `메모: ${donationNote.trim()}` : "메모: 없음";
  const payload = {
    content: `${username || "사용자"}님께서 학습완료 후, ${sats} sats 기부!\n${noteLabel}`,
  };
  form.append("payload_json", JSON.stringify(payload));
  const file = new Blob([parsed.buffer], { type: parsed.mime });
  form.append("file", file, "citadel_idioma_badge.png");

  const response = await fetch(DISCORD_WEBHOOK_URL, {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Discord webhook failed");
  }
};

const oauthUrl = () => {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: "code",
    scope: "identify guilds.members.read",
  });
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
};

const oauthAppUrl = () => {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: "code",
    scope: "identify guilds.members.read",
    prompt: "consent",
  });
  return `discord://-/oauth2/authorize?${params.toString()}`;
};

const exchangeCode = async (code) => {
  const body = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    client_secret: DISCORD_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: DISCORD_REDIRECT_URI,
  });

  const response = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`token exchange failed: ${text}`);
  }

  return response.json();
};

const fetchDiscord = async (url, accessToken) => {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`discord api failed: ${text}`);
  }
  return response.json();
};

app.get("/auth/discord", (req, res) => {
  if (!hasDiscordConfig) {
    res.status(500).send("Discord 환경 변수가 설정되지 않았습니다.");
    return;
  }
  res.redirect(oauthUrl());
});

app.get("/auth/discord/web", (req, res) => {
  if (!hasDiscordConfig) {
    res.status(500).send("Discord 환경 변수가 설정되지 않았습니다.");
    return;
  }
  res.redirect(oauthUrl());
});

app.get("/auth/discord/app", (req, res) => {
  if (!hasDiscordConfig) {
    res.status(500).send("Discord 환경 변수가 설정되지 않았습니다.");
    return;
  }
  const appUrl = oauthAppUrl();
  const webUrl = oauthUrl();
  res.send(`<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Discord App Login</title>
  </head>
  <body>
    <p>Discord 앱을 여는 중입니다...</p>
    <script>
      const appUrl = ${JSON.stringify(appUrl)};
      const webUrl = ${JSON.stringify(webUrl)};
      window.location.href = appUrl;
      setTimeout(() => {
        window.location.href = webUrl;
      }, 1200);
    </script>
  </body>
</html>`);
});

app.get("/auth/discord/callback", async (req, res) => {
  if (!hasDiscordConfig) {
    res.status(500).send("Discord 환경 변수가 설정되지 않았습니다.");
    return;
  }

  const { code } = req.query;
  if (!code) {
    res.status(400).send("OAuth 코드가 없습니다.");
    return;
  }

  try {
    const token = await exchangeCode(code);
    const user = await fetchDiscord("https://discord.com/api/users/@me", token.access_token);
    const member = await fetchDiscord(
      `https://discord.com/api/users/@me/guilds/${DISCORD_GUILD_ID}/member`,
      token.access_token
    );
    const roles = member.roles || [];
    const authorized = roles.includes(DISCORD_ROLE_ID);

    req.session.user = {
      id: user.id,
      username: `${user.username}#${user.discriminator}`,
      avatar: user.avatar,
      banner: user.banner,
    };
    req.session.guild = {
      id: DISCORD_GUILD_ID,
      name: DISCORD_GUILD_NAME,
      roles,
    };
    req.session.authorized = authorized;

    if (!authorized) {
      res.redirect("/?unauthorized=1");
      return;
    }

    res.redirect("/");
  } catch (error) {
    res.status(500).send("Discord 인증 중 오류가 발생했습니다.");
  }
});

app.get("/api/session", (req, res) => {
  const authenticated = Boolean(req.session.user);
  res.json({
    authenticated,
    authorized: authenticated ? Boolean(req.session.authorized) : false,
    user: req.session.user || null,
    guild: req.session.guild || null,
  });
});

app.get("/api/config", (req, res) => {
  res.json({
    blinkAddress: BLINK_LIGHTNING_ADDRESS || "",
  });
});

app.post("/api/donation-invoice", async (req, res) => {
  if (!BLINK_LIGHTNING_ADDRESS) {
    res.status(400).json({ message: "BLINK_LIGHTNING_ADDRESS가 설정되지 않았습니다." });
    return;
  }

  const {
    dataUrl,
    plan,
    studyTime,
    goalRate,
    minutes,
    sats,
    donationMode,
    donationScope,
    wordCount,
    donationNote,
    username,
  } = req.body || {};

  if (!dataUrl) {
    res.status(400).json({ message: "공유할 이미지가 없습니다." });
    return;
  }

  const satsNumber = Number(sats || 0);
  if (!satsNumber || satsNumber <= 0) {
    res.status(400).json({ message: "기부할 사토시 금액이 올바르지 않습니다." });
    return;
  }

  const addressParts = parseLightningAddress(BLINK_LIGHTNING_ADDRESS);
  if (!addressParts) {
    res.status(400).json({ message: "BLINK_LIGHTNING_ADDRESS 형식이 올바르지 않습니다." });
    return;
  }

  try {
    const lnurlResponse = await fetch(
      `https://${addressParts.domain}/.well-known/lnurlp/${addressParts.name}`
    );
    if (!lnurlResponse.ok) {
      const text = await lnurlResponse.text();
      res.status(502).json({ message: text || "LNURL 조회에 실패했습니다." });
      return;
    }
    const lnurlData = await lnurlResponse.json();
    const callback = lnurlData?.callback;
    if (!callback) {
      res.status(502).json({ message: "LNURL 콜백 주소가 없습니다." });
      return;
    }
    const donationId = createDonationId();
    const amountMsats = satsNumber * 1000;
    const commentAllowed = Number(lnurlData?.commentAllowed || 0);
    const comment = buildDonationComment(donationNote, donationId, commentAllowed);
    const callbackUrl = new URL(callback);
    callbackUrl.searchParams.set("amount", String(amountMsats));
    callbackUrl.searchParams.set("comment", comment);

    const invoiceResponse = await fetch(callbackUrl.toString());
    if (!invoiceResponse.ok) {
      const text = await invoiceResponse.text();
      res.status(502).json({ message: text || "인보이스 생성에 실패했습니다." });
      return;
    }
    const invoiceData = await invoiceResponse.json();
    const invoice = invoiceData?.pr || invoiceData?.paymentRequest;
    if (!invoice) {
      res.status(502).json({ message: "인보이스 응답이 올바르지 않습니다." });
      return;
    }

    pendingDonations.set(donationId, {
      dataUrl,
      plan,
      studyTime,
      goalRate,
      minutes,
      sats: satsNumber,
      donationMode,
      donationScope,
      wordCount,
      donationNote,
      username,
    });

    setTimeout(() => pendingDonations.delete(donationId), 1000 * 60 * 30);

    res.json({ invoice, donationId });
  } catch (error) {
    res.status(500).json({ message: "인보이스 생성 중 오류가 발생했습니다." });
  }
});

app.post("/api/blink/webhook", async (req, res) => {
  try {
    const eventType = req.body?.eventType;
    const memo = req.body?.transaction?.memo || "";
    if (!memo || !eventType || !eventType.startsWith("receive")) {
      res.status(204).end();
      return;
    }
    const match = memo.match(/donation:([a-f0-9-]+)/i);
    if (!match) {
      res.status(204).end();
      return;
    }
    const donationId = match[1];
    const payload = pendingDonations.get(donationId);
    if (!payload) {
      res.status(204).end();
      return;
    }
    await sendDiscordShare(payload);
    pendingDonations.delete(donationId);
    res.status(200).end();
  } catch (error) {
    res.status(200).end();
  }
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.status(204).end();
  });
});

const parseDataUrl = (dataUrl) => {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) {
    return null;
  }
  return {
    mime: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
};

app.post("/api/share", async (req, res) => {
  if (!DISCORD_WEBHOOK_URL) {
    res.status(501).json({ message: "DISCORD_WEBHOOK_URL이 설정되지 않았습니다." });
    return;
  }

  const {
    dataUrl,
    plan,
    studyTime,
    goalRate,
    minutes,
    sats,
    donationMode,
    wordCount,
    donationNote,
  } = req.body || {};
  if (!dataUrl) {
    res.status(400).json({ message: "공유할 이미지가 없습니다." });
    return;
  }

  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    res.status(400).json({ message: "이미지 포맷이 올바르지 않습니다." });
    return;
  }

  try {
    const form = new FormData();
    const planLabel = plan || "학습 목표 미입력";
    const studyTimeLabel = studyTime || `${minutes ?? 0}분`;
    const goalRateLabel = goalRate || "0.0%";
    const modeLabel =
      donationMode === "words" ? `Words: ${wordCount}개` : `Study Time: ${minutes}분`;
    const username = req.session?.user?.username || "사용자";
    await sendDiscordShare({
      dataUrl,
      plan,
      studyTime,
      goalRate,
      minutes,
      sats,
      donationMode,
      wordCount,
      donationNote,
      username,
    });

    res.json({ message: "디스코드 공유를 완료했습니다." });
  } catch (error) {
    res.status(500).json({ message: "디스코드 공유에 실패했습니다.", source: "server" });
  }
});

app.listen(Number(PORT), () => {
  console.log(`Citadel Idioma running on http://localhost:${PORT}`);
});
