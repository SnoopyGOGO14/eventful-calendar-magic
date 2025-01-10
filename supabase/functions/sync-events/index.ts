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
    console.log('Starting events sync...')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { spreadsheetId } = await req.json()
    if (!spreadsheetId) {
      throw new Error('Spreadsheet ID is required')
    }

    const credentialsStr = Deno.env.get('GOOGLE_SHEETS_CREDENTIALS')
    if (!credentialsStr) {
      console.error('Google Sheets credentials not found in environment')
      throw new Error('Google Sheets credentials not found')
    }

    console.log('Attempting to parse credentials...')
    let credentials
    try {
      credentials = JSON.parse(credentialsStr)
      
      if (!credentials.client_email || !credentials.private_key) {
        throw new Error('Missing required fields in credentials')
      }
      
      console.log('Successfully parsed credentials. Service Account Email:', credentials.client_email)
    } catch (error) {
      console.error('Raw credentials string:', credentialsStr)
      console.error('Credentials parsing error:', error)
      throw new Error(`Invalid credentials format: ${error.message}`)
    }

    const privateKey = credentials.private_key.replace(/\\n/g, '\n')
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

    console.log('Preparing to sign JWT...')

    const keyImportParams = {
      name: 'RSASSA-PKCS1-v1_5',
      hash: { name: 'SHA-256' },
    }

    try {
      const pemHeader = '-----BEGIN PRIVATE KEY-----'
      const pemFooter = '-----END PRIVATE KEY-----'
      const pemContents = privateKey
        .replace(pemHeader, '')
        .replace(pemFooter, '')
        .replace(/\s/g, '')

      const binaryKey = atob(pemContents)
      const binaryKeyBytes = new Uint8Array(binaryKey.length)
      for (let i = 0; i < binaryKey.length; i++) {
        binaryKeyBytes[i] = binaryKey.charCodeAt(i)
      }

      console.log('Importing private key...')
      const cryptoKey = await crypto.subtle.importKey(
        'pkcs8',
        binaryKeyBytes,
        keyImportParams,
        false,
        ['sign']
      )

      console.log('Signing JWT...')
      const signature = await crypto.subtle.sign(
        keyImportParams.name,
        cryptoKey,
        signBytes
      )

      const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      const jwt = `${signInput}.${signatureBase64}`

      console.log('Getting access token...')
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
        const error = await tokenResponse.text()
        console.error('Token response error:', error)
        throw new Error('Failed to get access token: ' + error)
      }

      const { access_token } = await tokenResponse.json()

      console.log('Fetching data from Google Sheets...')
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'STUDIO 338 - 2025'!A2:D`,
        {
          headers: {
            'Authorization': `Bearer ${access_token}`
          }
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Google Sheets API error:', errorText)
        throw new Error(`Google Sheets API error: ${errorText}`)
      }

      const data = await response.json()
      const rows = data.values || []
      console.log(`Found ${rows.length} rows in Google Sheets`)

      // Add validation for date format and data transformation
      const events = rows.map(row => {
        // Log the row data for debugging
        console.log('Processing row:', row)

        // Validate date format (assuming date is in column A)
        const dateStr = row[0]
        if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          console.warn(`Invalid date format for row:`, row)
          return null
        }

        return {
          date: dateStr,
          title: row[1] || '',
          status: (row[2]?.toLowerCase() || 'pending'),
          is_recurring: row[3]?.toLowerCase() === 'true',
        }
      }).filter(event => event !== null) // Remove invalid entries

      if (events.length === 0) {
        throw new Error('No valid events found in the spreadsheet')
      }

      console.log('Clearing existing events...')
      const { error: deleteError } = await supabase
        .from('events')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

      if (deleteError) {
        console.error('Error deleting events:', deleteError)
        throw new Error(`Error deleting existing events: ${deleteError.message}`)
      }

      console.log('Inserting new events...')
      const { error: insertError } = await supabase
        .from('events')
        .insert(events)

      if (insertError) {
        console.error('Error inserting events:', insertError)
        throw new Error(`Error inserting new events: ${insertError.message}`)
      }

      console.log('Sync completed successfully')
      
      return new Response(
        JSON.stringify({ success: true, message: 'Events synced successfully' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )

    } catch (error) {
      console.error('JWT signing error:', error)
      throw error
    }

  } catch (error) {
    console.error('Error syncing events:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})