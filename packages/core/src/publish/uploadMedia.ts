import fetch from 'node-fetch';
import fs from 'fs';

const X_MEDIA_URL = 'https://upload.twitter.com/1.1/media/upload.json';

export async function uploadMediaX(accessToken: string, filePath: string): Promise<string> {
  const mediaData = fs.readFileSync(filePath);
  const b64 = mediaData.toString('base64');

  const initRes = await fetch(X_MEDIA_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      command: 'INIT',
      total_bytes: String(mediaData.length),
      media_type: 'image/png',
      media_category: 'tweet_image',
    }),
  });

  if (!initRes.ok) {
    throw new Error(`X media init failed (${initRes.status}): ${await initRes.text()}`);
  }

  const initData = (await initRes.json()) as { media_id_string?: string };
  const mediaId = initData.media_id_string;
  if (!mediaId) throw new Error('X media init returned no media_id');

  const appendRes = await fetch(X_MEDIA_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      command: 'APPEND',
      media_id: mediaId,
      segment_index: '0',
      media_data: b64,
    }),
  });

  if (!appendRes.ok) {
    throw new Error(`X media append failed (${appendRes.status}): ${await appendRes.text()}`);
  }

  const finalizeRes = await fetch(X_MEDIA_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      command: 'FINALIZE',
      media_id: mediaId,
    }),
  });

  if (!finalizeRes.ok) {
    throw new Error(`X media finalize failed (${finalizeRes.status}): ${await finalizeRes.text()}`);
  }

  const finalizeData = (await finalizeRes.json()) as {
    media_id_string?: string;
    processing_info?: { state?: string; error?: { message?: string } };
  };

  if (finalizeData.processing_info?.state === 'failed') {
    throw new Error(`X media processing failed: ${finalizeData.processing_info.error?.message || 'unknown'}`);
  }

  if (finalizeData.processing_info?.state === 'in_progress') {
    await pollXMediaProcessing(accessToken, mediaId);
  }

  return mediaId;
}

async function pollXMediaProcessing(accessToken: string, mediaId: string): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 1000));

    const statusRes = await fetch(X_MEDIA_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        command: 'STATUS',
        media_id: mediaId,
      }),
    });

    if (!statusRes.ok) continue;

    const statusData = (await statusRes.json()) as {
      processing_info?: { state?: string; error?: { message?: string } };
    };

    const state = statusData.processing_info?.state;
    if (state === 'succeeded') return;
    if (state === 'failed') {
      throw new Error(`X media processing failed: ${statusData.processing_info?.error?.message || 'unknown'}`);
    }
  }

  throw new Error('X media processing timed out');
}

interface LinkedInUploadResponse {
  value: {
    uploadMechanism: {
      'com.linkedin.digitalmedia.upload.MediaUploadHttpRequest': {
        uploadUrl: string;
        mediaArtifact: string;
      };
    };
    asset: string;
  };
}

export async function uploadMediaLinkedIn(accessToken: string, personId: string, filePath: string): Promise<string> {
  const registerRes = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: `urn:li:person:${personId}`,
        serviceRelationships: [
          {
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent',
          },
        ],
      },
    }),
  });

  if (!registerRes.ok) {
    throw new Error(`LinkedIn asset register failed (${registerRes.status}): ${await registerRes.text()}`);
  }

  const registerData = (await registerRes.json()) as LinkedInUploadResponse;
  const uploadUrl = registerData.value.uploadMechanism['com.linkedin.digitalmedia.upload.MediaUploadHttpRequest'].uploadUrl;
  const assetUrn = registerData.value.asset;

  const fileData = fs.readFileSync(filePath);
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
    },
    body: fileData,
  });

  if (!uploadRes.ok) {
    throw new Error(`LinkedIn media upload failed (${uploadRes.status}): ${await uploadRes.text()}`);
  }

  return assetUrn;
}
