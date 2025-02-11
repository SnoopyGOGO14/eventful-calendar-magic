export async function getAccessToken() {
  // Get credentials from environment variable
  const credentialsStr = Deno.env.get('SHEETS_CRED');
  if (!credentialsStr) {
    throw new Error('SHEETS_CRED environment variable is not set');
  }

  let credentials;
  try {
    credentials = JSON.parse(credentialsStr);
  } catch (error) {
    console.error('Error parsing credentials:', error);
    throw new Error('Failed to parse SHEETS_CRED JSON');
  }

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error('Invalid credentials format - missing client_email or private_key');
  }

  const now = Math.floor(Date.now() / 1000);
  
  const jwtHeader = btoa(JSON.stringify({
    alg: 'RS256',
    typ: 'JWT'
  }));
  
  const jwtClaimSet = btoa(JSON.stringify({
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  }));

  const signInput = `${jwtHeader}.${jwtClaimSet}`;
  const encoder = new TextEncoder();
  const signBytes = encoder.encode(signInput);

  const keyImportParams = {
    name: 'RSASSA-PKCS1-v1_5',
    hash: { name: 'SHA-256' },
  };

  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = credentials.private_key
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s/g, '');

  const binaryKey = atob(pemContents);
  const binaryKeyBytes = new Uint8Array(binaryKey.length);
  for (let i = 0; i < binaryKey.length; i++) {
    binaryKeyBytes[i] = binaryKey.charCodeAt(i);
  }

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKeyBytes,
    keyImportParams,
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    keyImportParams.name,
    cryptoKey,
    signBytes
  );

  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  const jwt = `${signInput}.${signatureBase64}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('Token response error:', errorText);
    throw new Error(`Failed to get access token: ${errorText}`);
  }

  const { access_token } = await tokenResponse.json();
  return access_token;
}