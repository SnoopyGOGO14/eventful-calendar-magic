import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Starting events sync for 2025...')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { spreadsheetId } = await req.json()
    if (!spreadsheetId) {
      throw new Error('Spreadsheet ID is required')
    }

    const credentialsStr = Deno.env.get('GOOGLE_SHEETS_CREDENTIALS')
    if (!credentialsStr) {
      throw new Error('Google Sheets credentials not found')
    }

    const credentials = JSON.parse(credentialsStr)
    const accessToken = await getAccessToken(credentials)

    console.log('Fetching data from 2025 tab...')
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'STUDIO 338 - 2025'!B:I`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Google Sheets API error: ${await response.text()}`)
    }

    const data = await response.json()
    const rows = data.values || []
    console.log(`Found ${rows.length} rows in 2025 tab`)

    const events = rows
      .filter((row: string[]) => row[0] && row[1])
      .map((row: string[], index: number) => {
        const dateStr = row[0] // Column B
        const title = row[1] || '' // Column C
        const contractStatus = (row[7] || '').toLowerCase() // Column I

        // Parse the date string (e.g., "Friday December 31")
        const [dayName, monthName, dayNum] = dateStr.trim().split(' ')
        const month = new Date(`${monthName} 1, 2025`).getMonth()
        let year = 2025

        // Handle year transition for December 31st events
        if (month === 11 && parseInt(dayNum) === 31) {
          console.log(`Found NYE event: ${title}`)
          // This is a NYE event, don't create an event for Jan 1st
          if (title.toLowerCase().includes('nye')) {
            return {
              date: `2025-12-31`,
              title: title,
              status: contractStatus === 'yes' ? 'confirmed' : 'pending',
              is_recurring: false
            }
          }
        }

        const date = new Date(year, month, parseInt(dayNum))
        if (isNaN(date.getTime())) {
          console.warn(`Skipping invalid date in row ${index + 1}:`, dateStr)
          return null
        }

        return {
          date: date.toISOString().split('T')[0],
          title: title,
          status: contractStatus === 'yes' ? 'confirmed' : 'pending',
          is_recurring: false
        }
      })
      .filter(event => event !== null)

    console.log('Clearing existing 2025 events...')
    const { error: deleteError } = await supabase
      .from('events')
      .delete()
      .gte('date', '2025-01-01')
      .lt('2026-01-01')

    if (deleteError) {
      throw new Error(`Error deleting existing events: ${deleteError.message}`)
    }

    console.log('Inserting new events...')
    const { error: insertError } = await supabase
      .from('events')
      .insert(events)

    if (insertError) {
      throw new Error(`Error inserting new events: ${insertError.message}`)
    }

    console.log('2025 events sync completed successfully')
    
    return new Response(
      JSON.stringify({ success: true, message: '2025 events synced successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Error syncing events:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error instanceof Error ? error.stack : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

async function getAccessToken(credentials: any) {
  const now = Math.floor(Date.now() / 1000)
  
  const jwtHeader = btoa(JSON.stringify({
    alg: 'RS256',
    typ: 'JWT'
  }))
  
  const jwtClaimSet = btoa(JSON.stringify({
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  }))

  const signInput = `${jwtHeader}.${jwtClaimSet}`
  const encoder = new TextEncoder()
  const signBytes = encoder.encode(signInput)

  const keyImportParams = {
    name: 'RSASSA-PKCS1-v1_5',
    hash: { name: 'SHA-256' },
  }

  const pemHeader = '-----BEGIN PRIVATE KEY-----'
  const pemFooter = '-----END PRIVATE KEY-----'
  const pemContents = credentials.private_key
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s/g, '')

  const binaryKey = atob(pemContents)
  const binaryKeyBytes = new Uint8Array(binaryKey.length)
  for (let i = 0; i < binaryKey.length; i++) {
    binaryKeyBytes[i] = binaryKey.charCodeAt(i)
  }

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKeyBytes,
    keyImportParams,
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    keyImportParams.name,
    cryptoKey,
    signBytes
  )

  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
  const jwt = `${signInput}.${signatureBase64}`

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  })

  if (!tokenResponse.ok) {
    throw new Error('Failed to get access token: ' + await tokenResponse.text())
  }

  const { access_token } = await tokenResponse.json()
  return access_token
}