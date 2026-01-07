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
  DISCORD_ROLE_NAME,
  DISCORD_GUILD_NAME = "citadel.sx",
  DISCORD_WEBHOOK_URL,
  BLINK_LIGHTNING_ADDRESS,
  BLINK_API_ENDPOINT,
  BLINK_API_KEY,
  SESSION_SECRET,
  PORT = 3000,
} = process.env;

const DEFAULT_BLINK_ADDRESS = "becadecitadel@blink.sv";
const effectiveBlinkAddress = BLINK_LIGHTNING_ADDRESS || DEFAULT_BLINK_ADDRESS;

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
const pendingDonationsByInvoice = new Map();
let blinkBtcWalletId = "";

const createDonationId = () => crypto.randomUUID();

const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

const bech32Polymod = (values) => {
  const generator = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  values.forEach((value) => {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ value;
    generator.forEach((gen, index) => {
      if ((top >> index) & 1) {
        chk ^= gen;
      }
    });
  });
  return chk;
};

const bech32HrpExpand = (hrp) => [
  ...hrp.split("").map((char) => char.charCodeAt(0) >> 5),
  0,
  ...hrp.split("").map((char) => char.charCodeAt(0) & 31),
];

const bech32CreateChecksum = (hrp, data) => {
  const values = [...bech32HrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0];
  const mod = bech32Polymod(values) ^ 1;
  return Array.from({ length: 6 }, (_, index) => (mod >> (5 * (5 - index))) & 31);
};

const bech32Encode = (hrp, data) => {
  const combined = data.concat(bech32CreateChecksum(hrp, data));
  return `${hrp}1${combined.map((value) => BECH32_CHARSET[value]).join("")}`;
};

const convertBits = (data, from, to, pad) => {
  let acc = 0;
  let bits = 0;
  const result = [];
  const maxv = (1 << to) - 1;
  for (const value of data) {
    if (value < 0 || value >> from) {
      return null;
    }
    acc = (acc << from) | value;
    bits += from;
    while (bits >= to) {
      bits -= to;
      result.push((acc >> bits) & maxv);
    }
  }
  if (pad) {
    if (bits) {
      result.push((acc << (to - bits)) & maxv);
    }
  } else if (bits >= from || ((acc << (to - bits)) & maxv)) {
    return null;
  }
  return result;
};

const encodeLnurl = (url) => {
  const data = Buffer.from(url, "utf8");
  const fiveBitData = convertBits([...data], 8, 5, true);
  if (!fiveBitData) {
    throw new Error("LNURL 인코딩에 실패했습니다.");
  }
  return bech32Encode("lnurl", fiveBitData).toLowerCase();
};

const buildDonationComment = (note, donationId, maxLength, lightningAddress) => {
  const noteLabel = note?.trim() ? `메모: ${note.trim()}` : "메모: 없음";
  const addressLabel = lightningAddress ? `주소: ${lightningAddress}` : "";
  const base = [noteLabel, addressLabel].filter(Boolean).join(" / ");
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

const normalizeInvoice = (invoice) => {
  if (!invoice) {
    return "";
  }
  const trimmed = String(invoice).trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.toLowerCase().startsWith("lightning:")
    ? trimmed.slice("lightning:".length).trim()
    : trimmed;
};

const isBolt11Invoice = (invoice) =>
  Boolean(invoice) && /^ln(bc|tb|tbs|bcrt)[0-9a-z]+$/i.test(invoice.trim());

const resolveInvoiceCandidate = (candidate) => {
  if (!candidate) {
    return "";
  }
  if (typeof candidate === "string") {
    return normalizeInvoice(candidate);
  }
  if (typeof candidate === "object") {
    return normalizeInvoice(
      candidate.paymentRequest ||
        candidate.payment_request ||
        candidate.pr ||
        candidate.invoice ||
        candidate.lnInvoice ||
        candidate.ln_invoice
    );
  }
  return "";
};

const getMentionLabel = ({ userId, username }) => {
  if (userId) {
    return `<@${userId}>`;
  }
  return username || "사용자";
};

const getFileExtension = (mimeType) => {
  if (!mimeType) {
    return "bin";
  }
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("png")) {
    return "png";
  }
  if (normalized.includes("jpeg") || normalized.includes("jpg")) {
    return "jpg";
  }
  if (normalized.includes("webp")) {
    return "webp";
  }
  if (normalized.includes("mp4")) {
    return "mp4";
  }
  if (normalized.includes("quicktime") || normalized.includes("mov")) {
    return "mov";
  }
  return "bin";
};

