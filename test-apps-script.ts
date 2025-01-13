import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const SCRIPT_ID = 'AKfycbwXB3QVgNtzyJBtsoZJpkrtCmsZmaTc3Xz2a7K0I-lh4lfOvAMqfELAI9BUvxtSwYIpsA';
const SCOPES = ['https://www.googleapis.com/auth/script.external_request',
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/script.projects'];

function pemToBuffer(pem: string): Uint8Array {
  const base64 = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  return base64ToUint8Array(base64);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getAccessToken() {
  const credentialsStr = Deno.env.get('SHEETS_CREDENTIALS')
  if (!credentialsStr) {
    // Fallback to local file if env var not set
    const credentialsText = await Deno.readTextFile('./config/service-account.json')
    const credentials = JSON.parse(credentialsText)
    return credentials
  }
  
  const credentials = JSON.parse(credentialsStr)
  
  const tokenUrl = 'https://oauth2.googleapis.com/token';
  const now = Math.floor(Date.now() / 1000);
  
  const jwtHeader = {
    alg: 'RS256',
    typ: 'JWT'
  };
  
  const jwtClaimSet = {
    iss: credentials.client_email,
    scope: SCOPES.join(' '),
    aud: tokenUrl,
    exp: now + 3600,
    iat: now
  };

  // Create JWT
  const encodedHeader = base64Encode(new TextEncoder().encode(JSON.stringify(jwtHeader)));
  const encodedClaimSet = base64Encode(new TextEncoder().encode(JSON.stringify(jwtClaimSet)));
  const signatureInput = `${encodedHeader}.${encodedClaimSet}`;
  
  // Sign with private key
  const privateKey = credentials.private_key;
  const keyData = await crypto.subtle.importKey(
    'pkcs8',
    pemToBuffer(privateKey),
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );
  
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    keyData,
    encoder.encode(signatureInput)
  );
  
  const jwt = `${signatureInput}.${base64Encode(new Uint8Array(signature))}`;
  
  // Exchange JWT for access token
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  
  const data = await response.json();
  console.log('Token response:', data);
  return data.access_token;
}

async function callAppsScript() {
  const accessToken = await getAccessToken();
  console.log('Access Token:', accessToken);
  
  const response = await fetch(`https://script.googleapis.com/v1/scripts/${SCRIPT_ID}:run`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      function: 'copyFormattingForBothSheets',
      parameters: []
    })
  });
  
  const data = await response.json();
  console.log('Response:', data);
}

async function testSpreadsheetAccess() {
  try {
    const credentials = JSON.parse(Deno.readTextFileSync('./config/service-account.json'));
    
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    console.log('Attempting to fetch spreadsheet...');
    const response = await sheets.spreadsheets.get({
      spreadsheetId: '10Hj8OsJemFkmRbu-EGGOBnFUKAh8FMhPWsvjuSl6okw'
    });
    
    console.log('Spreadsheet details:', response.data.properties);
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response error:', error.response.data);
    }
  }
}

// Run the test
callAppsScript();
testSpreadsheetAccess();
