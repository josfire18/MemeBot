import { getConfig } from './config';

// Minimal Reddit OAuth client (replaces snoowrap, which pulls in the deprecated,
// vulnerable `request` package). Uses the refresh-token grant snoowrap used.

let accessToken: string | undefined;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
    if (accessToken && Date.now() < tokenExpiresAt - 60000)
        return accessToken;

    const cfg = getConfig().reddit;
    const auth = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
    const resp = await fetch('https://www.reddit.com/api/v1/access_token', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': cfg.userAgent,
        },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: cfg.refreshToken }).toString(),
    });
    if (!resp.ok)
        throw new Error(`Reddit token request failed: HTTP ${resp.status}`);

    const body = await resp.json() as { access_token: string, expires_in: number };
    accessToken = body.access_token;
    tokenExpiresAt = Date.now() + body.expires_in * 1000;
    return accessToken;
}

export interface Submission {
    score: number;
    thumbnail: string;
    title: string;
}

export async function getSubmission(submid: string): Promise<Submission> {
    const token = await getAccessToken();
    const resp = await fetch(`https://oauth.reddit.com/by_id/t3_${encodeURIComponent(submid)}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': getConfig().reddit.userAgent },
    });
    if (!resp.ok)
        throw new Error(`Reddit submission request failed: HTTP ${resp.status}`);

    const body = await resp.json() as any;
    const post = body.data.children[0].data;
    return { score: post.score, thumbnail: post.thumbnail, title: post.title };
}

export async function getScore(submid: string): Promise<number> {
    return (await getSubmission(submid)).score;
}