const sanitizeFilename = (name, fallback) => {
  const safe = String(name || "").replace(/[^\w.-]+/g, "_");
  return safe || fallback;
};

const sendDiscordShare = async ({
  dataUrl,
  plan,
  studyTime,
  goalRate,
  minutes,
  sats,
  donationMode,
  wordCount,
  username,
  donationNote,
  discordUserId,
  videoDataUrl,
  videoFilename,
}) => {
  if (!DISCORD_WEBHOOK_URL) {
    throw new Error("DISCORD_WEBHOOK_URL이 설정되지 않았습니다.");
  }
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    throw new Error("이미지 포맷이 올바르지 않습니다.");
  }
  const form = new FormData();
  const noteLabel = donationNote?.trim() ? `메모: ${donationNote.trim()}` : "메모: 없음";
  const mentionLabel = getMentionLabel({ userId: discordUserId, username });
  const payload = {
    content: `${mentionLabel}님께서 학습 완료 후, **${sats} sats 기부!**\n${noteLabel}`,
  };
  form.append("payload_json", JSON.stringify(payload));
  const file = new Blob([parsed.buffer], { type: parsed.mime });
  form.append("files[0]", file, "citadel_idioma_badge.png");
  if (videoDataUrl) {
    const videoParsed = parseDataUrl(videoDataUrl);
    if (videoParsed) {
      const extension = getFileExtension(videoParsed.mime);
      const safeName = sanitizeFilename(videoFilename, `citadel_study_video.${extension}`);
      const videoBlob = new Blob([videoParsed.buffer], { type: videoParsed.mime });
      form.append("files[1]", videoBlob, safeName);
    }
  }

  const response = await fetch(DISCORD_WEBHOOK_URL, {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Discord webhook failed");
  }
};

const blinkGraphqlRequest = async (query, variables = {}) => {
  if (!BLINK_API_ENDPOINT || !BLINK_API_KEY) {
    throw new Error("Blink API 설정이 필요합니다.");
  }
  const response = await fetch(BLINK_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": BLINK_API_KEY,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Blink GraphQL 요청에 실패했습니다.");
  }
  const data = await response.json();
  if (data?.errors?.length) {
    throw new Error(data.errors.map((error) => error.message).join(", "));
  }
  return data?.data;
};

const getBlinkBtcWalletId = async () => {
  if (blinkBtcWalletId) {
    return blinkBtcWalletId;
  }
  const query = `
    query Me {
      me {
        defaultAccount {
          wallets {
            id
            walletCurrency
          }
        }
      }
    }
  `;
  const result = await blinkGraphqlRequest(query);
  const wallets = result?.me?.defaultAccount?.wallets || [];
  const btcWallet = wallets.find((wallet) => wallet.walletCurrency === "BTC");
  if (!btcWallet?.id) {
    throw new Error("Blink BTC 지갑을 찾지 못했습니다.");
  }
  blinkBtcWalletId = btcWallet.id;
  return blinkBtcWalletId;
};

