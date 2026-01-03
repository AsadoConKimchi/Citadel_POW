import express from "express";
import session from "express-session";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

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
  SESSION_SECRET,
  PORT = 3000,
} = process.env;

const hasDiscordConfig =
  DISCORD_CLIENT_ID &&
  DISCORD_CLIENT_SECRET &&
  DISCORD_REDIRECT_URI &&
  DISCORD_GUILD_ID &&
  DISCORD_ROLE_ID;

app.use(express.json());
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

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.status(204).end();
  });
});

app.listen(Number(PORT), () => {
  console.log(`Citadel Idioma running on http://localhost:${PORT}`);
});