const createBlinkInvoice = async ({ sats, memo }) => {
  const walletId = await getBlinkBtcWalletId();
  const mutation = `
    mutation LnInvoiceCreate($input: LnInvoiceCreateInput!) {
      lnInvoiceCreate(input: $input) {
        invoice {
          paymentRequest
          paymentHash
          satoshis
        }
        errors {
          message
        }
      }
    }
  `;
  const variables = {
    input: {
      walletId,
      amount: sats,
      memo: memo || "공부 기부",
    },
  };
  const result = await blinkGraphqlRequest(mutation, variables);
  const payload = result?.lnInvoiceCreate;
  if (payload?.errors?.length) {
    throw new Error(payload.errors[0]?.message || "Blink 인보이스 생성 실패");
  }
  const invoice = normalizeInvoice(payload?.invoice?.paymentRequest);
  if (!invoice || !isBolt11Invoice(invoice)) {
    throw new Error("Blink 인보이스가 올바르지 않습니다.");
  }
  return invoice;
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
      username: user.global_name || user.username,
      avatar: user.avatar,
      banner: user.banner,
    };
    req.session.guild = {
      id: DISCORD_GUILD_ID,
      name: DISCORD_GUILD_NAME,
      roles,
      roleName: DISCORD_ROLE_NAME || null,
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

app.post("/api/donation-invoice", async (req, res) => {
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
    videoDataUrl,
    videoFilename,
  } = req.body || {};
  const discordUserId = req.session?.user?.id || "";
  const resolvedUsername = req.session?.user?.username || username || "사용자";

  if (!dataUrl) {
    res.status(400).json({ message: "공유할 이미지가 없습니다." });
    return;
  }

  const satsNumber = Number(sats || 0);
  if (!satsNumber || satsNumber <= 0) {
    res.status(400).json({ message: "기부할 사토시 금액이 올바르지 않습니다." });
    return;
  }

  const donationId = createDonationId();

  try {
    if (BLINK_API_ENDPOINT && BLINK_API_KEY) {
      const memo = buildDonationComment(
        donationNote,
        donationId,
        120,
        effectiveBlinkAddress
      );
      const invoice = await createBlinkInvoice({
        sats: satsNumber,
        memo,
      });
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
        username: resolvedUsername,
        discordUserId,
        videoDataUrl,
        videoFilename,
      });
      pendingDonationsByInvoice.set(invoice, donationId);
      setTimeout(() => {
        pendingDonations.delete(donationId);
        pendingDonationsByInvoice.delete(invoice);
      }, 1000 * 60 * 30);
      res.json({ invoice, donationId });
      return;
    }

    const addressParts = parseLightningAddress(effectiveBlinkAddress);
    if (!addressParts) {
      res
        .status(400)
        .json({ message: "Blink Lightning 주소 형식이 올바르지 않습니다." });
      return;
    }
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
    const minSendable = Number(lnurlData?.minSendable || 0);
    const maxSendable = Number(lnurlData?.maxSendable || 0);
    const amountMsats = satsNumber * 1000;
    if (minSendable && amountMsats < minSendable) {
      res.status(400).json({
        message: `기부 사토시가 최소 금액보다 작습니다. (최소 ${Math.ceil(
          minSendable / 1000
        )} sats)`,
      });
      return;
    }
    if (maxSendable && amountMsats > maxSendable) {
      res.status(400).json({
        message: `기부 사토시가 최대 금액보다 큽니다. (최대 ${Math.floor(
          maxSendable / 1000
        )} sats)`,
      });
      return;
    }
    const commentAllowed = Number(lnurlData?.commentAllowed || 0);
    const comment = commentAllowed
      ? buildDonationComment(
          donationNote,
          donationId,
          commentAllowed,
          effectiveBlinkAddress
        )
      : "";
    const callbackUrl = new URL(callback);
    callbackUrl.searchParams.set("amount", String(amountMsats));
    if (commentAllowed) {
      callbackUrl.searchParams.set("comment", comment);
    }

    const invoiceResponse = await fetch(callbackUrl.toString());
    if (!invoiceResponse.ok) {
      const text = await invoiceResponse.text();
      res.status(502).json({ message: text || "인보이스 생성에 실패했습니다." });
      return;
    }
    const invoiceData = await invoiceResponse.json();
    if (invoiceData?.status === "ERROR") {
      res.status(502).json({
        message: invoiceData?.reason || "LNURL 콜백에서 오류가 반환되었습니다.",
      });
      return;
    }
    const invoice = normalizeInvoice(invoiceData?.pr || invoiceData?.paymentRequest);
    if (!invoice || !isBolt11Invoice(invoice)) {
      res.status(502).json({
        message: "BOLT11 인보이스 생성에 실패했습니다. LNURL 응답을 확인해주세요.",
      });
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
      username: resolvedUsername,
      discordUserId,
      videoDataUrl,
      videoFilename,
    });
    pendingDonationsByInvoice.set(invoice, donationId);

    setTimeout(() => {
      pendingDonations.delete(donationId);
      pendingDonationsByInvoice.delete(invoice);
    }, 1000 * 60 * 30);

    res.json({ invoice, donationId });
  } catch (error) {
    res.status(500).json({ message: "인보이스 생성 중 오류가 발생했습니다." });
  }
});

app.post("/api/donation-lnurl", async (req, res) => {
  const { sats, donationNote } = req.body || {};

  const satsNumber = Number(sats || 0);
  if (!satsNumber || satsNumber <= 0) {
    res.status(400).json({ message: "기부할 사토시 금액이 올바르지 않습니다." });
    return;
  }

  const addressParts = parseLightningAddress(effectiveBlinkAddress);
  if (!addressParts) {
    res
      .status(400)
      .json({ message: "Blink Lightning 주소 형식이 올바르지 않습니다." });
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
    const minSendable = Number(lnurlData?.minSendable || 0);
    const maxSendable = Number(lnurlData?.maxSendable || 0);
    const amountMsats = satsNumber * 1000;
    if (minSendable && amountMsats < minSendable) {
      res.status(400).json({
        message: `기부 사토시가 최소 금액보다 작습니다. (최소 ${Math.ceil(
          minSendable / 1000
        )} sats)`,
      });
      return;
    }
    if (maxSendable && amountMsats > maxSendable) {
      res.status(400).json({
        message: `기부 사토시가 최대 금액보다 큽니다. (최대 ${Math.floor(
          maxSendable / 1000
        )} sats)`,
      });
      return;
    }
    const donationId = createDonationId();
    const commentAllowed = Number(lnurlData?.commentAllowed || 0);
    const comment = commentAllowed
      ? buildDonationComment(donationNote, donationId, commentAllowed, effectiveBlinkAddress)
      : "";
    const callbackUrl = new URL(callback);
    callbackUrl.searchParams.set("amount", String(amountMsats));
    if (commentAllowed) {
      callbackUrl.searchParams.set("comment", comment);
    }
    const lnurl = encodeLnurl(callbackUrl.toString());
    res.json({ lnurl, donationId });
  } catch (error) {
    res.status(500).json({ message: error?.message || "LNURL 생성 실패" });
  }
});

app.post("/api/blink/webhook", async (req, res) => {
  try {
    const eventType = req.body?.eventType;
    const transaction = req.body?.transaction || {};
    const memo = transaction.memo || "";
    if (!memo || !eventType || !eventType.startsWith("receive")) {
      if (!eventType || !eventType.startsWith("receive")) {
        res.status(204).end();
        return;
      }
    }
    const match = memo.match(/donation:([a-f0-9-]+)/i);
    let donationId = match ? match[1] : "";
    if (!donationId) {
      const invoiceCandidate = resolveInvoiceCandidate(
        transaction.paymentRequest ||
          transaction.payment_request ||
          transaction.invoice ||
          transaction.lnInvoice ||
          transaction.ln_invoice ||
          transaction
      );
      if (invoiceCandidate) {
        donationId = pendingDonationsByInvoice.get(invoiceCandidate) || "";
      }
    }
    if (!donationId) {
      res.status(204).end();
      return;
    }
    const payload = pendingDonations.get(donationId);
    if (!payload) {
      res.status(204).end();
      return;
    }
    await sendDiscordShare(payload);
    pendingDonations.delete(donationId);
    pendingDonationsByInvoice.delete(
      resolveInvoiceCandidate(
        transaction.paymentRequest ||
          transaction.payment_request ||
          transaction.invoice ||
          transaction.lnInvoice ||
          transaction.ln_invoice ||
          transaction
      )
    );
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
    videoDataUrl,
    videoFilename,
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
    const discordUserId = req.session?.user?.id || "";
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
      discordUserId,
      videoDataUrl,
      videoFilename,
    });

    res.json({ message: "디스코드 공유를 완료했습니다." });
  } catch (error) {
    res.status(500).json({ message: "디스코드 공유에 실패했습니다.", source: "server" });
  }
});

app.listen(Number(PORT), () => {
  console.log(`Citadel Idioma running on http://localhost:${PORT}`);
});
